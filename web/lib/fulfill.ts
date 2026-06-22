import { createAdminClient } from "@/lib/supabase/admin";
import { TOPUP_CREDITS, type Provider, type Kind } from "@/lib/billing";

type FulfillOpts = {
  provider: Provider;
  ref: string; // event/payment id — the idempotency key
  userId: string | null;
  kind: Kind;
  amount?: number;
  currency?: string;
  status?: string;
  extra?: Record<string, unknown>; // extra profile fields (customer ids, renews_at)
};

// Idempotent fulfillment. Inserts a unique (provider, ref) payment row first;
// if that row already exists (redelivered webhook) it bails without re-applying.
// Then upgrades the plan (subscription) and/or grants top-up credits (topup).
export async function fulfill(opts: FulfillOpts): Promise<boolean> {
  const admin = createAdminClient();
  const credits = opts.kind === "topup" ? TOPUP_CREDITS : 0;

  const { error } = await admin.from("payments").insert({
    user_id: opts.userId,
    provider: opts.provider,
    provider_ref: opts.ref,
    kind: opts.kind,
    amount: opts.amount ?? null,
    currency: opts.currency ?? null,
    credits_added: credits,
    status: opts.status ?? null,
  });
  if (error) {
    if (error.code === "23505") return false; // already processed this event
    throw new Error(error.message);
  }
  if (!opts.userId) return true; // logged, but no user to update

  const fields: Record<string, unknown> = { billing_provider: opts.provider, ...(opts.extra ?? {}) };
  if (opts.kind === "subscription") {
    fields.plan = "pro";
    fields.plan_status = "active";
  }
  await admin.from("profiles").update(fields).eq("id", opts.userId);

  if (credits > 0) {
    const { data } = await admin.from("profiles").select("email_credits").eq("id", opts.userId).maybeSingle();
    await admin.from("profiles").update({ email_credits: (data?.email_credits ?? 0) + credits }).eq("id", opts.userId);
  }
  return true;
}

// Subscription lapsed/cancelled → back to free. Safe to call repeatedly.
export async function setPlanFree(match: { column: string; value: string }, status: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("profiles").update({ plan: "free", plan_status: status }).eq(match.column, match.value);
}

// Resolve a user id from a provider customer/subscription id stored on the profile.
export async function userIdByProfileField(column: string, value: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq(column, value).maybeSingle();
  return data?.id ?? null;
}
