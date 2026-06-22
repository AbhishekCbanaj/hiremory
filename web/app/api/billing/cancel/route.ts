import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Cancels the signed-in user's Razorpay subscription at the end of the current
// billing cycle (they keep Pro until the period they already paid for ends).
// Stripe customers cancel through the Stripe portal (/api/billing/portal).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return NextResponse.json({ error: "Razorpay not configured." }, { status: 503 });

  const { data: profile } = await supabase.from("profiles")
    .select("razorpay_subscription_id").eq("id", user.id).maybeSingle();
  if (!profile?.razorpay_subscription_id) {
    return NextResponse.json({ error: "No active subscription to cancel." }, { status: 400 });
  }

  try {
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    // second arg = cancel at cycle end (keep access until the paid period ends)
    await rzp.subscriptions.cancel(profile.razorpay_subscription_id, true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "cancel failed" }, { status: 502 });
  }
}
