export default function Followups() {
  return (
    <main className="container-x py-14">
      <p className="eyebrow">Follow-ups</p>
      <h1 className="mt-3 text-4xl md:text-5xl">The second touch that gets the reply</h1>
      <p className="mt-4 max-w-xl text-ink2">
        ApplyLoop watches for silence. Six days after a first email with no reply
        or bounce, it queues a short, polite nudge inside the same thread.
      </p>

      <div className="mt-10 card max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-4xl text-clay">23</div>
            <div className="text-ink2">due for a follow-up today</div>
          </div>
          <button className="btn-primary">Send follow-ups</button>
        </div>
        <div className="mt-6 border-t border-line pt-5 text-[15px] text-ink2">
          <div className="flex justify-between py-1"><span>Wait before nudging</span><span className="text-ink">6 days</span></div>
          <div className="flex justify-between py-1"><span>Max follow-ups</span><span className="text-ink">1</span></div>
          <div className="flex justify-between py-1"><span>Stops automatically on</span><span className="text-ink">reply or bounce</span></div>
        </div>
      </div>

      <p className="mt-6 text-[13px] text-ink2">Sample numbers — wired to the engine in a later milestone.</p>
    </main>
  );
}
