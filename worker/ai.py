"""
Optional AI layer (Phase 4). Uses Claude to (1) write a genuinely personalized
email per recipient and (2) classify reply intent more accurately than keywords.

COST: this is the only part of the worker that costs money per use. It is
strictly opt-in — every function no-ops (returns None) unless ANTHROPIC_API_KEY
is set, and the worker falls back to the static templates / keyword classifier.

Env:
  ANTHROPIC_API_KEY   enables this layer
  ANTHROPIC_MODEL     default 'claude-opus-4-8'; set 'claude-haiku-4-5' to cut cost
"""
import os
import json

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")


def enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _client():
    import anthropic
    return anthropic.Anthropic()


# --------------------------------------------------------------- personalize
_EMAIL_SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "body": {"type": "string"},
    },
    "required": ["subject", "body"],
    "additionalProperties": False,
}

_PERSONALIZE_SYSTEM = (
    "You write concise, genuine cold job-application emails to recruiters. "
    "Rules: warm but professional; no buzzwords or flattery; no em-dashes; "
    "open with something specific to the recipient's company/role, not a generic line; "
    "weave in the sender's real proof points; keep it under 180 words. "
    "End with EXACTLY the signature block given, verbatim, on its own lines. "
    "Do not invent facts about the sender or the company. Do not add an unsubscribe line."
)


def personalize(profile: dict, contact: dict) -> dict | None:
    """Return {'subject','body'} written by Claude, or None to fall back to template."""
    if not enabled():
        return None
    sig = "\n".join(_sig_lines(profile))
    user = (
        f"SENDER:\n"
        f"- Name: {profile.get('full_name','')}\n"
        f"- Pitch (one line): {profile.get('intro_line','')}\n"
        f"- Roles sought: {profile.get('headline','')}\n"
        f"- Location: {profile.get('location','')}\n"
        f"- Availability: {profile.get('availability','available to join immediately')}\n"
        f"- Proof points:\n" + "\n".join(f"  * {p}" for p in (profile.get('pitch_points') or [])) + "\n\n"
        f"RECIPIENT:\n"
        f"- Name: {contact.get('first_name') or contact.get('name') or 'Hiring Team'}\n"
        f"- Company: {contact.get('company') or 'their company'}\n"
        f"- Title: {contact.get('title') or 'recruiter'}\n\n"
        f"SIGNATURE (reproduce verbatim as the closing):\n{sig}\n"
    )
    try:
        resp = _client().messages.create(
            model=MODEL, max_tokens=1200, system=_PERSONALIZE_SYSTEM,
            output_config={"format": {"type": "json_schema", "schema": _EMAIL_SCHEMA}},
            messages=[{"role": "user", "content": user}],
        )
        text = next(b.text for b in resp.content if b.type == "text")
        data = json.loads(text)
        if data.get("subject") and data.get("body"):
            return {"subject": data["subject"].strip(), "body": data["body"].strip()}
    except Exception:
        return None
    return None


# --------------------------------------------------------------- classify
_VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["positive", "negative", "neutral"]},
    },
    "required": ["verdict"],
    "additionalProperties": False,
}

_CLASSIFY_SYSTEM = (
    "Classify a recruiter's reply to a cold job-application email. "
    "'positive' = they want the resume / are interested / ask to proceed. "
    "'negative' = no openings / not interested / asking to stop. "
    "'neutral' = anything else (auto-reply, out-of-office, needs a human)."
)


def classify_reply(text: str) -> str | None:
    """Return 'positive'|'negative'|'neutral' from Claude, or None to fall back."""
    if not enabled() or not text:
        return None
    try:
        resp = _client().messages.create(
            model=MODEL, max_tokens=50, system=_CLASSIFY_SYSTEM,
            output_config={"format": {"type": "json_schema", "schema": _VERDICT_SCHEMA}},
            messages=[{"role": "user", "content": text[:4000]}],
        )
        out = next(b.text for b in resp.content if b.type == "text")
        return json.loads(out).get("verdict")
    except Exception:
        return None


def _sig_lines(p: dict) -> list[str]:
    lines = [p.get("full_name", "")]
    for key, label in (("phone", ""), ("email", ""),
                       ("linkedin_url", "LinkedIn: "), ("github_url", "GitHub: ")):
        if p.get(key):
            lines.append(f"{label}{p[key]}")
    return [x for x in lines if x]
