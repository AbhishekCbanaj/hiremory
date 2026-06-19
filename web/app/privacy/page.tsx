export const metadata = { title: "Privacy — ApplyLoop" };

export default function Privacy() {
  return (
    <main className="container-x py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Privacy &amp; your data</h1>
      <div className="mt-8 max-w-2xl space-y-6 text-ink2 [&_h2]:text-ink [&_h2]:text-xl [&_h2]:font-display">
        <p>
          ApplyLoop sends job-application emails from <em>your own</em> mailbox to recruiters you
          choose. We act as a tool you control. Here&apos;s exactly what that means for data.
        </p>

        <div>
          <h2>What we store</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your profile (name, contact, pitch) — to build your emails.</li>
            <li>Your contacts (recruiter names/emails/companies) — to send and track outreach.</li>
            <li>Your mailbox credentials — <strong>encrypted at rest</strong> (AES-256-GCM); never shown again.</li>
            <li>A send log — what was sent, replied, bounced, or unsubscribed.</li>
          </ul>
        </div>

        <div>
          <h2>Sending &amp; consent</h2>
          <p className="mt-2">
            Every email is sent from your address and includes a working unsubscribe link and a
            List-Unsubscribe header. Anyone who unsubscribes or bounces is added to your suppression
            list and never contacted again. You are responsible for emailing only people it&apos;s
            lawful for you to contact in your jurisdiction (CAN-SPAM, GDPR, India DPDP).
          </p>
        </div>

        <div>
          <h2>Your rights</h2>
          <p className="mt-2">
            You can delete all your data at any time from <a href="/settings" className="text-clay underline">Settings → Delete account</a>,
            which permanently removes your profile, contacts, send log, mailbox credentials, and
            account. Recruiters can remove themselves via the unsubscribe link in any email.
          </p>
        </div>

        <div>
          <h2>Third parties</h2>
          <p className="mt-2">
            We use Supabase (database, auth, storage), your email provider (sending), and — only if
            you enable it — Anthropic&apos;s Claude API to draft emails. We never sell your data.
          </p>
        </div>
      </div>
    </main>
  );
}
