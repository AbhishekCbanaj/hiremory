"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Preset = {
  smtp_host: string; smtp_port: number; imap_host: string; imap_port: number;
  link: string; steps: string[];
};

// Provider presets + the exact "create an app password" deep link & steps.
const PRESETS: Record<string, Preset> = {
  Gmail: {
    smtp_host: "smtp.gmail.com", smtp_port: 465, imap_host: "imap.gmail.com", imap_port: 993,
    link: "https://myaccount.google.com/apppasswords",
    steps: [
      "Turn on 2-Step Verification (Google Account → Security) — app passwords need it.",
      "Open the App Passwords page (button below) and create one named “ApplyLoop”.",
      "Copy the 16-character password and paste it in App password. Not your normal password.",
    ],
  },
  Outlook: {
    smtp_host: "smtp.office365.com", smtp_port: 587, imap_host: "outlook.office365.com", imap_port: 993,
    link: "https://account.microsoft.com/security",
    steps: [
      "Turn on Two-step verification in Microsoft account security.",
      "Create an App password under Advanced security options.",
      "Paste that app password below — not your normal password.",
    ],
  },
  Zoho: {
    smtp_host: "smtp.zoho.com", smtp_port: 465, imap_host: "imap.zoho.com", imap_port: 993,
    link: "https://accounts.zoho.com/home#security/app_password",
    steps: [
      "Enable Two-Factor Authentication in Zoho account security.",
      "Generate an Application-Specific Password.",
      "Paste it below.",
    ],
  },
  Other: {
    smtp_host: "", smtp_port: 465, imap_host: "", imap_port: 993, link: "",
    steps: [
      "Find your provider's SMTP + IMAP host and port (search “<provider> SMTP settings”).",
      "Create an app-specific password if your provider offers one.",
      "Enter the host, port, and password below.",
    ],
  },
};

const DOMAIN_TO_PROVIDER: Record<string, keyof typeof PRESETS> = {
  "gmail.com": "Gmail", "googlemail.com": "Gmail",
  "outlook.com": "Outlook", "hotmail.com": "Outlook", "live.com": "Outlook",
  "zoho.com": "Zoho",
};

type Mailbox = { id: string; email: string; status: string; daily_cap: number };
type TestState = { ok: boolean; msg: string } | null;

export default function Mailbox() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState("");
  const [connected, setConnected] = useState<Mailbox[]>([]);
  const [provider, setProvider] = useState<keyof typeof PRESETS>("Gmail");
  const [f, setF] = useState({
    from_name: "", email: "", app_password: "",
    smtp_host: PRESETS.Gmail.smtp_host, smtp_port: PRESETS.Gmail.smtp_port,
    imap_host: PRESETS.Gmail.imap_host, imap_port: PRESETS.Gmail.imap_port,
    daily_cap: 30,
  });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestState>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function loadMailboxes(id: string) {
    const { data } = await supabase.from("mailboxes")
      .select("id, email, status, daily_cap").eq("user_id", id)
      .order("created_at", { ascending: true });
    setConnected(data ?? []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setReady(true);
      setUid(data.user.id);
      setF((p) => ({ ...p, email: data.user?.email ?? "", from_name: data.user?.user_metadata?.full_name ?? "" }));
      loadMailboxes(data.user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  async function disconnect(id: string) {
    await supabase.from("mailboxes").delete().eq("id", id);
    if (uid) loadMailboxes(uid);
  }

  function applyPreset(name: keyof typeof PRESETS) {
    setProvider(name);
    const p = PRESETS[name];
    setF((prev) => ({ ...prev, smtp_host: p.smtp_host, smtp_port: p.smtp_port, imap_host: p.imap_host, imap_port: p.imap_port }));
  }

  // Auto-detect the provider from the email domain as the user types it.
  function onEmail(value: string) {
    setF((prev) => ({ ...prev, email: value }));
    setTest(null);
    const domain = value.split("@")[1]?.toLowerCase();
    const detected = domain ? DOMAIN_TO_PROVIDER[domain] : undefined;
    if (detected && detected !== provider) applyPreset(detected);
  }

  async function testConnection() {
    if (!f.email || !f.app_password || !f.smtp_host) { setTest({ ok: false, msg: "Enter email, app password and SMTP host first." }); return; }
    setTesting(true); setTest(null);
    const res = await fetch("/api/mailbox/test", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const out = await res.json();
    setTesting(false);
    setTest(out.ok ? { ok: true, msg: "Login works ✓ — safe to save." } : { ok: false, msg: out.error ?? "Connection failed." });
  }

  async function save() {
    if (!f.email || !f.app_password || !f.smtp_host) { setMsg("Error: email, app password and SMTP host are required."); return; }
    setBusy(true); setMsg(null); setWarnings([]);
    const res = await fetch("/api/mailbox/connect", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(`Error: ${out.error ?? "failed"}`); return; }
    setWarnings(out.warnings ?? []);
    setMsg("Mailbox connected. The worker can now send as you.");
    setF((p) => ({ ...p, app_password: "" }));
    setTest(null);
    if (uid) loadMailboxes(uid);
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";
  if (!ready) return <main className="container-x py-14"><p className="text-ink2">Loading…</p></main>;
  const preset = PRESETS[provider];

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Connect your mailbox</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Send from any email, anywhere.</h1>
      <p className="mt-4 max-w-xl text-ink2">
        Works with any provider via an app password — no Google verification, no
        waiting list. Your password is encrypted before it&apos;s stored and is never shown again.
      </p>

      {connected.length > 0 && (
        <div className="mt-8 rounded-xl2 border border-sage/40 bg-sage/10 p-5">
          <p className="font-semibold text-sage">✓ Connected {connected.length === 1 ? "mailbox" : "mailboxes"}</p>
          <ul className="mt-3 space-y-2">
            {connected.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 text-[15px]">
                <span className="text-ink">{m.email}
                  <span className="ml-2 text-[13px] text-ink2">· {m.status} · {m.daily_cap}/day</span>
                </span>
                <button onClick={() => disconnect(m.id)} className="text-[13px] text-clay hover:underline">Disconnect</button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-ink2">Add another below, or re-enter details to update one (the app password is never shown again, so re-enter it to change credentials).</p>
        </div>
      )}

      <h2 className="mt-10 text-2xl">{connected.length ? "Add or update a mailbox" : "Connect your first mailbox"}</h2>
      <div className="mt-4 inline-flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((name) => (
          <button key={name} onClick={() => applyPreset(name)}
            className={`rounded-full px-5 py-2 text-[15px] transition-colors ${provider === name ? "bg-ink text-paper" : "tag hover:text-ink"}`}>
            {name}
          </button>
        ))}
      </div>

      {/* Per-provider numbered steps + deep link */}
      <div className="mt-4 max-w-2xl rounded-xl2 border border-clay/30 bg-clay/10 p-5">
        <p className="text-[14px] font-semibold text-clay">Get your {provider} app password</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] text-clay">
          {preset.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        {preset.link && (
          <a href={preset.link} target="_blank" rel="noopener noreferrer"
            className="btn-ghost mt-3 !py-2 !px-4 text-[13px]">Open {provider} app-passwords →</a>
        )}
      </div>

      <div className="mt-8 grid gap-7 lg:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="text-2xl">Account</h2>
          <Field label="From name"><input className={input} value={f.from_name} onChange={(e) => setF({ ...f, from_name: e.target.value })} placeholder="Abhishek Banaj" /></Field>
          <Field label="Email address *"><input className={input} value={f.email} onChange={(e) => onEmail(e.target.value)} placeholder="you@gmail.com" /></Field>
          <Field label="App password *"><input type="password" className={input} value={f.app_password} onChange={(e) => { setF({ ...f, app_password: e.target.value }); setTest(null); }} placeholder="16-character app password" /></Field>
          <Field label="Daily send cap"><input type="number" className={input} value={f.daily_cap} onChange={(e) => setF({ ...f, daily_cap: Number(e.target.value) })} /></Field>
        </div>

        <div className="card space-y-4">
          <h2 className="text-2xl">Server settings</h2>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="SMTP host *"><input className={input} value={f.smtp_host} onChange={(e) => setF({ ...f, smtp_host: e.target.value })} /></Field>
            <Field label="Port"><input type="number" className={`${input} w-24`} value={f.smtp_port} onChange={(e) => setF({ ...f, smtp_port: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="IMAP host (for reply tracking)"><input className={input} value={f.imap_host} onChange={(e) => setF({ ...f, imap_host: e.target.value })} /></Field>
            <Field label="Port"><input type="number" className={`${input} w-24`} value={f.imap_port} onChange={(e) => setF({ ...f, imap_port: Number(e.target.value) })} /></Field>
          </div>
          <p className="text-[13px] text-ink2">Port 465 = SSL, 587 = STARTTLS. IMAP is optional but needed to detect replies and auto-send your resume.</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button onClick={testConnection} disabled={testing} className="btn-ghost">{testing ? "Testing…" : "Test connection"}</button>
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : connected.length ? "Save mailbox" : "Connect mailbox"}</button>
        <a href="/compose" className="btn-ghost">Go to compose</a>
      </div>
      {test && <p className={`mt-3 text-[14px] ${test.ok ? "text-sage" : "text-clay"}`}>{test.msg}</p>}
      {msg && <p className={`mt-2 text-[14px] ${msg.startsWith("Error") ? "text-clay" : "text-sage"}`}>{msg}</p>}

      {warnings.length > 0 && (
        <div className="mt-6 rounded-xl2 border border-clay/40 bg-clay/10 p-5">
          <p className="font-semibold text-clay">Deliverability warnings</p>
          <ul className="mt-2 space-y-1 text-[14px] text-clay">
            {warnings.map((w) => <li key={w}>• {w}</li>)}
          </ul>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-ink2">{label}</span>
      {children}
    </label>
  );
}
