import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Handles two auth flows that land here:
//  1. OAuth / PKCE      -> ?code=...            (exchangeCodeForSession)
//  2. Email links       -> ?token_hash=&type=  (verifyOtp: signup confirm, recovery, magic link)
// then redirects to ?next (default by flow).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? (type === "recovery" ? "/reset-password" : "/dashboard");
  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      await storeGmailTokens(data.session);
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

// Persist the Google provider tokens into the locked gmail_tokens table.
// provider_refresh_token only arrives when access_type=offline + prompt=consent
// (set in the login flow); we keep any existing one if Google omits it on re-auth.
async function storeGmailTokens(session: {
  user: { id: string; email?: string };
  provider_token?: string | null;
  provider_refresh_token?: string | null;
  expires_at?: number;
}) {
  const refresh = session.provider_refresh_token ?? null;
  const access = session.provider_token ?? null;
  if (!access && !refresh) return; // nothing to store (e.g. email/password)

  const admin = createAdminClient();
  const expiry = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;

  const row: Record<string, unknown> = {
    user_id: session.user.id,
    email: session.user.email ?? "",
    access_token: access,
    expiry,
    updated_at: new Date().toISOString(),
  };
  // Only overwrite the refresh token when Google actually returns a new one,
  // so a silent re-login doesn't wipe the long-lived token.
  if (refresh) row.refresh_token = refresh;

  const { error } = await admin.from("gmail_tokens").upsert(row, { onConflict: "user_id" });
  if (error) console.error("[auth/callback] gmail_tokens upsert failed:", error.message);
  else console.log("[auth/callback] stored Gmail token for", session.user.email, "refresh?", !!refresh);
}
