# The Worker

The worker (`worker/`) is the background engine that does all the actual sending and inbox
reading. It runs on a schedule — GitHub Actions cron in production, or `python main.py` locally.

## What it is
A Python orchestrator with no UI. Each run leases the job (single-flight, so two cron ticks
never overlap), processes a series of phases, records the run, and exits.

## The four phases
Each invocation of [`worker/main.py`](../../worker/main.py) runs, per user:

| Phase | Function | What it does |
|---|---|---|
| **Send** | `phase_send` | Pull queued recipients up to the daily cap, compose (AI or template), send via the user's mailbox |
| **Replies** | `phase_replies` | Scan threads, `classify_reply()`, auto-send the tailored resume on a confirmed positive |
| **Bounces** | `phase_bounces` | Detect hard bounces and add them to the suppression list |
| **Follow-ups** | `phase_followups` | Nudge non-repliers past the silence window, in the same thread |

Composition helpers: `_compose()` builds the email (injecting profile memory + campaign
instructions); `_send_one()` sends and catches auth vs. recipient errors; `_tailored_resume()`
+ `_handle_positive()` handle the resume-on-yes path.

## Module map
| File | Responsibility |
|---|---|
| `main.py` | Orchestrator: lease, phases, `worker_runs` tracking |
| `ai.py` | Provider-agnostic AI — `personalize()`, `classify_reply()`, `tailor_resume()`; Gemini → Claude → template |
| `transports.py` | `SmtpTransport` / `GmailTransport`; `MailboxAuthError` vs `PermanentSendError`; IMAP primed once per run |
| `crypto.py` | Decrypts mailbox secrets with `MAILBOX_ENC_KEY` (matches `web/lib/crypto.ts`) |
| `resume_pdf.py` | Renders the tailored resume PDF (fpdf2) |
| `links.py` | Mints the stateless HMAC unsubscribe token |
| `supa.py` | PostgREST + Storage REST helpers |
| `templates.py` | The no-AI fallback email template |

## Error handling that matters
- **Auth failures** (e.g. SMTP 535 "Username and Password not accepted") raise `MailboxAuthError`
  → the **mailbox is paused**, not the recipient suppressed. This is keyed on exception *type*,
  not string matching, which previously misclassified auth failures as recipient bounces.
- **Recipient refusals** raise `PermanentSendError` → that address is suppressed.

## Reliability
- **Single-flight lease** in `worker_runs` prevents concurrent sends.
- **Warmup ramp** grows daily volume gradually for new mailboxes.
- **Daily cap** enforced per plan (see the billing migration).
- Set `DRY_RUN=1` to log actions without sending.

## Running it
See [getting-started.md](../getting-started.md) (local) and [deployment.md](../deployment.md)
(GitHub Actions cron). Config in [configuration.md](../configuration.md).
