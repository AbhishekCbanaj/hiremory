"""
Optional AI layer. Writes personalized emails + classifies reply intent.

Provider precedence (first key found wins):
  1. GEMINI_API_KEY      -> Google Gemini Flash  (FREE tier — the default)
  2. ANTHROPIC_API_KEY   -> Claude               (paid premium upgrade)
  3. neither             -> None (worker falls back to the static template)

ONE shared model + per-user context (profile.ai_notes + campaign instructions).
No per-user training. Every function fails safe to None.

Env:
  GEMINI_API_KEY / GEMINI_MODEL (default gemini-2.5-flash)
  ANTHROPIC_API_KEY / ANTHROPIC_MODEL (default claude-opus-4-8)
"""
import os
import json
import requests

ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def _provider() -> str | None:
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


def _complete_json(system, user, gemini_schema, claude_schema, max_tokens=1200) -> dict | None:
    p = _provider()
    try:
        if p == "gemini":
            return _gemini_json(system, user, gemini_schema, max_tokens)
        if p == "claude":
            return _claude_json(system, user, claude_schema, max_tokens)
    except Exception:
        return None
    return None


# ---------------------------------------------------------------- personalize
_PERSONALIZE_SYSTEM = (
    "You write short, human cold job-application emails to recruiters that actually get replies. "
    "GREETING: use the recipient's first name if one is given; otherwise 'Dear Hiring Team,'. NEVER write 'Dear there'. "
    "OPENING: one natural sentence (correct grammar, no random Capitalization) — who the sender is and the role they want at the company. "
    "BULLETS: 2-3 max, each ONE short scannable line, lead with the result/number, in plain language a non-technical recruiter instantly gets. "
    "Avoid dense jargon (prefer 'Improved click-through 8% and paid conversions 4% through A/B testing' over instrumentation detail). "
    "Naturally surface the most relevant hard skills/tools (e.g. SQL, Python, Power BI, Tableau) when the sender's resume/proof points support them — recruiters scan for these keywords. "
    "CLOSE: availability + a soft offer to share the resume. Keep the whole email under 150 words. "
    "Do not invent facts about the sender or company. End with EXACTLY the signature block given, verbatim, on its own lines. "
    "No em-dashes. No unsubscribe line."
)


def personalize(profile: dict, contact: dict, instructions: str | None = None) -> dict | None:
    """Return {'subject','body'} written by the AI, or None to fall back to template."""
    if not enabled():
        return None
    sig = "\n".join(_sig_lines(profile))
    memory = (profile.get("ai_notes") or "").strip()
    user = (
        f"SENDER:\n"
        f"- Name: {profile.get('full_name','')}\n"
        f"- Pitch (one line): {profile.get('intro_line','')}\n"
        f"- Roles sought: {profile.get('headline','')}\n"
        f"- Location: {profile.get('location','')}\n"
        f"- Availability: {profile.get('availability','available to join immediately')}\n"
        f"- Proof points:\n" + "\n".join(f"  * {p}" for p in (profile.get('pitch_points') or [])) + "\n"
        + (f"- Remember about the sender:\n{memory}\n" if memory else "")
        + "\n"
        f"RECIPIENT:\n"
        f"- Name: {contact.get('first_name') or contact.get('name') or 'Hiring Team'}\n"
        f"- Company: {contact.get('company') or 'their company'}\n"
        f"- Title: {contact.get('title') or 'recruiter'}\n\n"
        + (f"EXTRA INSTRUCTIONS (follow these):\n{instructions.strip()}\n\n" if instructions else "")
        + f"SIGNATURE (reproduce verbatim as the closing):\n{sig}\n"
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
