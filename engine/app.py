"""
HR Job Application Automation — Streamlit control panel.

Run:  streamlit run app.py

Tabs:
  Send       upload list -> clean -> preview -> send batch (drip + dedup)
  Follow-ups send a polite nudge to non-repliers after FOLLOWUP_DAYS
  Replies    scan inbox; auto-send resume when a reply asks for it
  Dashboard  live counts: sent / replied / resume sent / awaiting / bounced
"""
import os
import time
import datetime as dt
import pandas as pd
import streamlit as st

import config
import parse_contacts
import email_template
import followups

st.set_page_config(page_title="HR Job Automation", page_icon="📨", layout="wide")
os.makedirs("data", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

LOG_COLS = ["email", "name", "title", "company", "subject", "resume",
            "sent_at", "message_id", "thread_id", "followup_count",
            "last_action_at", "status"]


def _ensure_cols(df: pd.DataFrame) -> pd.DataFrame:
    for c in LOG_COLS:
        if c not in df.columns:
            df[c] = "" if c not in ("followup_count",) else 0
    return df


def load_log() -> pd.DataFrame:
    if os.path.exists(config.SENT_LOG):
        return _ensure_cols(pd.read_csv(config.SENT_LOG))
    return pd.DataFrame(columns=LOG_COLS)


def save_log(df: pd.DataFrame):
    df.to_csv(config.SENT_LOG, index=False)


def append_log(row: dict):
    df = load_log()
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    save_log(df)


def load_contacts() -> pd.DataFrame:
    if os.path.exists(config.CONTACTS_CSV):
        return pd.read_csv(config.CONTACTS_CSV)
    return pd.DataFrame()


def now_iso():
    return dt.datetime.now().isoformat(timespec="seconds")


tab_send, tab_fu, tab_rep, tab_dash = st.tabs(
    ["📤 Send", "🔁 Follow-ups", "📥 Replies", "📊 Dashboard"])

# ------------------------------------------------------------------ SEND TAB
with tab_send:
    st.header("Send job applications")

    up = st.file_uploader("Upload HR contact list (PDF / Excel / Docx / CSV)",
                          type=["pdf", "xlsx", "xls", "docx", "csv"])
    col_a, col_b = st.columns(2)
    clean_generic = col_a.checkbox("Remove role-less / shared inboxes", value=True)
    dedupe_co = col_b.checkbox("Keep one contact per company",
                               value=config.DEDUPE_BY_COMPANY)
    if up and st.button("Parse contacts"):
        path = os.path.join("uploads", up.name)
        with open(path, "wb") as f:
            f.write(up.getbuffer())
        with st.spinner("Parsing…"):
            df = parse_contacts.parse(path)
            raw_n = len(df)
            df, report = parse_contacts.clean(df, drop_generic=clean_generic,
                                              dedupe_company=dedupe_co)
            df.to_csv(config.CONTACTS_CSV, index=False)
        st.success(f"Parsed {raw_n} valid contacts, kept {report['kept']} after "
                   f"cleanup (removed {report['removed']}: "
                   f"{report['generic']} generic, {report['placeholder']} junk, "
                   f"{report['dupe_company']} duplicate companies).")

    contacts = load_contacts()
    log = load_log()
    if contacts.empty:
        st.info("Upload and parse a contact list to begin.")
    else:
        sent_emails = set(log["email"]) if not log.empty else set()
        remaining = contacts[~contacts["email"].isin(sent_emails)]

        c1, c2, c3 = st.columns(3)
        c1.metric("Total contacts", len(contacts))
        c2.metric("Already emailed", len(sent_emails))
        c3.metric("Remaining", len(remaining))

        st.subheader("Preview the next email")
        if not remaining.empty:
            pv = email_template.preview(remaining.iloc[0].to_dict())
            st.text(f"To: {pv['to']}")
            st.text(f"Subject: {pv['subject']}")
            st.code(pv["body"])
            if not config.ATTACH_RESUME:
                st.caption("✉️ Inquiry mode: no attachment. Resume sent on reply.")
            elif pv["resume_exists"]:
                st.caption(f"📎 Attaching: {pv['resume']}")
            else:
                st.error(f"Resume missing: {pv['resume']} — drop it into resumes/.")

        st.subheader("Send a batch")
        n = st.number_input("How many to send now", min_value=1,
                            max_value=int(config.DAILY_BATCH_SIZE),
                            value=min(10, int(config.DAILY_BATCH_SIZE)))
        st.caption(f"Safety cap: {config.DAILY_BATCH_SIZE}/day, "
                   f"{config.SECONDS_BETWEEN_EMAILS}s apart.")
        if st.button("🚀 Send now", type="primary", disabled=remaining.empty):
            import gmail_client
            try:
                service = gmail_client.get_service()
            except Exception as e:
                st.error(f"Gmail auth failed: {e}")
                st.stop()
            batch = remaining.head(int(n))
            prog, status = st.progress(0.0), st.empty()
            for i, (_, row) in enumerate(batch.iterrows()):
                c = row.to_dict()
                pv = email_template.preview(c)
                attach = pv["resume"] if config.ATTACH_RESUME else None
                if config.ATTACH_RESUME and not pv["resume_exists"]:
                    status.error(f"Skipped {c['email']} — resume missing.")
                    continue
                try:
                    resp = gmail_client.send_email(
                        service, pv["to"], pv["subject"], pv["body"], attach,
                        body_html=pv["body_html"])
                    append_log({
                        "email": c["email"], "name": c.get("name", ""),
                        "title": c.get("title", ""), "company": c.get("company", ""),
                        "subject": pv["subject"],
                        "resume": attach or "(inquiry, no attachment)",
                        "sent_at": now_iso(), "message_id": resp["id"],
                        "thread_id": resp.get("threadId", ""),
                        "followup_count": 0, "last_action_at": now_iso(),
                        "status": "sent",
                    })
                    status.write(f"✅ Sent to {c['email']} ({c.get('company','')})")
                except Exception as e:
                    status.error(f"❌ {c['email']}: {e}")
                prog.progress((i + 1) / len(batch))
                if i < len(batch) - 1:
                    time.sleep(config.SECONDS_BETWEEN_EMAILS)
            st.success(f"Done. Sent {len(batch)} this batch.")
            st.rerun()

# -------------------------------------------------------------- FOLLOW-UP TAB
with tab_fu:
    st.header("Follow-ups")
    log = load_log()
    due = followups.due_for_followup(log)
    st.caption(f"Rule: nudge non-repliers after {config.FOLLOWUP_DAYS} days, "
               f"up to {config.MAX_FOLLOWUPS} follow-up(s).")
    st.metric("Due for follow-up now", len(due))
    if due:
        st.dataframe(pd.DataFrame(due)[["name", "company", "email", "sent_at",
                                        "followup_count"]],
                     use_container_width=True, hide_index=True)
        fu_n = st.number_input("How many follow-ups to send", min_value=1,
                               max_value=min(int(config.DAILY_BATCH_SIZE), len(due)),
                               value=min(int(config.DAILY_BATCH_SIZE), len(due)))
        if st.button("🔁 Send follow-ups", type="primary"):
            import gmail_client
            try:
                service = gmail_client.get_service()
            except Exception as e:
                st.error(f"Gmail auth failed: {e}")
                st.stop()
            prog, status = st.progress(0.0), st.empty()
            batch = due[:int(fu_n)]
            for i, c in enumerate(batch):
                first = (c.get("name") or "").split()[0] if c.get("name") else "Hiring Team"
                body = email_template.build_followup(first, c.get("company", ""))
                html = email_template.build_followup_html(first, c.get("company", ""))
                try:
                    if c.get("thread_id"):
                        gmail_client.reply_in_thread(
                            service, c["email"], c.get("subject", ""), body,
                            c["thread_id"], body_html=html)
                    else:
                        gmail_client.send_email(service, c["email"],
                                                email_template.followup_subject(),
                                                body, body_html=html)
                    mask = log["email"] == c["email"]
                    log.loc[mask, "followup_count"] = int(c.get("followup_count", 0) or 0) + 1
                    log.loc[mask, "last_action_at"] = now_iso()
                    status.write(f"✅ Followed up {c['email']}")
                except Exception as e:
                    status.error(f"❌ {c['email']}: {e}")
                prog.progress((i + 1) / len(batch))
                if i < len(batch) - 1:
                    time.sleep(config.SECONDS_BETWEEN_EMAILS)
            save_log(log)
            st.success(f"Sent {len(batch)} follow-ups.")
            st.rerun()
    else:
        st.info("Nothing due yet.")

# ----------------------------------------------------------------- REPLIES TAB
with tab_rep:
    st.header("Replies and auto-resume")
    st.caption("Scans threads for replies. If a reply asks for your resume, the "
               "role-matched PDF is sent back automatically in the same thread.")
    log = load_log()
    if log.empty:
        st.info("No applications sent yet.")
    elif st.button("📥 Scan replies and auto-send resume", type="primary"):
        import gmail_client
        try:
            service = gmail_client.get_service()
        except Exception as e:
            st.error(f"Gmail auth failed: {e}")
            st.stop()
        open_rows = log[log["status"].isin(["sent", "awaiting"])]
        results, prog, status = [], st.progress(0.0), st.empty()
        for i, (_, r) in enumerate(open_rows.iterrows()):
            c = r.to_dict()
            mask = log["email"] == c["email"]
            inbound = (gmail_client.get_inbound_reply(service, c.get("thread_id"),
                                                      c["email"])
                       if c.get("thread_id") else None)
            if not inbound:
                prog.progress((i + 1) / max(1, len(open_rows)))
                continue
            _, text = inbound
            verdict = followups.classify_reply(text)
            if verdict == "positive":
                first = (c.get("name") or "").split()[0] if c.get("name") else "Hiring Team"
                plain, html = email_template.build_resume_cover(first)
                resume = email_template.pick_resume(c.get("title", ""), c.get("company", ""))
                if os.path.exists(resume):
                    gmail_client.reply_in_thread(
                        service, c["email"], c.get("subject", ""), plain,
                        c["thread_id"], attachment_path=resume, body_html=html)
                    log.loc[mask, "status"] = "resume_sent"
                    log.loc[mask, "resume"] = resume
                else:
                    log.loc[mask, "status"] = "replied"
                    status.warning(f"{c['email']} wants resume but {resume} missing.")
            elif verdict == "negative":
                log.loc[mask, "status"] = "not_now"
            else:
                log.loc[mask, "status"] = "replied"
            log.loc[mask, "last_action_at"] = now_iso()
            results.append({"email": c["email"], "company": c.get("company", ""),
                            "verdict": verdict})
            prog.progress((i + 1) / max(1, len(open_rows)))
        save_log(log)
        if results:
            st.success(f"Processed {len(results)} replies.")
            st.dataframe(pd.DataFrame(results), use_container_width=True, hide_index=True)
        else:
            st.info("No new replies found.")

# -------------------------------------------------------------- DASHBOARD TAB
with tab_dash:
    st.header("Application tracker")
    log = load_log()
    if log.empty:
        st.info("No applications sent yet.")
    else:
        total = len(log)
        st.caption(f"Last activity: {log['last_action_at'].max()}")
        if st.button("🔄 Refresh bounce status from Gmail"):
            import gmail_client
            try:
                service = gmail_client.get_service()
                with st.spinner("Checking Gmail for bounces…"):
                    bounced = gmail_client.check_bounces(service, log["email"].tolist())
                log.loc[log["email"].isin(bounced), "status"] = "bounced"
                save_log(log)
                st.success(f"Marked {len(bounced)} bounced.")
            except Exception as e:
                st.error(f"Gmail check failed: {e}")

        counts = log["status"].value_counts().to_dict()
        c1, c2, c3, c4, c5 = st.columns(5)
        c1.metric("📨 Sent", total)
        c2.metric("✅ Replied", counts.get("replied", 0) + counts.get("resume_sent", 0))
        c3.metric("📎 Resume sent", counts.get("resume_sent", 0))
        c4.metric("📭 Awaiting", counts.get("sent", 0) + counts.get("awaiting", 0))
        c5.metric("⚠️ Bounced", counts.get("bounced", 0))

        st.subheader("All applications")
        st.dataframe(
            log[["sent_at", "name", "company", "email", "followup_count", "status"]]
            .sort_values("sent_at", ascending=False),
            use_container_width=True, hide_index=True,
        )
        st.download_button("Download log (CSV)", log.to_csv(index=False),
                           "sent_log.csv", "text/csv")
