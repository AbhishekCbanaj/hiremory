import crypto from "crypto";

// Verify unsubscribe tokens minted by the worker (worker/links.py). Same HMAC
// over "<user_id>:<email>" keyed by MAILBOX_ENC_KEY. SERVER-ONLY.
export function unsubToken(userId: string, email: string): string {
  const key = Buffer.from(process.env.MAILBOX_ENC_KEY!, "base64");
  return crypto.createHmac("sha256", key)
    .update(`${userId}:${email.toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsub(userId: string, email: string, token: string): boolean {
  const expected = unsubToken(userId, email);
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
