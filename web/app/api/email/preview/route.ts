import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// Generate a preview of the outreach email using the user's profile + memory +
// per-campaign instructions. One shared Claude model; only the CONTEXT is
// per-user. Falls back to a plain template if no ANTHROPIC_API_KEY.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

type Profile = {
  full_name?: string; intro_line?: string; headline?: string; location?: string;
  availability?: string; pitch_points?: string[]; ai_notes?: string;
  phone?: string; email?: string; linkedin_url?: string; github_url?: string;
};

function signature(p: Profile): string {
  return [p.full_name, p.phone, p.email,
    p.linkedin_url && `LinkedIn: ${p.linkedin_url}`,
    p.github_url && `GitHub: ${p.github_url}`].filter(Boolean).join("\n");
}

function templatePreview(p: Profile, c: { first_name: string; company: string }) {
  const bullets = (p.pitch_points ?? []).map((x) => `  • ${x}`).join("\n");
  const subject = `Exploring ${p.headline || "relevant roles"} | ${p.full_name || ""}`.trim();
  const body =
`Dear ${c.first_name || "Hiring Team"},

I'm ${p.full_name || ""}, ${p.intro_line || "a candidate"}, reaching out about opportunities at ${c.company || "your team"} in ${p.headline || "relevant roles"}.

Over the past while I have driven measurable impact:

${bullets}

I am based in ${p.location || "—"} and ${p.availability || "available to join immediately"}. If there are any suitable openings, I would be glad to share my resume and project portfolio for your review.

Thank you for your time. I look forward to hearing from you.

Best regards,
${signature(p)}`;
  return { subject, body };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const c = {
    first_name: String(b.first_name ?? "").trim() || "Hiring Team",
    company: String(b.company ?? "").trim() || "their company",
    title: String(b.title ?? "").trim() || "recruiter",
  };
  const instructions = String(b.instructions ?? "").trim();

  const { data: p } = await supabase.from("profiles")
    .select("full_name, intro_line, headline, location, availability, pitch_points, ai_notes, phone, email, linkedin_url, github_url")
    .eq("id", user.id).maybeSingle();
  const profile: Profile = { ...(p ?? {}), email: p?.email ?? user.email ?? "" };

  if (!profile.full_name || !(profile.pitch_points?.length)) {
    return NextResponse.json({ error: "Finish your profile first (name + pitch points)." }, { status: 400 });
  }

  // Provider precedence: Gemini (free) → Claude (paid) → template (no key).
  const provider = process.env.GEMINI_API_KEY ? "gemini"
    : process.env.ANTHROPIC_API_KEY ? "claude" : null;
  if (!provider) {
    return NextResponse.json({ ...templatePreview(profile, c), source: "template" });
  }

  const sys = "You write short, human cold job-application emails to recruiters that get replies. "
    + "GREETING: use the recipient's first name if given; otherwise 'Dear Hiring Team,'. NEVER 'Dear there'. "
    + "OPENING: one natural sentence (correct grammar, no random Capitalization) — who the sender is and the role they want at the company. "
    + "BULLETS: 2-3 max, each ONE short scannable line, lead with the result/number, plain language a non-technical recruiter instantly gets; avoid dense jargon. "
    + "Naturally surface relevant hard skills/tools (SQL, Python, Power BI, Tableau) when the proof points support them. "
    + "CLOSE: availability + soft offer to share resume. Under 150 words. End with EXACTLY the signature block given, verbatim. "
    + "Don't invent facts. No em-dashes. No unsubscribe line.";
  const memory = (profile.ai_notes || "").trim();
  const userMsg =
`SENDER:
- Name: ${profile.full_name}
- Pitch: ${profile.intro_line || ""}
- Roles: ${profile.headline || ""}
- Location: ${profile.location || ""}
- Availability: ${profile.availability || "available to join immediately"}
- Proof points:
${(profile.pitch_points ?? []).map((x) => `  * ${x}`).join("\n")}
${memory ? `- Remember about the sender:\n${memory}\n` : ""}
RECIPIENT: ${c.first_name} · ${c.company} · ${c.title}
${instructions ? `\nEXTRA INSTRUCTIONS (follow these):\n${instructions}\n` : ""}
SIGNATURE (reproduce verbatim as the closing):
${signature(profile)}`;

  try {
    let data: { subject?: string; body?: string } = {};
    if (provider === "gemini") {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: userMsg }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1500,
            thinkingConfig: { thinkingBudget: 0 },
            responseSchema: { type: "OBJECT", properties: { subject: { type: "STRING" }, body: { type: "STRING" } }, required: ["subject", "body"] } },
        }),
      });
      const j = await r.json();
      data = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    } else {
      const resp = await new Anthropic().messages.create({
        model: MODEL, max_tokens: 1200, system: sys,
        output_config: { format: { type: "json_schema", schema: {
          type: "object", properties: { subject: { type: "string" }, body: { type: "string" } },
          required: ["subject", "body"], additionalProperties: false } } },
        messages: [{ role: "user", content: userMsg }],
      } as Anthropic.Messages.MessageCreateParamsNonStreaming);
      const textBlock = resp.content.find((bk) => bk.type === "text");
      data = JSON.parse(textBlock && "text" in textBlock ? textBlock.text : "{}");
    }
    if (data.subject && data.body) return NextResponse.json({ ...data, source: "ai" });
    return NextResponse.json({ ...templatePreview(profile, c), source: "template" });
  } catch {
    return NextResponse.json({ ...templatePreview(profile, c), source: "template" });
  }
}
