import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe webhook — no Stripe SDK needed. We verify the signature manually
// (HMAC-SHA256 over `${timestamp}.${rawBody}`) and update the user's plan.
// Set STRIPE_WEBHOOK_SECRET (whsec_...). Use Stripe Payment Links with
// ?client_reference_id=<user_id> so we can map the checkout back to a user.

const PLAN_BY_PRICE: Record<string, string> = {
  // map your Stripe price IDs → plan names, e.g. "price_123": "pro"
};

function verify(raw: string, sig: string | null, secret: string): boolean {
  if (!sig) return false;
  const parts = Object.fromEntries(sig.split(",").map((kv) => kv.split("=")));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  // also guard against replay (>5 min skew)
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return fresh && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "billing not configured" }, { status: 503 });

  const raw = await request.text();
  if (!verify(raw, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const event = JSON.parse(raw);
  const admin = createAdminClient();
  const obj = event.data?.object ?? {};

  // resolve which user this is: client_reference_id (set on the Payment Link) →
  // stripe_customer_id → email
  async function patch(fields: Record<string, unknown>) {
    if (obj.client_reference_id) {
      await admin.from("profiles").update(fields).eq("id", obj.client_reference_id);
    } else if (obj.customer) {
      await admin.from("profiles").update(fields).eq("stripe_customer_id", obj.customer);
    } else if (obj.customer_details?.email || obj.email) {
      await admin.from("profiles").update(fields).eq("email", obj.customer_details?.email ?? obj.email);
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const priceId = obj.line_items?.data?.[0]?.price?.id;
      await patch({
        plan: PLAN_BY_PRICE[priceId] ?? "pro",
        plan_status: "active",
        stripe_customer_id: obj.customer ?? null,
      });
      break;
    }
    case "customer.subscription.updated":
      await patch({ plan_status: obj.status });
      if (obj.status !== "active" && obj.status !== "trialing") await patch({ plan: "free" });
      break;
    case "customer.subscription.deleted":
      await patch({ plan: "free", plan_status: "canceled" });
      break;
  }

  return NextResponse.json({ received: true });
}
