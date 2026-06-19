# Getting Started

Run Hiremory locally, end to end. You'll have the web app on `localhost:3000` and the worker
sending from a real mailbox.

## Prerequisites
- **Node.js 18+** and npm
- **Python 3.12+**
- A free **[Supabase](https://supabase.com)** project
- (Optional) a free **[Gemini API key](https://aistudio.google.com/app/apikey)** for AI drafts
- A mailbox with an **app password** (Gmail, Outlook, Zoho, or any SMTP/IMAP provider)

## 1. Clone
```bash
git clone https://github.com/<owner>/hiremory.git
cd hiremory
```

## 2. Set up the database
1. Create a Supabase project.
2. Apply every migration in [`supabase/migrations/`](../supabase/migrations/) **in order**
   (Supabase SQL editor, or the Supabase CLI). Details in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
3. Grab your project URL, anon key, and service-role key from Settings → API.

## 3. Run the web app
```bash
cd web
npm install
cp .env.local.example .env.local     # then fill in the values
npm run dev                          # http://localhost:3000
```
Fill `.env.local` using [configuration.md](configuration.md). At minimum you need the three
Supabase values and `MAILBOX_ENC_KEY`.

Now sign up, complete onboarding (name, links, resume text), and connect a mailbox under
**Mailbox** — see [pages/mailbox.md](pages/mailbox.md) for per-provider app-password steps.

## 4. Run the worker
In a second terminal:
```bash
cd worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # fill in the values
python main.py
```
The worker needs the **same** `MAILBOX_ENC_KEY` as the web app (otherwise it can't decrypt
mailbox secrets) plus the Supabase URL + service-role key. See [worker/overview.md](worker/overview.md).

## 5. Send your first campaign
1. Go to **Compose**, paste a few test email addresses (quick mode), and review the draft.
2. Save the campaign.
3. Run `python main.py` — the **send** phase picks it up and sends from your mailbox.
4. Check **Dashboard** for status; **Replies** once recruiters respond.

## Generate a `MAILBOX_ENC_KEY`
A 32-byte base64 key:
```bash
python3 -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"
```
Use the **same value** in `web/.env.local` and `worker/.env`.

## Troubleshooting
- **Mailbox connect fails to encrypt** → `MAILBOX_ENC_KEY` missing from `web/.env.local`.
- **Worker can't decrypt** → web and worker keys don't match.
- **AI produces a generic template** → no `GEMINI_API_KEY` set (this is the intended fallback).
- **Migration "column not found"** → a migration wasn't applied; re-run them in order.
