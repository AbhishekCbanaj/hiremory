import { Footer } from "@/components/Footer";

export const metadata = { title: "Terms — Hiremory" };

export default function Terms() {
  return (
    <>
      <main className="container-x py-16 md:py-24">
        <p className="eyebrow">Terms of Service</p>
        <h1 className="mt-3 text-4xl md:text-5xl">The agreement, in plain words.</h1>
        <p className="mt-4 text-[14px] text-ink2">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-10 max-w-2xl space-y-8 text-ink2">
          <section>
            <h2 className="text-xl text-ink">1. What Hiremory does</h2>
            <p className="mt-2">
              Hiremory helps you send personalized job-outreach emails from your own connected
              mailbox, follow up, and share your resume. You are the sender; Hiremory is the tool.
            </p>
          </section>
          <section>
            <h2 className="text-xl text-ink">2. Acceptable use</h2>
            <p className="mt-2">
              You agree to email only people it is lawful for you to contact, to honor unsubscribe
              requests, and to follow anti-spam laws and your mailbox provider&apos;s terms. No bulk
              unsolicited mail, harassment, deceptive content, or illegal activity. We may suspend
              accounts that abuse the service.
            </p>
          </section>
          <section>
            <h2 className="text-xl text-ink">3. Your account & data</h2>
            <p className="mt-2">
              You&apos;re responsible for activity under your account and for your mailbox credentials.
              We encrypt stored mailbox secrets and isolate your data. See our{" "}
              <a href="/privacy" className="text-clay underline">Privacy &amp; Data policy</a>.
            </p>
          </section>
          <section>
            <h2 className="text-xl text-ink">4. Billing</h2>
            <p className="mt-2">
              Paid plans and credit packs are billed via Razorpay (India) or Stripe (international).
              Subscriptions renew until cancelled; credits are one-time. Prices may change with notice.
            </p>
          </section>
          <section>
            <h2 className="text-xl text-ink">5. No warranty & liability</h2>
            <p className="mt-2">
              The service is provided &quot;as is.&quot; We don&apos;t guarantee replies, interviews, or
              deliverability, and to the extent permitted by law our liability is limited to the
              amount you paid in the prior three months.
            </p>
          </section>
          <section>
            <h2 className="text-xl text-ink">6. Changes & contact</h2>
            <p className="mt-2">
              We may update these terms; continued use means you accept the changes. Questions?{" "}
              <a href="mailto:hello@hiremory.com" className="text-clay underline">hello@hiremory.com</a>.
            </p>
          </section>

          <p className="rounded-xl2 border border-line bg-paper2 p-4 text-[13px]">
            This is a plain-language summary, not legal advice. Have a lawyer review before relying on it commercially.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
