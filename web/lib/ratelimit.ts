import type { SupabaseClient } from "@supabase/supabase-js";

// Lightweight per-user rate limit for the AI routes, backed by the `events`
// table (no new infra). Counts this user's recent calls of `key`; if under the
// limit it logs one and returns true, else returns false. Fails OPEN on error
// (never block a real user because of a logging hiccup).
export async function rateLimit(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  max = 15,
  windowSec = 60,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("name", key)
      .gte("created_at", since);
    if ((count ?? 0) >= max) return false;
    await supabase.from("events").insert({ user_id: userId, name: key });
    return true;
  } catch {
    return true;
  }
}
