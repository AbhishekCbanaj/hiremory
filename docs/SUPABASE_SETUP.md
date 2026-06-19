# Supabase setup (free tier) — ~10 min

Everything below is on Supabase's free plan. Do these once.

## 1. Create the project
1. Go to https://supabase.com → sign in with GitHub → **New project**.
2. Name it `applyloop`, pick a region near you, set a DB password (save it).
3. Wait ~2 min for it to provision.

## 2. Run the database schema
1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/0001_init.sql` → **Run**.
3. New query → paste `supabase/migrations/0002_storage.sql` — but first do step 3 below (the bucket must exist).

## 3. Create the resume storage bucket
1. Left sidebar → **Storage** → **New bucket**.
2. Name: `resumes`. **Uncheck "Public bucket"** (keep it private). Create.
3. Now run `0002_storage.sql` from the SQL editor.

## 4. Turn on Google login
1. Left sidebar → **Authentication** → **Providers** → **Google** → enable.
2. Paste your Google OAuth **Client ID** and **Client Secret** (from the same
   Google Cloud project you already made).
3. In Google Cloud → Credentials → your OAuth client → **Authorized redirect URIs**,
   add:  `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   (copy the exact URL Supabase shows on the Google provider page).
4. Add the Gmail scopes on the Google consent screen if not already:
   `.../auth/gmail.send` and `.../auth/gmail.readonly`.

## 5. Wire the keys into the web app
1. Supabase → **Project Settings → API**. Copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep secret)
2. In `web/`, copy `.env.local.example` to `.env.local` and fill those in.
3. `npm run dev` → open http://localhost:3000 → **Sign in with Google**.

## What works after this
- Google login creates a `profiles` row automatically.
- Protected pages (`/dashboard`, `/compose`, ...) redirect to `/login` if signed out.
- RLS guarantees every user sees only their own data.

## Still to come (next milestones)
- Compose → actually save campaign + contacts + resume to Supabase.
- GitHub Actions worker → read due work, send via Gmail, write results back.
- Dashboard/Follow-ups/Replies → show real rows instead of samples.
