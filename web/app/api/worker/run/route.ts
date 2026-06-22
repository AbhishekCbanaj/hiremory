import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// "Send now" — kick off the background worker immediately instead of waiting for
// the 15-min cron. Triggers the GitHub Actions worker via workflow_dispatch so
// all the real send logic (SMTP, AI, caps, warmup, logging) is reused as-is.
//
// Needs: GH_DISPATCH_TOKEN (fine-grained PAT, Actions: read+write on the repo)
//        GITHUB_REPO (default "AbhishekCbanaj/hiremory"), WORKER_WORKFLOW (default "worker.yml")
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const token = process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO || "AbhishekCbanaj/hiremory";
  const workflow = process.env.WORKER_WORKFLOW || "worker.yml";
  if (!token) {
    return NextResponse.json(
      { error: "Instant send isn't configured yet — your campaign is queued and the worker sends it automatically within ~15 minutes." },
      { status: 503 },
    );
  }

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      // dry_run:"false" → the worker sends for real (manual runs default to dry-run)
      body: JSON.stringify({ ref: "main", inputs: { dry_run: "false" } }),
    });
    if (r.status === 204) return NextResponse.json({ ok: true });
    const detail = await r.text();
    return NextResponse.json({ error: `Could not start the worker (${r.status}). ${detail.slice(0, 160)}` }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "trigger failed" }, { status: 502 });
  }
}
