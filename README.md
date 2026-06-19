# ApplyLoop

Personalized job-outreach automation: email each recruiter individually,
follow up automatically, and send your resume the moment they say yes.

## Project map

```
HR_Job_Automation/
├── engine/     Python automation (parse, send, follow-ups, auto-resume) + Streamlit app
├── web/        Next.js SaaS frontend (landing, compose, dashboard) — the product
├── supabase/   Database schema + storage policies (migrations)
└── docs/       All documentation
```

## Where to start

| I want to… | Go to |
|---|---|
| Understand the whole system | [docs/Email_automation.md](docs/Email_automation.md) |
| Run the local Python tool | [docs/README.md](docs/README.md) |
| Set up the cloud backend (Supabase) | [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) |
| Run the website locally | `cd web && npm run dev` |

## Quick run — local Python tool
```bash
cd engine
source ../.venv/bin/activate      # or: python3 -m venv ../.venv && pip install -r requirements.txt
streamlit run app.py
```

## Quick run — website
```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

> Secrets (`engine/credentials.json`, `engine/token.json`, `.env.local`) are
> git-ignored. Never commit them.
