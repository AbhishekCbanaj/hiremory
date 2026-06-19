# Hiremory Documentation

Welcome to the Hiremory docs. Everything you need to understand, run, deploy, and
contribute to the project lives here.

> New here? Start with the [project README](../README.md) for the 30-second pitch,
> then come back for depth.

## 📚 Table of contents

### Core guides
| Guide | What it covers |
|---|---|
| [Architecture](architecture.md) | How the pieces fit: web, worker, database, AI |
| [Getting Started](getting-started.md) | Run Hiremory locally, end to end |
| [Configuration](configuration.md) | Every environment variable, explained |
| [Deployment](deployment.md) | Ship to Vercel + run the worker for free |
| [Supabase Setup](SUPABASE_SETUP.md) | Create and wire up the backend |

### Page-by-page (the app, section by section)
Each page of the app has its own doc — what the user does there, and how it works under the hood.

| Page | Doc |
|---|---|
| Landing | [pages/landing.md](pages/landing.md) |
| Sign up / Log in / Reset password | [pages/auth.md](pages/auth.md) |
| Onboarding & Profile | [pages/onboarding.md](pages/onboarding.md) |
| Compose | [pages/compose.md](pages/compose.md) |
| Dashboard | [pages/dashboard.md](pages/dashboard.md) |
| Analytics | [pages/analytics.md](pages/analytics.md) |
| Replies | [pages/replies.md](pages/replies.md) |
| Follow-ups | [pages/followups.md](pages/followups.md) |
| Mailbox | [pages/mailbox.md](pages/mailbox.md) |
| Settings | [pages/settings.md](pages/settings.md) |
| Privacy | [pages/privacy.md](pages/privacy.md) |

### Under the hood
| Topic | Doc |
|---|---|
| The Python worker | [worker/overview.md](worker/overview.md) |
| Database schema | [database/schema.md](database/schema.md) |
| Email automation (deep dive) | [Email_automation.md](Email_automation.md) |

### Contributing
| Doc | |
|---|---|
| [Contributing guide](../CONTRIBUTING.md) | How to set up and submit changes |
| [Code of Conduct](../CODE_OF_CONDUCT.md) | Community standards |
| [Security policy](../SECURITY.md) | Reporting vulnerabilities |

### Reference
- [Legacy Streamlit engine](engine-legacy.md) — the original prototype (`engine/`), kept for reference.

## How these docs are organized

```
docs/
├── README.md            ← you are here (index)
├── architecture.md      system overview
├── getting-started.md   local setup
├── configuration.md     env vars
├── deployment.md        Vercel + worker
├── SUPABASE_SETUP.md    backend setup
├── Email_automation.md  deep dive
├── engine-legacy.md     legacy prototype
├── pages/               one doc per app page
├── worker/              the Python sender
└── database/            schema & migrations
```
