import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. SERVER-ONLY. Never import in a
// "use client" file or expose the service key to the browser.
// Used to read/write the locked-down gmail_tokens table.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
