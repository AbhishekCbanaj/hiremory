// Shared billing config. SERVER-SAFE (no secrets here — just prices/IDs/rules).
// Stripe is the only payment provider.

export const TOPUP_CREDITS = 500; // emails granted per one-time top-up pack

// Prices in MINOR units (cents).
export const PRICING = {
  pro: { usd: 900 },   // $9 / month
  topup: { usd: 500 }, // $5 for TOPUP_CREDITS emails
} as const;

// Monthly send caps per plan — must match worker/main.py PLAN_LIMITS.
export const PLAN_CAP: Record<string, number> = { free: 50, pro: 1500, teams: 100000 };

export type Provider = "stripe";
export type Kind = "subscription" | "topup";

// Stripe dashboard price IDs, supplied via env (kept out of source).
export const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO;     // recurring price_...
export const STRIPE_PRICE_TOPUP = process.env.STRIPE_PRICE_TOPUP; // one-time price_...
