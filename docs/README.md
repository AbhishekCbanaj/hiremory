# HR Job Application Automation

Upload a list of HR contacts → personalize a cold email per HR/company →
attach your resume → drip-send via Gmail (40/day) → track replies, bounces,
and no-replies on a dashboard.

## What it does
- Parses an HR list in **PDF / Excel / Docx / CSV** (columns: Name, Email, Title, Company).
- Writes a **human-toned, personalized** email (first name + company + your real wins).
- Attaches the **role-matched resume** (DA / BA / DS / ML), or the default.
- Sends **40/day, 45s apart** to protect your Gmail from spam flags.
- **Never double-sends** — `data/sent_log.csv` is the source of truth, survives across days.
- **Dashboard**: Sent · Replied · Awaiting · Bounced (reads your Gmail).

## One-time setup

```bash
cd HR_Job_Automation
python3 -m venv .venv && source .venv/bin/activate
pip install -r engine/requirements.txt
cd engine        # run everything from inside engine/
```

### 1. Drop your resumes in
Copy your PDFs into `resumes/` with these exact names:
```
resumes/Abhishek_Banaj_da.pdf   (default — Data Analyst)
resumes/Abhishek_Banaj_ba.pdf   (Business Analyst)
resumes/Abhishek_Banaj_ds.pdf   (Data Scientist)
resumes/Abhishek_Banaj_ml.pdf   (ML / AI Engineer)
```

### 2. Gmail access (one time)
1. Go to Google Cloud Console → create a project → **enable the Gmail API**.
2. Create **OAuth client ID → Desktop app** → download the JSON.
3. Save it as `credentials.json` in this folder.
4. First send opens a browser to authorize `abhishekbanaj01@gmail.com`.
   A `token.json` is cached so you're only asked once.

> Gmail caps a personal account around ~500 emails/day and flags bulk cold
> mail fast. Keep `DAILY_BATCH_SIZE` at 30–50. The full 1,842 list drips over
> ~6 weeks — that's normal and gets *better* reply rates than a blast.

## Run

```bash
streamlit run app.py
```

- **Send tab** — upload list, preview the next email, send a batch.
- **Dashboard tab** — refresh to pull reply/bounce status from Gmail.

## Edit your details
Everything (name, links, batch size, roles, resume mapping) lives in
`config.py`. Confirm your LinkedIn/GitHub URLs there before the first send.

## Per-company resume tailoring (later)
This attaches the best-fit *master* resume. True per-company PDF tailoring
needs your **LaTeX or Word source** (rendered PDFs can't be edited cleanly).
Share that and it can be added.
