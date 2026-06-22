import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { fulfill, setPlanFree } from "@/lib/fulfill";

export const runtime = "nodejs";

// Razorpay webhook. Verifies HMAC-SHA256(raw body, RAZORPAY_WEBHOOK_SECRET)
// against the x-razorpay-signature header, then fulfills idempotently.
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "billing not configured" }, { status: 503 });

  const raw = await request.text();
  const sig = request.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const body = JSON.parse(raw);
  const event: string = body.event ?? "";
  // Stable across retries of the same event; fall back to the entity id.
  const eventId = request.headers.get("x-razorpay-event-id");

  try {
    if (event === "payment.captured") {
      const p = body.payload?.payment?.entity ?? {};
      // Only one-time top-ups are fulfilled here (we tag them in notes at order creation).
      // Subscription cycle payments are handled via subscription.* events.
      if (p.notes?.kind === "topup") {
        await fulfill({
          provider: "razorpay",
          ref: eventId ?? p.id,
          userId: p.notes?.user_id ?? null,
          kind: "topup",
          amount: p.amount,
          currency: p.currency,
          status: "captured",
        });
      }
    } else if (event === "subscription.charged" || event === "subscription.activated") {
      const sub = body.payload?.subscription?.entity ?? {};
      await fulfill({
        provider: "razorpay",
        ref: eventId ?? `${sub.id}:${event}`,
        userId: sub.notes?.user_id ?? null,
        kind: "subscription",
        status: "active",
        extra: { razorpay_subscription_id: sub.id, razorpay_customer_id: sub.customer_id ?? null },
      });
    } else if (
      event === "subscription.cancelled" ||
      event === "subscription.halted" ||
      event === "subscription.completed"
    ) {
      const sub = body.payload?.subscription?.entity ?? {};
      if (sub.id) await setPlanFree({ column: "razorpay_subscription_id", value: sub.id }, event.split(".")[1]);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fulfillment failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
