"""
Optional AI layer. Tailors a chosen email TEMPLATE to the sender + company,
and classifies reply intent.

Provider precedence (first key found wins):
  1. AI_API_KEY          -> OpenAI-compatible endpoint (Grok / OpenAI / DeepSeek…)
  2. GEMINI_API_KEY      -> Google Gemini               (free tier)
  3. ANTHROPIC_API_KEY   -> Claude                       (paid premium)
  4. none                -> None (worker falls back to the static template)

The user picks an email type (posting / speculative / referral); the AI fills
the matching template truthfully from the sender's details. Fails safe to None.

Env:
  AI_API_KEY / AI_BASE_URL (default https://api.openai.com/v1) / AI_MODEL (default gpt-4o-mini)
    e.g. Grok: AI_BASE_URL=https://api.x.ai/v1  AI_MODEL=grok-3
  GEMINI_API_KEY / GEMINI_MODEL (default gemini-2.5-flash)
  ANTHROPIC_API_KEY / ANTHROPIC_MODEL (default claude-opus-4-8)
"""
import os
import json
import requests

ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")


def _provider() -> str | None:
    if os.environ.get("AI_API_KEY"):
        return "openai"
    if os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "claude"
    return None


def enabled() -> bool:
    return _provider() is not None


# ---- JSON schemas (one per shape; Gemini wants UPPERCASE types) -------------
_EMAIL_GEMINI = {"type": "OBJECT", "properties": {
    "subject": {"type": "STRING"}, "body": {"type": "STRING"}}, "required": ["subject", "body"]}
_EMAIL_CLAUDE = {"type": "object", "properties": {
    "subject": {"type": "string"}, "body": {"type": "string"}},
    "required": ["subject", "body"], "additionalProperties": False}
_VERDICT_GEMINI = {"type": "OBJECT", "properties": {
    "verdict": {"type": "STRING", "enum": ["positive", "negative", "neutral"]}}, "required": ["verdict"]}
_VERDICT_CLAUDE = {"type": "object", "properties": {
    "verdict": {"type": "string", "enum": ["positive", "negative", "neutral"]}},
    "required": ["verdict"], "additionalProperties": False}


def _gemini_json(system: str, user: str, gemini_schema: dict, max_tokens: int = 1200) -> dict | None:
    key = os.environ["GEMINI_API_KEY"]
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{GEMINI_MODEL}:generateContent?key={key}")
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        # thinkingBudget:0 disables 2.5-flash "thinking" so the whole token budget
        # goes to the structured answer (thinking was truncating large outputs).
        "generationConfig": {"responseMimeType": "application/json",
                             "responseSchema": gemini_schema, "maxOutputTokens": max_tokens,
                             "thinkingConfig": {"thinkingBudget": 0}},
    }
    r = requests.post(url, json=body, timeout=45)
    r.raise_for_status()
    text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def _claude_json(system: str, user: str, claude_schema: dict, max_tokens: int = 1200) -> dict | None:
    import anthropic
    resp = anthropic.Anthropic().messages.create(
        model=ANTHROPIC_MODEL, max_tokens=max_tokens, system=system,
        output_config={"format": {"type": "json_schema", "schema": claude_schema}},
        messages=[{"role": "user", "content": user}],
    )
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text)


def _openai_json(system: str, user: str, schema: dict, max_tokens: int = 1200) -> dict | None:
    # Works with any OpenAI-compatible API (OpenAI, xAI/Grok, DeepSeek, …).
    key = os.environ["AI_API_KEY"]
    sys2 = system + "\n\nRespond with ONLY a single JSON object matching this schema: " + json.dumps(schema)
    body = {"model": AI_MODEL, "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": sys2}, {"role": "user", "content": user}]}
    r = requests.post(f"{AI_BASE_URL}/chat/completions", json=body, timeout=60,
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    r.raise_for_status()
    return json.loads(r.json()["choices"][0]["message"]["content"])


def _complete_json(system, user, gemini_schema, claude_schema, max_tokens=1200) -> dict | None:
    p = _provider()
    try:
        if p == "openai":
            return _openai_json(system, user, claude_schema, max_tokens)
        if p == "gemini":
            return _gemini_json(system, user, gemini_schema, max_tokens)
        if p == "claude":
            return _claude_json(system, user, claude_schema, max_tokens)
    except Exception:
        return None
    return None


# ---------------------------------------------------------------- templates
# Human-readable labels for the compose dropdown (key -> label).
EMAIL_TYPES = {
    "posting": "Applying after seeing a job posting",
    "speculative": "Speculative application (no posting)",
    "referral": "Referral-based application",
}
DEFAULT_EMAIL_TYPE = "posting"

# Proven reference templates. The AI keeps this structure/tone and fills every
# [placeholder] truthfully from the sender's real details — never inventing.
_TEMPLATES = {
    "posting": (
        "Subject: Application for [Role] Position - [Sender Name]\n\n"
        "Dear [Recipient],\n\n"
        "I am writing to express my interest in the [Role] position at [Company], as advertised on "
        "[Source]. [One sentence on the sender's background and why they fit].\n\n"
        "[One short paragraph: a concrete, quantified achievement from the sender's experience, plus "
        "the key skills/tools relevant to the role].\n\n"
        "I have attached my resume for your review. I would appreciate the opportunity to discuss how "
        "my skills align with your needs. Thank you for considering my application.\n\n"
        "Sincerely,\n[Signature]"
    ),
    "speculative": (
        "Subject: Enquiry About Opportunities at [Company] - [Sender Name]\n\n"
        "Dear [Recipient],\n\n"
        "I hope this email finds you well. My name is [Sender Name], and I am a [profession] with "
        "[N] years of experience in [field]. I am reaching out about potential opportunities at [Company].\n\n"
        "[One short paragraph: the sender's key expertise and a concrete result, plus genuine interest "
        "in the company].\n\n"
        "I have attached my resume for your consideration. I would be grateful if you could keep me in "
        "mind for any current or future roles that fit my experience. Thank you for your time.\n\n"
        "Best regards,\n[Signature]"
    ),
    "referral": (
        "Subject: Referral by [Referrer] - Application for [Role]\n\n"
        "Dear [Recipient],\n\n"
        "I was referred to this opportunity by [Referrer], who mentioned your team is looking for a "
        "[Role]. [One sentence on the sender's relevant background and enthusiasm for [Company]].\n\n"
        "[One short paragraph: a concrete, quantified achievement and the key skills that add value].\n\n"
        "Please find my resume attached for your review. I look forward to the possibility of discussing "
        "my application. Thank you for your time and consideration.\n\n"
        "Warm regards,\n[Signature]"
    ),
}

_PERSONALIZE_SYSTEM = (
    "You tailor a proven job-application email TEMPLATE into a real, ready-to-send email. "
    "Rules: keep the template's structure, tone, and roughly its length. Fill EVERY [placeholder] "
    "using ONLY the sender's real details and the recipient/company given — never invent jobs, skills, "
    "numbers, degrees, or a referrer. If a detail is missing, write the sentence naturally without it "
    "(don't leave brackets and don't fabricate). "
    "GREETING: recipient's first name if given, else 'Dear Hiring Team,'. Pick the single most "
    "impressive quantified achievement from the sender's experience for the achievement paragraph, and "
    "surface the hard skills/tools most relevant to the role (recruiters scan for these). "
    "Write like a sharp human, not a robot: correct grammar, no buzzword stuffing, no em-dashes, no "
    "unsubscribe line. End with EXACTLY the signature block given, verbatim, on its own lines. "
    "Return {subject, body} where body excludes the 'Subject:' line."
)


def personalize(profile: dict, contact: dict, email_type: str | None = None,
                extras: dict | None = None, instructions: str | None = None) -> dict | None:
    """Tailor the chosen template for this contact. Returns {'subject','body'} or None."""
    if not enabled():
        return None
    etype = email_type if email_type in _TEMPLATES else DEFAULT_EMAIL_TYPE
    extras = extras or {}
    sig = "\n".join(_sig_lines(profile))
    user = (
        f"EMAIL TYPE: {EMAIL_TYPES[etype]}\n\n"
        f"TEMPLATE TO TAILOR (keep this structure):\n{_TEMPLATES[etype]}\n\n"
        f"SENDER:\n"
        f"- Name: {profile.get('full_name','')}\n"
        f"- Headline / roles sought: {profile.get('headline','')}\n"
        f"- One-line background: {profile.get('intro_line','')}\n"
        f"- Experience & skills (from resume):\n{(profile.get('resume_text') or '').strip()[:3000]}\n"
        f"- Proof points:\n" + "\n".join(f"  * {p}" for p in (profile.get('pitch_points') or [])) + "\n"
        f"- Availability: {profile.get('availability','available to join immediately')}\n\n"
        f"RECIPIENT / TARGET:\n"
        f"- Name: {contact.get('first_name') or contact.get('name') or 'Hiring Team'}\n"
        f"- Company: {contact.get('company') or 'their company'}\n"
        f"- Role applying for: {extras.get('role_title') or profile.get('headline') or 'the open role'}\n"
        + (f"- Where the posting was seen: {extras['apply_source']}\n" if extras.get("apply_source") else "")
        + (f"- Referred by: {extras['referrer_name']}\n" if extras.get("referrer_name") else "")
        + (f"\nEXTRA INSTRUCTIONS:\n{instructions.strip()}\n" if instructions else "")
        + f"\nSIGNATURE (reproduce verbatim as the closing):\n{sig}\n"
    )
    data = _complete_json(_PERSONALIZE_SYSTEM, user, _EMAIL_GEMINI, _EMAIL_CLAUDE)
    if data and data.get("subject") and data.get("body"):
        return {"subject": data["subject"].strip(), "body": data["body"].strip()}
    return None


# ---------------------------------------------------------------- classify
_CLASSIFY_SYSTEM = (
    "Classify a recruiter's reply to a cold job-application email. "
    "'positive' = they want the resume / are interested / ask to proceed. "
    "'negative' = no openings / not interested / asking to stop. "
    "'neutral' = anything else (auto-reply, out-of-office, needs a human)."
)


def classify_reply(text: str) -> str | None:
    """Return 'positive'|'negative'|'neutral' from the AI, or None to fall back."""
    if not enabled() or not text:
        return None
    data = _complete_json(_CLASSIFY_SYSTEM, text[:4000], _VERDICT_GEMINI, _VERDICT_CLAUDE)
    return data.get("verdict") if data else None


# ---------------------------------------------------------------- tailor resume
_RESUME_GEMINI = {"type": "OBJECT", "properties": {
    "summary": {"type": "STRING"},
    "sections": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "heading": {"type": "STRING"},
        "bullets": {"type": "ARRAY", "items": {"type": "STRING"}}},
        "required": ["heading", "bullets"]}}},
    "required": ["summary", "sections"]}
_RESUME_CLAUDE = {"type": "object", "properties": {
    "summary": {"type": "string"},
    "sections": {"type": "array", "items": {"type": "object", "properties": {
        "heading": {"type": "string"},
        "bullets": {"type": "array", "items": {"type": "string"}}},
        "required": ["heading", "bullets"], "additionalProperties": False}}},
    "required": ["summary", "sections"], "additionalProperties": False}

_TAILOR_SYSTEM = (
    "You are an expert resume writer + ATS optimizer. Tailor the candidate's resume to the job "
    "description. STRICT rules:\n"
    "- TRUTHFUL ONLY: use only content from the candidate's resume — never invent jobs, skills, "
    "degrees, dates, or metrics.\n"
    "- ATS-FRIENDLY: mirror the JD's exact keywords/skills where the candidate genuinely has them; "
    "use standard section headings (Summary, Experience, Skills, Projects, Education); no tables/graphics.\n"
    "- LENGTH: judge seniority from the resume. Fresher / entry-level (≤2 yrs) → ONE page of content "
    "(tight: ~3-4 sections, ~3-5 bullets each). Senior (5+ yrs) → up to two pages.\n"
    "- BULLETS: strong action verb + what you did + quantified result; concise, scannable, recruiter-readable.\n"
    "- TONE: human and confident, not robotic or buzzword-stuffed.\n"
    "Return a short professional summary plus structured sections with bullet points."
)


def tailor_resume(resume_text: str, job_description: str) -> dict | None:
    """Return {'summary', 'sections':[{'heading','bullets':[...]}]} or None."""
    if not enabled() or not (resume_text or "").strip() or not (job_description or "").strip():
        return None
    user = f"CANDIDATE RESUME:\n{resume_text.strip()}\n\nJOB DESCRIPTION:\n{job_description.strip()}\n"
    data = _complete_json(_TAILOR_SYSTEM, user, _RESUME_GEMINI, _RESUME_CLAUDE, max_tokens=4000)
    if data and data.get("sections"):
        return data
    return None


def _sig_lines(p: dict) -> list[str]:
    lines = [p.get("full_name", "")]
    for key, label in (("phone", ""), ("email", ""),
                       ("linkedin_url", "LinkedIn: "), ("github_url", "GitHub: ")):
        if p.get(key):
            lines.append(f"{label}{p[key]}")
    return [x for x in lines if x]
