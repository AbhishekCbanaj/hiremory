import { NextResponse } from "next/server";
import Stripe from "stripe";
import Razorpay from "razorpay";
import { createClient } from "@/lib/supabase/server";
import {
  PRICING, providerForCountry, STRIPE_PRICE_PRO, STRIPE_PRICE_TOPUP, RAZORPAY_PLAN_PRO,
} from "@/lib/billing";

export const runtime = "nodejs";

// Creates a checkout for the signed-in user. Routes India → Razorpay (INR),
// rest of world → Stripe (USD). Returns what the client needs to open checkout.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "topup" ? "topup" : "subscription";

  // Country from Vercel's geo header (override via body.country only for local testing).
  const country = body.country || request.headers.get("x-vercel-ip-country");
  const provider = providerForCountry(country);
  const origin = new URL(request.url).origin;

  try {
    if (provider === "stripe") {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
      const stripe = new Stripe(key);
      const price = kind === "topup" ? STRIPE_PRICE_TOPUP : STRIPE_PRICE_PRO;
      if (!price) return NextResponse.json({ error: "Stripe price not configured." }, { status: 503 });

      const session = await stripe.checkout.sessions.create({
        mode: kind === "topup" ? "payment" : "subscription",
        line_items: [{ price, quantity: 1 }],
        client_reference_id: user.id,
        customer_email: user.email ?? undefined,
        metadata: { user_id: user.id, kind },
        success_url: `${origin}/settings?billing=success`,
        cancel_url: `${origin}/settings?billing=cancelled`,
      });
      return NextResponse.json({ provider: "stripe", url: session.url });
    }

    // ---- Razorpay (INR) ----
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return NextResponse.json({ error: "Razorpay not configured." }, { status: 503 });
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const notes = { user_id: user.id, kind };

    if (kind === "topup") {
      const order = await rzp.orders.create({
        amount: PRICING.topup.inr, currency: "INR", notes,
      });
      return NextResponse.json({
        provider: "razorpay", kind, keyId, orderId: order.id, amount: order.amount, email: user.email,
      });
    }

    if (!RAZORPAY_PLAN_PRO) return NextResponse.json({ error: "Razorpay plan not configured." }, { status: 503 });
    const sub = await rzp.subscriptions.create({
      plan_id: RAZORPAY_PLAN_PRO, total_count: 12, customer_notify: 1, notes,
    });
    return NextResponse.json({
      provider: "razorpay", kind, keyId, subscriptionId: sub.id, email: user.email,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 });
  }
}
