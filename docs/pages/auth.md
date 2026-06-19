# Authentication (`/signup`, `/login`, `/forgot-password`, `/reset-password`)

Email/password authentication, backed by Supabase Auth. (Google OAuth was deliberately
dropped to avoid verification cost and friction.)

## The screens
| Route | Purpose |
|---|---|
| `/signup` | Create an account with email + password |
| `/login` | Sign in |
| `/forgot-password` | Request a reset email |
| `/reset-password` | Set a new password from the emailed link |

## Flow
1. User signs up → Supabase creates the auth user.
2. After sign-in, the app redirects into the product (Dashboard/Onboarding).
3. Forgot password → Supabase sends a reset link → `/reset-password` completes it.

## Under the hood
- **Files:** [`web/app/signup/page.tsx`](../../web/app/signup/page.tsx),
  [`login`](../../web/app/login/page.tsx),
  [`forgot-password`](../../web/app/forgot-password/page.tsx),
  [`reset-password`](../../web/app/reset-password/page.tsx)
- **Callback:** `web/app/auth/callback` (exchanges the code for a session);
  `web/app/auth/signout` clears it.
- **Clients:** `web/lib/supabase/` (server + browser via `@supabase/ssr`).
- **Middleware:** [`web/proxy.ts`](../../web/proxy.ts) keeps the session fresh.

## Gotchas
- **Post-auth redirect race:** navigate with `window.location.assign(...)` after sign-in so the
  server sees the session cookie before the protected route loads (a client-side `router.push`
  can fire too early).
- **Reset links point at localhost?** Set the Supabase **Site URL** + **Redirect URLs** to your
  deployed domain — see [deployment.md](../deployment.md).
