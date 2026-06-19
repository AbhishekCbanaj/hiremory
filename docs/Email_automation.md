# Email_automation

Context and operating doc for the HR job-application email automation.
Read this first to understand what the system does, how it is wired, and how to run it.

---

## 1. Purpose

Send personalized cold job-application emails to a large list of HR contacts,
one HR at a time, without doing it manually. Given a list of ~1,842 HR
contacts, the system:

1. Parses the contact list (PDF / Excel / Docx / CSV).
2. Writes a personalized, value-led email for each HR (greeting, company, role).
3. Attaches the role-matched resume.
4. Sends through Gmail at a safe pace (40/day, 45s apart).
5. Tracks every send and pulls reply / bounce status back from Gmail.

Owner: Abhishek Banaj (abhishekbanaj01@gmail.com).
Target roles: Data Analyst, Business Analyst, Product Analyst, Junior Data
Scientist, Junior AI/ML Engineer.

---

## 2. Folder layout

```
HR_Job_Automation/
├── README.md                <- project map / quick start
├── docs/                    <- all documentation (this file lives here)
├── engine/                  <- the Python automation
│   ├── config.py            <- settings: identity, batch size, roles, resumes
│   ├── parse_contacts.py    <- contact list -> data/contacts.csv (+ clean())
│   ├── email_template.py    <- subject + body + follow-up + resume cover
│   ├── gmail_client.py      <- Gmail send + reply/bounce detection
│   ├── followups.py         <- follow-up timing + reply classification
│   ├── app.py               <- Streamlit UI (Send / Follow-ups / Replies / Dashboard)
│   ├── requirements.txt
│   ├── credentials.json     <- (you add) Google OAuth client
│   ├── token.json           <- (auto) cached Gmail auth
│   ├── resumes/  uploads/  data/   <- PDFs, raw lists, contacts.csv + sent_log.csv
├── web/                     <- Next.js SaaS frontend
└── supabase/                <- DB schema + storage policies
```

Run the local tool from inside `engine/`:  `cd engine && streamlit run app.py`

---

## 3. How it works (flow)

1. **Upload** an HR list in the Send tab.
2. `parse_contacts.py` detects the Name / Email / Title / Company columns,
   validates emails, dedupes, and writes `data/contacts.csv`.
3. For each not-yet-emailed contact, `email_template.py`:
   - greets with the HR's full name (falls back to first name),
   - mentions the company and target roles,
   - lists quantified results as bullet points,
   - picks the resume from the HR title (DS/ML/BA), else the Data Analyst default.
4. `gmail_client.py` sends via the Gmail API and returns a message id.
5. Every send is appended to `data/sent_log.csv`. Already-sent emails are
   skipped on the next run, so the 1,842 list can be worked over many days
   with zero duplicates.
6. The Dashboard tab calls Gmail to mark each address as
   replied / awaiting / bounced.

---

## 4. The email

- Subject: `Application for Analyst Roles | Abhishek Banaj (Immediate Joiner)`
- Greeting: `Dear <Full Name>,`
- Hook: "Most analysts report numbers; I find the money hiding inside them."
- Two bullet blocks (• marker, no dashes): **results** then **what I bring**.
- Clear ask: consider for current/upcoming openings, open to a call.
- Full signature with phone, email, LinkedIn, GitHub.

Structure follows Indeed's "how to write an email to HR" guidance: full-name
greeting, concise informative subject, complete context, clear action/ask,
thankful close that invites contact, full signature.

To change wording, edit `build_email()` in `email_template.py`.

---

## 5. Sending safety

- `DAILY_BATCH_SIZE = 40`, `SECONDS_BETWEEN_EMAILS = 45` in `config.py`.
- A personal Gmail caps near ~500/day and flags bulk cold mail fast, so the
  full list drips over ~6 weeks. Slower pace also gets better reply rates.
- Never sends to the same address twice (guarded by `sent_log.csv`).

---

## 6. Setup checklist

1. `python3 -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements.txt`
3. Put the 4 resume PDFs in `resumes/` (exact names in `config.py`).
4. Confirm LinkedIn + GitHub URLs in `config.py`.
5. Google Cloud: enable Gmail API, create a Desktop OAuth client, save it as
   `credentials.json` here. First send opens a browser to authorize once.
6. `streamlit run app.py`

---

## 7. Follow-ups and replies (built)

- **Follow-ups tab**: after `FOLLOWUP_DAYS` (6) with no reply/bounce, a short
  polite nudge is offered for sending, up to `MAX_FOLLOWUPS` (1). Sent inside
  the original Gmail thread.
- **Replies tab (auto-resume)**: scans each thread for an inbound reply, then
  `classify_reply()` tags it:
  - positive (asks for resume) -> auto-sends the role-matched PDF in-thread,
    status becomes `resume_sent`.
  - negative (no openings / stop) -> status `not_now`.
  - neutral -> status `replied` for manual handling.
- **List cleanup** (Send tab checkboxes): drops role-less/shared inboxes
  (`hr@`, `info@`, `qa@`, ...), placeholder names, and duplicate companies
  before sending, so reputation and sends aren't wasted on junk rows.

Cues and thresholds live in `config.py` (POSITIVE_CUES, NEGATIVE_CUES,
GENERIC_LOCALPARTS, FOLLOWUP_DAYS, MAX_FOLLOWUPS, DEDUPE_BY_COMPANY).

## 8. Open items / future

- Per-company resume tailoring needs the LaTeX/Word source (only PDFs exist now).
- Reply classification is keyword-based; could upgrade to an LLM call for nuance.
- Optional: parallel LinkedIn outreach, A/B subject lines, account warm-up ramp.
