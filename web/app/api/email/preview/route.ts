import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Generates a read-only preview of the outreach email: tailors the chosen
// TEMPLATE to the user's profile/resume + the target company. Mirrors worker/ai.py.
// Provider precedence: AI_API_KEY (Grok/OpenAI-compatible) → Gemini → Claude → template.

type Profile = {
  full_name?: string; intro_line?: string; headline?: string; availability?: string;
  pitch_points?: string[]; resume_text?: string;
  phone?: string; email?: string; linkedin_url?: string; github_url?: string;
};

const TEMPLATES: Record<string, string> = {
  posting:
`Subject: Application for [Role] Position - [Sender Name]

Dear [Recipient],

I am writing to express my interest in the [Role] position at [Company], as advertised on [Source]. [One sentence on the sender's background and why they fit].

[One short paragraph: a concrete, quantified achievement from the sender's experience, plus the key skills/tools relevant to the role].

I have attached my resume for your review. I would appreciate the opportunity to discuss how my skills align with your needs. Thank you for considering my application.

Sincerely,
[Signature]`,
  speculative:
`Subject: Enquiry About Opportunities at [Company] - [Sender Name]

Dear [Recipient],

I hope this email finds you well. My name is [Sender Name], and I am a [profession] with [N] years of experience in [field]. I am reaching out about potential opportunities at [Company].

[One short paragraph: the sender's key expertise and a concrete result, plus genuine interest in the company].

I have attached my resume for your consideration. I would be grateful if you could keep me in mind for any current or future roles that fit my experience. Thank you for your time.

Best regards,
[Signature]`,
  referral:
`Subject: Referral by [Referrer] - Application for [Role]

Dear [Recipient],

I was referred to this opportunity by [Referrer], who mentioned your team is looking for a [Role]. [One sentence on the sender's relevant background and enthusiasm for [Company]].

[One short paragraph: a concrete, quantified achievement and the key skills that add value].

Please find my resume attached for your review. I look forward to the possibility of discussing my application. Thank you for your time and consideration.

Warm regards,
[Signature]`,
};

const SYS =
  "You tailor a proven job-application email TEMPLATE into a real, ready-to-send email. "
  + "Keep the template's structure, tone, and roughly its length. Fill EVERY [placeholder] using ONLY "
  + "the sender's real details and the recipient/company given — never invent jobs, skills, numbers, "
  + "degrees, or a referrer. If a detail is missing, write the sentence naturally without it (don't "
  + "leave brackets, don't fabricate). GREETING: recipient's first name if given, else 'Dear Hiring Team,'. "
  + "Pick the single most impressive quantified achievement and surface the role-relevant hard skills. "
  + "If a JOB DESCRIPTION is provided, tailor the email to that role and weave in one or two concrete "
  + "reasons the sender is a strong fit by matching their real experience to its key requirements "
  + "(truthfully, never invent). "
  + "Write like a sharp human, not a robot. No em-dashes, no unsubscribe line. End with EXACTLY the "
  + "signature block given, verbatim. Return {subject, body} where body excludes the 'Subject:' line.";

function signature(p: Profile): string {
  return [p.full_name, p.phone, p.email,
    p.linkedin_url && `LinkedIn: ${p.linkedin_url}`,
    p.github_url && `GitHub: ${p.github_url}`].filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!(await rateLimit(supabase, user.id, "ai_preview"))) {
    return NextResponse.json({ error: "Too many previews in a row — give it a minute." }, { status: 429 });
  }

  const b = await request.json().catch(() => ({}));
  const etype = ["posting", "speculative", "referral"].includes(b.email_type) ? b.email_type : "posting";
  const company = String(b.company ?? "").trim() || "their company";
  const firstName = String(b.first_name ?? "").trim() || "Hiring Team";
  const roleTitle = String(b.role_title ?? "").trim();
  const applySource = String(b.apply_source ?? "").trim();
  const referrerName = String(b.referrer_name ?? "").trim();
  const jobDescription = String(b.job_description ?? "").trim().slice(0, 2500);

  const { data: p } = await supabase.from("profiles")
    .select("full_name, intro_line, headline, availability, pitch_points, resume_text, phone, email, linkedin_url, github_url")
    .eq("id", user.id).maybeSingle();
  const profile: Profile = { ...(p ?? {}), email: p?.email ?? user.email ?? "" };
  if (!profile.full_name) {
    return NextResponse.json({ error: "Add your name in Profile first." }, { status: 400 });
  }

  const userMsg =
`EMAIL TYPE: ${etype}

TEMPLATE TO TAILOR (keep this structure):
${TEMPLATES[etype]}

SENDER:
- Name: ${profile.full_name}
- Headline / roles sought: ${profile.headline || ""}
- One-line background: ${profile.intro_line || ""}
- Experience & skills (from resume):
${(profile.resume_text || "").trim().slice(0, 3000)}
- Proof points:
${(profile.pitch_points ?? []).map((x) => `  * ${x}`).join("\n")}
- Availability: ${profile.availability || "available to join immediately"}

RECIPIENT / TARGET:
- Name: ${firstName}
- Company: ${company}
- Role applying for: ${roleTitle || profile.headline || "the open role"}
${applySource ? `- Where the posting was seen: ${applySource}\n` : ""}${referrerName ? `- Referred by: ${referrerName}\n` : ""}${jobDescription ? `\nJOB DESCRIPTION (tailor to this role and explain the fit):\n${jobDescription}\n` : ""}
SIGNATURE (reproduce verbatim as the closing):
${signature(profile)}`;

  const provider = process.env.AI_API_KEY ? "openai"
    : process.env.GEMINI_API_KEY ? "gemini"
    : process.env.ANTHROPIC_API_KEY ? "claude" : null;
  if (!provider) return NextResponse.json({ error: "Email preview needs an AI key (Grok/OpenAI, Gemini, or Claude)." }, { status: 400 });

  try {
    let data: { subject?: string; body?: string } = {};
    if (provider === "openai") {
      const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "gpt-4o-mini", max_tokens: 1200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYS + ' Respond as JSON: {"subject":"...","body":"..."}' },
            { role: "user", content: userMsg },
          ],
        }),
      });
      const j = await r.json();
      data = JSON.parse(j?.choices?.[0]?.message?.content ?? "{}");
    } else if (provider === "gemini") {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYS }] },
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
        model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", max_tokens: 1200, system: SYS,
        output_config: { format: { type: "json_schema", schema: {
          type: "object", properties: { subject: { type: "string" }, body: { type: "string" } },
          required: ["subject", "body"], additionalProperties: false } } },
        messages: [{ role: "user", content: userMsg }],
      } as Anthropic.Messages.MessageCreateParamsNonStreaming);
      const tb = resp.content.find((x) => x.type === "text");
      data = JSON.parse(tb && "text" in tb ? tb.text : "{}");
    }
    if (data.subject && data.body) return NextResponse.json({ subject: data.subject, body: data.body, source: "ai" });
    return NextResponse.json({ error: "Could not generate — try again." }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "preview failed" }, { status: 502 });
  }
}
