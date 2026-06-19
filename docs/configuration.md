# Configuration

All configuration is via environment variables. The web app reads `web/.env.local`;
the worker reads `worker/.env`. Templates are provided as `.env.local.example` and
`.env.example` — copy them and fill in.

> 🔒 Never commit real `.env` files. They're git-ignored (`**/.env`, `**/.env.local`).

## Web (`web/.env.local`)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Admin key for server actions — **server-side only, never expose** |
| `MAILBOX_ENC_KEY` | ✅ | AES-256 key (base64, 32 bytes) for encrypting mailbox secrets |
| `GEMINI_API_KEY` | ⬜ | Free Gemini key — enables AI email drafts and resume tailoring |
| `GEMINI_MODEL` | ⬜ | Defaults to `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | ⬜ | Optional paid fallback if no Gemini key |
| `STRIPE_WEBHOOK_SECRET` | ⬜ | Only if you enable billing |
| `NEXT_PUBLIC_STRIPE_PRO_LINK` | ⬜ | Only if you enable billing |

## Worker (`worker/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Admin key (worker reads/writes all tenants' rows) |
| `MAILBOX_ENC_KEY` | ✅ | **Must match** the web app's value, or decryption fails |
| `APP_BASE_URL` | ✅ | Public app URL — used to build unsubscribe links |
| `GEMINI_API_KEY` | ⬜ | AI personalization (same behavior as web) |
| `GEMINI_MODEL` | ⬜ | Defaults to `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | ⬜ | Optional paid fallback |
| `SENTRY_DSN` | ⬜ | Error reporting |
| `DRY_RUN` | ⬜ | Set to `1` to log actions without sending |

## The two keys that must match

`MAILBOX_ENC_KEY` is shared: the web app **encrypts** mailbox passwords with it, the worker
**decrypts** with it. If they differ, the worker can't read mailbox secrets and sends fail.
Generate once and reuse:

```bash
python3 -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"
```

## AI provider precedence

The same logic runs in both apps:

```
GEMINI_API_KEY set?  → use Gemini   (free, default)
else ANTHROPIC_API_KEY set? → use Claude  (paid)
else → built-in template            (always works, no key needed)
```

`gemini-2.5-flash` is a *thinking* model; Hiremory sets `thinkingBudget: 0` so output isn't
truncated by reasoning tokens. Don't change the model unless you've tested quota and output limits.
