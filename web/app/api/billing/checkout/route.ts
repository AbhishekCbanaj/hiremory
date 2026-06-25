import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { STRIPE_PRICE_PRO, STRIPE_PRICE_TOPUP } from "@/lib/billing";

export const runtime = "nodejs";

// Creates a Stripe Checkout session for the signed-in user (subscription or
// one-time top-up). Returns the hosted-checkout URL for the client to open.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "topup" ? "topup" : "subscription";
  const origin = new URL(request.url).origin;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  const price = kind === "topup" ? STRIPE_PRICE_TOPUP : STRIPE_PRICE_PRO;
  if (!price) return NextResponse.json({ error: "Stripe price not configured." }, { status: 503 });

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: kind === "topup" ? "payment" : "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { user_id: user.id, kind },
      success_url: `${origin}/billing?billing=success`,
      cancel_url: `${origin}/billing?billing=cancelled`,
    });
    return NextResponse.json({ provider: "stripe", url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 });
  }
}
