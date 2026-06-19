# Landing page (`/`)

The marketing home page — Hiremory's pitch to a first-time visitor.

## What the visitor sees
- **Hero** — the core promise: "Reach every recruiter with a letter, not a blast," with a primary CTA.
- **The gap** — old way vs. honest truth vs. the Hiremory way.
- **How it works** — the four steps (connect mailbox → add recipients → review the email → let the loop close).
- **Two ways to send** — bulk (CSV) vs. quick (paste a few emails).
- **Why it lands** — personalization, follow-ups, auto-resume, honest tracking.
- **Pricing** — Free / Pro / Teams.
- **Final CTA** and footer.

## Under the hood
- **File:** [`web/app/page.tsx`](../../web/app/page.tsx)
- **CTA component:** [`web/components/HeroCta.tsx`](../../web/components/HeroCta.tsx) — adapts to auth state.
- **Nav:** [`web/components/Nav.tsx`](../../web/components/Nav.tsx) — shows Log in / Sign up when signed out, app links when signed in.
- **Theme:** colors and type come from [`web/tailwind.config.ts`](../../web/tailwind.config.ts) and
  [`web/app/globals.css`](../../web/app/globals.css) — the "Momentum" light-emerald theme. Edit tokens there, not inline.

## Notes for contributors
- Keep copy benefit-led and honest — don't overstate sending limits or automation.
- All brand color/typography is token-driven; never hardcode hex values in the page.
