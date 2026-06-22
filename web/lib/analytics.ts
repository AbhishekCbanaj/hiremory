import posthog from "posthog-js";

// Fire a custom product event (e.g. track("signup_started")). No-op on the
// server or when PostHog isn't configured, so it's safe to call anywhere.
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try { posthog.capture(event, props); } catch { /* analytics must never break UX */ }
}
