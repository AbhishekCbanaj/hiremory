import crypto from "crypto";
import { cookies } from "next/headers";

// Founder-only admin gate. Credentials live in env (NEVER hardcoded — this repo
// is public). The session is a short-lived HMAC-signed cookie, so a user can't
// forge it. Regular app users have no link to /admin and hit the login wall.
export const ADMIN_COOKIE = "hm_admin";
const TTL = 60 * 60 * 12; // 12 hours

function secret(): string {
  // Reuse the always-present mailbox key for signing, or a dedicated secret.
  return process.env.ADMIN_SESSION_SECRET || process.env.MAILBOX_ENC_KEY || "";
}

// Admin works only once ADMIN_PASSWORD (and a signing secret) are set.
export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD && !!secret();
}

function timingEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab); // keep timing constant on length mismatch
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function checkCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USER || "admin";
  const p = process.env.ADMIN_PASSWORD || "";
  if (!p) return false;
  // evaluate both to avoid short-circuit timing leaks
  const okU = timingEqual(username, u);
  const okP = timingEqual(password, p);
  return okU && okP;
}

export function mintToken(): string {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  const sig = crypto.createHmac("sha256", secret()).update(exp).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyToken(token?: string): boolean {
  if (!token || !secret()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const expected = crypto.createHmac("sha256", secret()).update(exp).digest("base64url");
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const n = parseInt(exp, 10);
  return Number.isFinite(n) && n > Math.floor(Date.now() / 1000);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(ADMIN_COOKIE)?.value);
}

export const ADMIN_MAX_AGE = TTL;
