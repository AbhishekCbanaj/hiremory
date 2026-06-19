import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { authWarnings } from "@/lib/dnsCheck";

// Save (or update) the signed-in user's SMTP/IMAP mailbox. The app password is
// encrypted server-side before it ever touches the database. RLS ensures the
// row belongs to the caller; the secret is stored only as ciphertext.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const email = String(b.email ?? "").trim();
  const secret = String(b.app_password ?? "").trim();
  const smtp_host = String(b.smtp_host ?? "").trim();
  const imap_host = String(b.imap_host ?? "").trim();
  if (!email || !secret || !smtp_host) {
    return NextResponse.json({ error: "email, app_password and smtp_host are required" }, { status: 400 });
  }

  let secret_enc: string;
  try {
    secret_enc = encryptSecret(secret);
  } catch (e) {
    // almost always a missing/invalid MAILBOX_ENC_KEY
    return NextResponse.json({ error: `encryption failed: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }

  const row = {
    user_id: user.id,
    transport: "smtp",
    from_name: String(b.from_name ?? "").trim() || null,
    email,
    smtp_host,
    smtp_port: Number(b.smtp_port) || 465,
    imap_host: imap_host || null,
    imap_port: Number(b.imap_port) || 993,
    secret_enc,
    daily_cap: Number(b.daily_cap) || 30,
    status: "active",
  };

  // one mailbox per (user, email): update if it exists, else insert
  const { data: existing } = await supabase
    .from("mailboxes").select("id").eq("user_id", user.id).eq("email", email).maybeSingle();

  const q = existing
    ? supabase.from("mailboxes").update(row).eq("id", existing.id)
    : supabase.from("mailboxes").insert(row);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("events").insert({ user_id: user.id, name: "mailbox_connected" });
  const warnings = await authWarnings(email);
  return NextResponse.json({ ok: true, warnings });
}
