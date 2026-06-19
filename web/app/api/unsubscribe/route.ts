import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsub } from "@/lib/unsub";

// Public, no auth. A recruiter unsubscribes via the link (GET, browser) or the
// native Gmail/Apple "unsubscribe" button (POST, RFC 8058 one-click). Both add
// them to that user's suppression list so the worker never contacts them again.
async function suppress(request: Request): Promise<boolean> {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get("u") ?? "";
  const e = (searchParams.get("e") ?? "").toLowerCase();
  const t = searchParams.get("t") ?? "";
  if (!u || !e || !t || !verifyUnsub(u, e, t)) return false;
  const admin = createAdminClient();
  await admin.from("suppressions").upsert(
    { user_id: u, email: e, reason: "unsubscribe" },
    { onConflict: "user_id,email" },
  );
  return true;
}

export async function GET(request: Request) {
  const ok = await suppress(request);
  return ok
    ? html("You've been unsubscribed. You will receive no further emails.", 200)
    : html("This unsubscribe link is invalid or expired.", 400);
}

// RFC 8058 one-click: mail clients POST here. No HTML body needed — just 200.
export async function POST(request: Request) {
  const ok = await suppress(request);
  return new NextResponse(null, { status: ok ? 200 : 400 });
}

function html(message: string, status: number) {
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Unsubscribe</title></head>
     <body style="font-family:system-ui;background:#0B1020;color:#E8ECF5;display:grid;place-items:center;height:100vh;margin:0">
     <div style="max-width:420px;text-align:center;padding:2rem">
       <div style="font-size:2rem;margin-bottom:1rem">✉️</div>
       <p style="font-size:1.05rem;line-height:1.5">${message}</p>
     </div></body></html>`,
    { status, headers: { "Content-Type": "text/html" } },
  );
}
