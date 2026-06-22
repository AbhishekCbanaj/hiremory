// Server-side error monitoring (Sentry), fully env-gated: if SENTRY_DSN is
// unset this is a no-op, so the app runs identically until you add a key.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  }
}

export const onRequestError = process.env.SENTRY_DSN
  ? Sentry.captureRequestError
  : undefined;
