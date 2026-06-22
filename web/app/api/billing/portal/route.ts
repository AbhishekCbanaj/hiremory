import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Opens the Stripe Customer Portal for the signed-in user — Stripe-hosted, so
// it handles cancellation, card updates, and invoice/receipt downloads natively.
// Only relevant to Stripe (international) customers; Razorpay users cancel via
// /api/billing/cancel.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });

  const { data: profile } = await supabase.from("profiles")
    .select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer on file yet." }, { status: 400 });
  }

  try {
    const stripe = new Stripe(key);
    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "portal failed" }, { status: 502 });
  }
}
