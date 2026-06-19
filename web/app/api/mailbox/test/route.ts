import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

// Verify SMTP credentials BEFORE saving, so a bad app password is caught here
// instead of silently failing when the worker runs. Logs in but sends nothing.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 }); }

  const host = String(b.smtp_host ?? "").trim();
  const port = Number(b.smtp_port) || 465;
  const user_ = String(b.email ?? "").trim();
  const pass = String(b.app_password ?? "").replace(/\s+/g, ""); // app passwords often shown with spaces
  if (!host || !user_ || !pass) {
    return NextResponse.json({ ok: false, error: "Enter email, app password and SMTP host first." }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,           // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: user_, pass },
    connectionTimeout: 12000, greetingTimeout: 12000,
  });

  try {
    await transporter.verify();   // opens connection + logs in, no email sent
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // give a friendly hint for the most common Gmail failure
    const hint = /username and password not accepted|badcredentials|535/i.test(msg)
      ? "Login rejected. Use a Gmail App Password (needs 2-Step Verification on), not your normal password."
      : msg;
    return NextResponse.json({ ok: false, error: hint });
  }
}
