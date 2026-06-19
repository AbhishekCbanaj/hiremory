# Settings (`/settings`)

Account and plan management.

## What it covers
- Account details and sign-out.
- Plan / billing (Free / Pro / Teams) — billing wiring is optional and only active if Stripe env vars are set.
- Sending preferences (where exposed).

## Under the hood
- **File:** [`web/app/settings/page.tsx`](../../web/app/settings/page.tsx)
- **Billing:** gated by `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PRO_LINK`; the `billing`
  migration adds the `plan` column. Without Stripe configured, the app runs entirely on the Free tier.
- **Tables:** `profiles` / billing columns.

## Gotchas
- Billing is opt-in — leaving the Stripe vars empty is fine for self-hosting; everyone is Free.
