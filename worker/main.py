"""
Hiremory background worker.

For every connected sender (Gmail OAuth OR provider-agnostic SMTP/IMAP), this:
  1. SEND      — emails contacts not yet contacted (daily cap + spacing), logging
                 each to send_log.
  2. REPLIES   — checks for an inbound reply, classifies it, and on a positive
                 reply replies with the user's resume.
  3. FOLLOWUPS — nudges non-repliers once, after FOLLOWUP_DAYS.

Idempotent: safe on a schedule. All state lives in Supabase.

Env required:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAILBOX_ENC_KEY
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (only for Gmail-OAuth senders)
Optional:
  DRY_RUN=1, SEND_SPACING_SECONDS, MAX_SENDS_PER_RUN
"""
import os
import sys
import time
import tempfile
import datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))


def _load_env() -> None:
    """Load worker/.env into os.environ before modules that read env at import."""
    path = os.path.join(HERE, ".env")
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.split("#", 1)[0].strip())


_load_env()

sys.path.insert(0, os.path.join(HERE, os.pardir, "engine"))
import config                # noqa: E402  (cadence constants)
import followups             # noqa: E402  (reply classification)

import supa                  # noqa: E402
import templates as tpl      # noqa: E402
import ai                    # noqa: E402  (optional Claude/Gemini personalization; no-op without key)
import resume_pdf            # noqa: E402  (renders a tailored resume to PDF)
from transports import SmtpTransport, GmailTransport, PermanentSendError, MailboxAuthError  # noqa: E402
from links import unsub_url  # noqa: E402

DRY_RUN = os.environ.get("DRY_RUN") == "1"
SPACING = int(os.environ.get("SEND_SPACING_SECONDS", config.SECONDS_BETWEEN_EMAILS))
MAX_SENDS = int(os.environ.get("MAX_SENDS_PER_RUN", "100000"))
LEASE_STALE_MIN = 15  # a 'running' row older than this is considered dead

# Warmup: a fresh mailbox starts low and ramps, so it doesn't trip spam filters.
WARMUP_START = 10   # emails on day 0
WARMUP_STEP = 5     # added per day
PAUSE_AFTER_FAILS = 5  # consecutive send failures -> pause the mailbox
PLAN_LIMITS = {"free": 50, "pro": 1500, "teams": 100000}  # emails per calendar month
# Auto-resume safety: only fire the resume automatically on a HIGH-confidence
# positive (AI-confirmed). Keyword-only positives are flagged for the user to
# approve. Set RESUME_AUTOSEND=0 to require manual approval for ALL positives.
RESUME_AUTOSEND = os.environ.get("RESUME_AUTOSEND", "1") != "0"

# Optional error reporting (free Sentry tier). No-op if SENTRY_DSN unset.
if os.environ.get("SENTRY_DSN"):
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=os.environ["SENTRY_DSN"], traces_sample_rate=0)
    except Exception:
        pass

_sends_this_run = 0
STATS = {"sent": 0, "replies": 0, "followups": 0, "bounces": 0, "errors": 0}


def log(msg: str) -> None:
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


# --------------------------------------------------------------------- SEND
def _eligible_contacts(uid: str, profile: dict, daily_cap: int) -> list[dict]:
    """Contacts to email now: not yet sent, not suppressed, within daily + monthly cap."""
    contacts = supa.select("contacts", {"user_id": f"eq.{uid}", "select": "*"})
    if not contacts:
        return []
    done = {r["contact_id"] for r in
            supa.select("send_log", {"user_id": f"eq.{uid}", "select": "contact_id"})}
    suppressed = {s["email"].lower() for s in
                  supa.select("suppressions", {"user_id": f"eq.{uid}", "select": "email"})}
    todo = [c for c in contacts
            if c["id"] not in done and (c.get("email") or "").lower() not in suppressed]
    if not todo:
        return []

    month = dt.date.today().replace(day=1).isoformat()
    sent_month = len(supa.select("send_log",
                     {"user_id": f"eq.{uid}", "sent_at": f"gte.{month}", "select": "id"}))
    month_cap = PLAN_LIMITS.get(profile.get("plan") or "free", 50)
    if sent_month >= month_cap:
        log(f"  monthly plan cap reached ({month_cap}, plan={profile.get('plan') or 'free'}); skipping")
        return []

    today = dt.date.today().isoformat()
    sent_today = len(supa.select("send_log",
                     {"user_id": f"eq.{uid}", "sent_at": f"gte.{today}", "select": "id"}))
    remaining = min(daily_cap, month_cap - sent_month) - sent_today
    if remaining <= 0:
        log(f"  daily cap reached ({daily_cap}); skipping sends")
        return []
    log(f"  {len(todo)} to contact, {remaining} left in today's quota")
    return todo[:remaining]


def phase_send(tx, uid: str, profile: dict, mailbox_id, daily_cap: int) -> None:
    # per-campaign AI instructions the user tuned in the preview panel.
    # Tolerate the column not existing yet (migration 0010 not applied) — send
    # without per-campaign tuning rather than failing the whole run.
    try:
        instr_map = {x["id"]: x.get("instructions") for x in
                     supa.select("campaigns", {"user_id": f"eq.{uid}", "select": "id,instructions"})}
    except Exception:
        instr_map = {}
    fails = 0
    for c in _eligible_contacts(uid, profile, daily_cap):
        if _sends_this_run >= MAX_SENDS:
            log("  MAX_SENDS_PER_RUN hit; stopping sends")
            return
        status = _send_one(tx, uid, profile, c, mailbox_id, instr_map.get(c.get("campaign_id")))
        if status == "auth_fail":
            return  # mailbox already paused
        if status == "failed":
            fails += 1
            # Circuit-breaker: stop after repeated failures. Works for Gmail
            # senders too (mailbox_id is None) — we just can't mark a row paused.
            if fails >= PAUSE_AFTER_FAILS:
                if mailbox_id:
                    supa.update("mailboxes", {"id": mailbox_id},
                                {"status": "paused", "last_error": "repeated send failures"})
                    log(f"  paused mailbox after {fails} consecutive failures")
                else:
                    log(f"  stopping sends after {fails} consecutive failures")
                return
        elif status == "sent":
            fails = 0
            time.sleep(SPACING)


def _compose(profile: dict, c: dict, url: str, instructions=None) -> tuple[str, str, str]:
    """Build (subject, plain, html). Uses Claude when available, else templates."""
    ai_email = ai.personalize(profile, c, instructions)  # None unless ANTHROPIC_API_KEY set / on error
    if ai_email:
        plain, html = tpl.assemble_ai(ai_email["body"], url)
        return ai_email["subject"], plain, html
    greeting = c.get("first_name") or "Hiring Team"
    company = c.get("company") or ""
    return (tpl.subject_line(profile),
            tpl.build_email(profile, greeting, company, unsub_url=url),
            tpl.build_email_html(profile, greeting, company, unsub_url=url))


def _send_one(tx, uid: str, profile: dict, c: dict, mailbox_id, instructions=None) -> str:
    """Send to one contact. Returns 'sent'|'dry'|'failed'|'permanent'|'auth_fail'."""
    global _sends_this_run
    company = c.get("company") or ""
    url = unsub_url(uid, c["email"])
    subject, body, body_html = _compose(profile, c, url, instructions)
    headers = {"List-Unsubscribe": f"<{url}>",
               "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}

    if DRY_RUN:
        log(f"  DRY would send -> {c['email']} ({company or 'n/a'})")
        return "dry"

    try:
        sent = tx.send(c["email"], subject, body, html=body_html, headers=headers)
    except MailboxAuthError as e:  # OUR credentials are bad — pause mailbox, blame nobody
        STATS["errors"] += 1
        if mailbox_id:
            supa.update("mailboxes", {"id": mailbox_id},
                        {"status": "paused", "last_error": str(e)[:300]})
        log(f"  mailbox auth rejected -> paused mailbox (fix the app password): {e}")
        return "auth_fail"
    except PermanentSendError as e:  # the RECIPIENT was refused — suppress that address
        STATS["errors"] += 1
        supa.upsert("suppressions",
                    {"user_id": uid, "email": c["email"].lower(), "reason": "bounce"},
                    on_conflict="user_id,email")
        log(f"  recipient refused -> suppressed {c['email']}: {e}")
        return "permanent"
    except Exception as e:  # transient/unknown: one bad address shouldn't kill the run
        STATS["errors"] += 1
        log(f"  send FAILED -> {c['email']}: {e}")
        return "failed"

    supa.insert("send_log", {
        "user_id": uid, "campaign_id": c.get("campaign_id"), "contact_id": c["id"],
        "mailbox_id": mailbox_id, "email": c["email"], "company": company,
        "subject": subject, "message_id": sent.get("id"),
        "thread_id": sent.get("thread_id"), "status": "sent",
    })
    if c.get("campaign_id"):
        supa.update("campaigns", {"id": c["campaign_id"]}, {"status": "sending"})
    _sends_this_run += 1
    STATS["sent"] += 1
    log(f"  sent -> {c['email']} ({company or 'n/a'})")
    return "sent"


# ------------------------------------------------------------------ REPLIES
def _default_resume_file(uid: str) -> str | None:
    rows = (supa.select("resumes", {"user_id": f"eq.{uid}", "is_default": "eq.true", "select": "*"})
            or supa.select("resumes", {"user_id": f"eq.{uid}", "select": "*"}))
    if not rows:
        return None
    path = rows[0]["storage_path"]
    try:
        data = supa.download("resumes", path)
    except Exception as e:
        log(f"  resume download failed ({path}): {e}")
        return None
    suffix = os.path.splitext(path)[1] or ".pdf"
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    return tmp


def _set_status(r: dict, status: str) -> None:
    supa.update("send_log", {"id": r["id"]}, {"status": status, "last_action_at": _now()})


def _tailored_resume(profile: dict, jd: str) -> str | None:
    """Tailor the user's resume_text to the JD and render a PDF; return temp path."""
    data = ai.tailor_resume(profile.get("resume_text") or "", jd)
    if not data:
        return None
    contact = " · ".join(x for x in [profile.get("email"), profile.get("phone"),
                          profile.get("linkedin_url"), profile.get("github_url")] if x)
    try:
        return resume_pdf.render(profile.get("full_name") or "Resume", contact,
                                 data.get("summary", ""), data.get("sections", []))
    except Exception as e:
        log(f"  tailored-resume render failed: {e}")
        return None


def _handle_positive(tx, uid, profile, r, confident: bool, resume_file, jd=None):
    """Auto-send the resume only on a high-confidence (AI-confirmed) positive and
    when auto-send is enabled; otherwise flag 'positive' for the user to approve.
    If the campaign has a job description + the user has resume_text + AI, attach a
    TAILORED resume PDF instead of the generic one."""
    autosend = RESUME_AUTOSEND and confident
    if DRY_RUN:
        log(f"  DRY positive from {r['email']} -> {'send resume' if autosend else 'flag for review'}")
        return resume_file
    if not autosend:
        _set_status(r, "positive")  # pending the user's OK
        log(f"  positive (needs your OK before resume) -> {r['email']}")
        return resume_file

    tailored = _tailored_resume(profile, jd) if (jd and (profile.get("resume_text") or "").strip()) else None
    if not tailored and resume_file is None:
        resume_file = _default_resume_file(uid)
    attach = tailored or resume_file
    if not attach:  # don't send a "resume attached" email with no resume
        _set_status(r, "positive")
        log(f"  positive but no resume available — flagged for you -> {r['email']}")
        return resume_file

    greeting = (r.get("email") or "there").split("@")[0]
    plain, html = tpl.build_resume_cover(profile, greeting)
    tx.reply(r["email"], r.get("subject") or "", plain, html=html, row=r, attachment_path=attach)
    supa.update("send_log", {"id": r["id"]},
                {"status": "resume_sent", "resume_path": "tailored" if tailored else "default",
                 "last_action_at": _now()})
    log(f"  positive -> {'tailored ' if tailored else ''}resume sent to {r['email']}")
    if tailored and os.path.exists(tailored):
        os.remove(tailored)
    return resume_file


def phase_replies(tx, uid: str, profile: dict) -> None:
    # Only NEW replies: scan 'sent' rows. Once classified they move to a terminal
    # status, so we never re-fetch or re-classify them on later runs.
    rows = supa.select("send_log", {"user_id": f"eq.{uid}", "status": "eq.sent", "select": "*"})
    # per-campaign job descriptions for resume tailoring (tolerate column not yet migrated)
    try:
        jd_map = {x["id"]: x.get("job_description") for x in
                  supa.select("campaigns", {"user_id": f"eq.{uid}", "select": "id,job_description"})}
    except Exception:
        jd_map = {}
    resume_file = None
    for r in rows:
        inbound = tx.find_reply(r)
        if not inbound:
            continue
        _, text = inbound
        ai_verdict = ai.classify_reply(text)            # None if AI off / error
        verdict = ai_verdict or followups.classify_reply(text)
        STATS["replies"] += 1

        if verdict == "positive":
            jd = jd_map.get(r.get("campaign_id"))
            resume_file = _handle_positive(tx, uid, profile, r, ai_verdict == "positive", resume_file, jd)
        elif verdict == "negative":
            _set_status(r, "not_now")
            log(f"  negative -> marked not_now: {r['email']}")
        else:
            _set_status(r, "replied")
            log(f"  neutral reply from {r['email']} (needs you)")

    if resume_file and os.path.exists(resume_file):
        os.remove(resume_file)


# ---------------------------------------------------------------- FOLLOWUPS
def phase_followups(tx, uid: str, profile: dict) -> None:
    rows = supa.select("send_log",
                       {"user_id": f"eq.{uid}", "status": "eq.sent", "select": "*"})
    now = dt.datetime.now()
    for r in rows:
        if int(r.get("followup_count") or 0) >= config.MAX_FOLLOWUPS:
            continue
        last = r.get("last_action_at") or r.get("sent_at")
        if _days_since(last, now) < config.FOLLOWUP_DAYS:
            continue
        if tx.find_reply(r):  # don't nudge someone who replied
            continue
        greeting = (r.get("email") or "there").split("@")[0]
        company = r.get("company") or ""
        if DRY_RUN:
            log(f"  DRY would follow up -> {r['email']}")
            continue
        plain = tpl.build_followup(profile, greeting, company)
        html = tpl.build_followup_html(profile, greeting, company)
        tx.reply(r["email"], r.get("subject") or "", plain, html=html, row=r)
        supa.update("send_log", {"id": r["id"]},
                    {"followup_count": int(r.get("followup_count") or 0) + 1,
                     "last_action_at": _now()})
        STATS["followups"] += 1
        log(f"  followed up -> {r['email']}")
        time.sleep(SPACING)


# ------------------------------------------------------------------- BOUNCES
def phase_bounces(tx, uid: str) -> None:
    """Detect delivery failures and suppress those addresses (async bounces)."""
    rows = supa.select("send_log",
                       {"user_id": f"eq.{uid}", "status": "eq.sent", "select": "*"})
    if not rows:
        return
    by_email = {r["email"].lower(): r for r in rows if r.get("email")}
    bounced = tx.find_bounces(list(by_email.keys()))
    for addr in bounced:
        r = by_email.get(addr)
        if not r:
            continue
        if DRY_RUN:
            log(f"  DRY bounce detected -> {addr}")
            continue
        supa.update("send_log", {"id": r["id"]},
                    {"status": "bounced", "last_action_at": _now()})
        supa.upsert("suppressions", {"user_id": uid, "email": addr, "reason": "bounce"},
                    on_conflict="user_id,email")
        STATS["bounces"] += 1
        log(f"  bounced -> suppressed {addr}")


# ------------------------------------------------------------------- helpers
def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _days_since(iso_ts, now) -> float:
    try:
        t = dt.datetime.fromisoformat(str(iso_ts).replace("Z", "+00:00"))
        if t.tzinfo:
            t = t.replace(tzinfo=None)
        return (now - t).total_seconds() / 86400.0
    except (ValueError, TypeError):
        return 0.0


def _profile_for(uid: str, fallback_email: str | None) -> dict:
    rows = supa.select("profiles", {"id": f"eq.{uid}", "select": "*"})
    profile = rows[0] if rows else {}
    if not profile.get("email"):
        profile["email"] = fallback_email
    return profile


def _gmail_senders() -> list[tuple]:
    """(uid, profile, transport, mailbox_id, daily_cap) for Gmail-OAuth users."""
    out = []
    toks = supa.select("gmail_tokens",
                       {"refresh_token": "not.is.null", "select": "user_id,email,refresh_token"})
    for u in toks:
        uid = u["user_id"]
        profile = _profile_for(uid, u.get("email"))
        if not tpl.is_complete(profile):
            log(f"user {u.get('email')}: profile incomplete; skipping (finish /onboarding)")
            continue
        try:
            from gmailer import service_for
            tx = GmailTransport(service_for(u["refresh_token"]), u.get("email"))
        except Exception as e:
            log(f"user {u.get('email')}: Gmail auth failed: {e}")
            continue
        out.append((uid, profile, tx, None, config.DAILY_BATCH_SIZE))
    return out


def _smtp_senders() -> list[tuple]:
    """(uid, profile, transport, mailbox_id, daily_cap) for SMTP mailboxes."""
    from crypto import decrypt_secret
    out = []
    boxes = supa.select("mailboxes",
                       {"transport": "eq.smtp", "status": "eq.active", "select": "*"})
    for mb in boxes:
        uid = mb["user_id"]
        profile = _profile_for(uid, mb.get("email"))
        if not tpl.is_complete(profile):
            log(f"mailbox {mb.get('email')}: profile incomplete; skipping")
            continue
        if not mb.get("secret_enc"):
            log(f"mailbox {mb.get('email')}: no stored credential; skipping")
            continue
        try:
            secret = decrypt_secret(mb["secret_enc"])
        except Exception as e:
            log(f"mailbox {mb.get('email')}: decrypt failed: {e}")
            continue
        cap = _warmup_cap(mb.get("created_at"), int(mb.get("daily_cap") or 30))
        out.append((uid, profile, SmtpTransport(mb, secret), mb["id"], cap))
    return out


def _warmup_cap(created_at, hard_cap: int) -> int:
    """Ramp a fresh mailbox: WARMUP_START on day 0, +WARMUP_STEP/day, capped.
    A missing created_at is treated as a brand-new mailbox (day 0) — the safe,
    spam-protecting default. (Previously defaulted to 999 days, which skipped
    warmup entirely and sent at full cap immediately.)"""
    days = _days_since(created_at, dt.datetime.now()) if created_at else 0
    allowed = WARMUP_START + WARMUP_STEP * int(days)
    return max(1, min(hard_cap, allowed))


def _lease_cutoff() -> str:
    """Running rows older than this are considered dead (so a crashed run can't
    block the lease forever)."""
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=LEASE_STALE_MIN)).isoformat()


def _acquire_lease() -> bool:
    """Single-flight pre-check: refuse to start if a fresh 'running' row exists.
    Stale running rows are ignored. This narrows but doesn't fully close the race
    (SELECT-then-INSERT) — _confirm_lease() does the deterministic tie-break."""
    active = supa.select("worker_runs",
                        {"status": "eq.running", "started_at": f"gte.{_lease_cutoff()}", "select": "id"})
    return not active


def _confirm_lease(run_id) -> bool:
    """After inserting our 'running' row, make sure WE hold the lease. If two runs
    raced past _acquire_lease and both inserted, the one with the earliest
    (started_at, id) wins; the rest stand down. Deterministic, so exactly one
    proceeds — without a migration or a unique index that would break stale recovery."""
    fresh = supa.select("worker_runs",
                        {"status": "eq.running", "started_at": f"gte.{_lease_cutoff()}",
                         "order": "started_at.asc,id.asc", "select": "id"})
    return bool(fresh) and fresh[0]["id"] == run_id


def main() -> None:
    log(f"worker start (dry_run={DRY_RUN}, spacing={SPACING}s)")

    if not DRY_RUN and not _acquire_lease():
        log("another run is already in progress (lease held); exiting")
        return

    run = None
    if not DRY_RUN:
        run = supa.insert("worker_runs", {"status": "running", "host": os.uname().nodename})
        if run and run.get("id") and not _confirm_lease(run["id"]):
            supa.update("worker_runs", {"id": run["id"]},
                        {"status": "aborted", "finished_at": _now()})
            log("lost lease race to an earlier run; exiting")
            return

    try:
        senders = _gmail_senders() + _smtp_senders()
        log(f"{len(senders)} active sender(s)")
        for uid, profile, tx, mailbox_id, daily_cap in senders:
            log(f"sender {profile.get('email')}")
            try:
                phase_send(tx, uid, profile, mailbox_id, daily_cap)
                phase_replies(tx, uid, profile)
                phase_bounces(tx, uid)
                phase_followups(tx, uid, profile)
            except Exception as e:
                STATS["errors"] += 1
                log(f"  sender error (continuing): {e}")
        status = "done"
    except Exception as e:
        status = "error"
        STATS["errors"] += 1
        log(f"worker fatal error: {e}")
    finally:
        if run and run.get("id"):
            supa.update("worker_runs", {"id": run["id"]},
                        {"status": status, "finished_at": _now(), **STATS})

    log(f"worker done ({STATS['sent']} sent, {STATS['replies']} replies, "
        f"{STATS['followups']} followups, {STATS['bounces']} bounces, {STATS['errors']} errors)")


if __name__ == "__main__":
    main()
