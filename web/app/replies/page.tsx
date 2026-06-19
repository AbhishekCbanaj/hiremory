const REPLIES = [
  ["Akanksha Puri", "SourceFuse Technologies", "positive", "“Sure, please share your resume.”"],
  ["Heena Bawa", "CleverTap", "neutral", "“Let me check with the team.”"],
  ["Rana Bose", "eMDs", "negative", "“No openings at the moment.”"],
];

function tone(v: string) {
  return {
    positive: "bg-sage/15 text-sage",
    neutral: "bg-paper2 text-ink2",
    negative: "bg-ink/10 text-ink2",
  }[v] ?? "bg-paper2";
}

export default function Replies() {
  return (
    <main className="container-x py-14">
      <p className="eyebrow">Replies & auto-resume</p>
      <h1 className="mt-3 text-4xl md:text-5xl">It reads the room, then acts</h1>
      <p className="mt-4 max-w-2xl text-ink2">
        Hiremory scans your threads for replies and sorts them. When a recruiter
        asks for your resume, it sends the role-matched PDF back automatically,
        in the same conversation. You only step in for the gray areas.
      </p>

      <div className="mt-9 flex items-center gap-4">
        <button className="btn-primary">Scan replies</button>
        <span className="text-[14px] text-ink2">Last scan: 1h ago</span>
      </div>

      <div className="mt-8 space-y-4">
        {REPLIES.map(([name, co, v, quote]) => (
          <div key={name} className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg">{name} <span className="text-ink2">· {co}</span></div>
              <div className="mt-1 font-display italic text-ink2">{quote}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-[13px] capitalize ${tone(v as string)}`}>{v}</span>
              {v === "positive" && <span className="text-[13px] text-sage">resume sent ✓</span>}
              {v === "neutral" && <button className="btn-ghost !py-1.5 !px-4 text-[13px]">Handle</button>}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[13px] text-ink2">Sample replies — classification runs on the real engine once connected.</p>
    </main>
  );
}
