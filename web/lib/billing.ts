// Shared billing config. SERVER-SAFE (no secrets here — just prices/IDs/rules).
// Provider routing: India → Razorpay (INR), everyone else → Stripe (USD).

export const TOPUP_CREDITS = 500; // emails granted per one-time top-up pack

// Prices in MINOR units (paise / cents).
export const PRICING = {
  pro: { inr: 49900, usd: 900 }, // ₹499 / $9 per month
  topup: { inr: 29900, usd: 500 }, // ₹299 / $5 for TOPUP_CREDITS emails
} as const;

// Monthly send caps per plan — must match worker/main.py PLAN_LIMITS.
export const PLAN_CAP: Record<string, number> = { free: 50, pro: 1500, teams: 100000 };

export type Provider = "stripe" | "razorpay";
export type Kind = "subscription" | "topup";

// India pays via Razorpay (INR); the rest of the world via Stripe (USD).
export function providerForCountry(country?: string | null): Provider {
  return (country ?? "").toUpperCase() === "IN" ? "razorpay" : "stripe";
}

export function currencyFor(provider: Provider): "inr" | "usd" {
  return provider === "razorpay" ? "inr" : "usd";
}

// Dashboard-created IDs, supplied via env (kept out of source).
export const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO; // recurring price_...
export const STRIPE_PRICE_TOPUP = process.env.STRIPE_PRICE_TOPUP; // one-time price_...
export const RAZORPAY_PLAN_PRO = process.env.RAZORPAY_PLAN_PRO; // subscription plan_...
