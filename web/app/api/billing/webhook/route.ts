import { NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfill, setPlanFree } from "@/lib/fulfill";

export const runtime = "nodejs";

// Stripe webhook. Verifies the signature with the SDK, then fulfills via the
// idempotent helper (payments table dedupes redelivered events).
// Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return NextResponse.json({ error: "billing not configured" }, { status: 503 });

  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  const stripe = new Stripe(key);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const kind = s.metadata?.kind === "topup" ? "topup" : "subscription";
      const userId = s.client_reference_id ?? s.metadata?.user_id ?? null;
      await fulfill({
        provider: "stripe",
        ref: event.id,
        userId,
        kind,
        amount: s.amount_total ?? undefined,
        currency: s.currency ?? undefined,
        status: "paid",
        extra: typeof s.customer === "string" ? { stripe_customer_id: s.customer } : undefined,
      });
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      if (sub.status !== "active" && sub.status !== "trialing") {
        await setPlanFree({ column: "stripe_customer_id", value: customer }, sub.status);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await setPlanFree({ column: "stripe_customer_id", value: customer }, "canceled");
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fulfillment failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
