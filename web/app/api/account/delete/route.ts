import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GDPR / India DPDP "delete my data". Wipes the signed-in user's data and the
// auth account. Most tables cascade from auth.users on delete, but we also
// clear Storage objects (which don't cascade) and then delete the auth user.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const uid = user.id;

  // 1. Storage: remove the user's resume folder (not covered by FK cascade)
  try {
    const { data: files } = await admin.storage.from("resumes").list(uid);
    if (files?.length) {
      await admin.storage.from("resumes").remove(files.map((f) => `${uid}/${f.name}`));
    }
  } catch { /* best-effort */ }

  // 2. Delete the auth user — cascades to profiles, gmail_tokens, resumes,
  //    campaigns, contacts, send_log, mailboxes, suppressions, events.
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ deleted: true });
}
