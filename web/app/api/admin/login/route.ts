import { NextResponse } from "next/server";
import { checkCredentials, mintToken, adminConfigured, ADMIN_COOKIE, ADMIN_MAX_AGE } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin isn't configured yet. Set ADMIN_PASSWORD (and MAILBOX_ENC_KEY)." }, { status: 503 });
  }

  const { username, password } = await request.json().catch(() => ({}));
  if (!checkCredentials(String(username || ""), String(password || ""))) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, mintToken(), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: ADMIN_MAX_AGE,
  });
  return res;
}
