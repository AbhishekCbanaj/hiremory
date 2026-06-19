"""
Profile-driven email templates for the multi-tenant worker.

Unlike engine/email_template.py (which hardcodes one sender via config), these
build every email from the signed-in user's own profile row, so each user sends
their own name, pitch, and links.

A profile dict is expected to have:
  full_name, email, phone, linkedin_url, github_url, location,
  headline, intro_line, pitch_points (list[str]), availability, attach_resume
"""

_STYLE = "font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;"
_FALLBACK_COMPANY = "your team"


def is_complete(p: dict) -> bool:
    """Enough to send a credible email?"""
    return bool(p.get("full_name") and p.get("headline") and (p.get("pitch_points") or []))


def subject_line(p: dict) -> str:
    name = p.get("full_name", "").strip()
    if p.get("attach_resume"):
        return f"Application for {p.get('headline', 'relevant roles')} | {name}".strip()
    return f"Exploring {p.get('headline', 'relevant roles')} | {name}".strip()


def _closing(p: dict) -> str:
    if p.get("attach_resume"):
        return "I have attached my resume and project portfolio for your review."
    return ("If there are any suitable openings, I would be glad to share my "
            "resume and project portfolio for your review.")


def _signature_lines(p: dict) -> list[str]:
    lines = [p.get("full_name", "")]
    if p.get("phone"):
        lines.append(p["phone"])
    if p.get("email"):
        lines.append(p["email"])
    if p.get("linkedin_url"):
        lines.append(f"LinkedIn: {p['linkedin_url']}")
    if p.get("github_url"):
        lines.append(f"GitHub: {p['github_url']}")
    return [x for x in lines if x]


def _unsub_footer_text(unsub_url: str | None) -> str:
    if not unsub_url:
        return ""
    return f"\n\n---\nDon't want to hear from me again? Unsubscribe: {unsub_url}"


def _unsub_footer_html(unsub_url: str | None) -> str:
    if not unsub_url:
        return ""
    return (f'<hr style="border:none;border-top:1px solid #ddd;margin-top:18px">'
            f'<p style="font-size:12px;color:#999">Don\'t want to hear from me again? '
            f'<a href="{unsub_url}" style="color:#999">Unsubscribe</a>.</p>')


def assemble_ai(body_plain: str, unsub_url: str | None) -> tuple[str, str]:
    """Wrap an AI-written plain-text body into (plain, html), appending the
    unsubscribe footer. The AI supplies greeting through signature; we own the
    footer so the unsubscribe link is always present and correct."""
    plain = body_plain.rstrip() + _unsub_footer_text(unsub_url)
    paras = [seg.strip() for seg in body_plain.strip().split("\n\n") if seg.strip()]
    html_parts = []
    for seg in paras:
        lines = [ln.strip() for ln in seg.splitlines() if ln.strip()]
        if all(ln[:1] in ("-", "•", "*") for ln in lines):  # a bullet block
            items = "".join(f"<li>{ln.lstrip('-•* ').strip()}</li>" for ln in lines)
            html_parts.append(f"<ul>{items}</ul>")
        else:
            html_parts.append("<p>" + "<br>".join(lines) + "</p>")
    html = f'<div style="{_STYLE}">' + "".join(html_parts) + _unsub_footer_html(unsub_url) + "</div>"
    return plain, html


def build_email(p: dict, greeting: str, company: str, unsub_url: str | None = None) -> str:
    company = (company or "").strip() or _FALLBACK_COMPANY
    bullets = "\n".join(f"  • {pt}" for pt in (p.get("pitch_points") or []))
    intro = p.get("intro_line") or "a candidate"
    avail = p.get("availability") or "available to join immediately"
    loc = f"I am based in {p['location']} and " if p.get("location") else "I am "
    sig = "\n".join(_signature_lines(p))
    return f"""Dear {greeting},

I'm {p.get('full_name', '')}, {intro}, reaching out about opportunities at {company} in {p.get('headline', 'relevant roles')}.

Over the past while I have driven measurable impact:

{bullets}

{loc}{avail}. {_closing(p)}

Thank you for your time. I look forward to hearing from you.

Best regards,
{sig}
{_unsub_footer_text(unsub_url)}"""


def build_email_html(p: dict, greeting: str, company: str, unsub_url: str | None = None) -> str:
    company = (company or "").strip() or _FALLBACK_COMPANY
    bullets = "\n".join(f"  <li>{pt}</li>" for pt in (p.get("pitch_points") or []))
    intro = p.get("intro_line") or "a candidate"
    avail = p.get("availability") or "available to join immediately"
    loc = f"I am based in {p['location']} and " if p.get("location") else "I am "
    return f"""<div style="{_STYLE}">
<p>Dear {greeting},</p>
<p>I'm {p.get('full_name', '')}, {intro}, reaching out about opportunities at {company} in {p.get('headline', 'relevant roles')}.</p>
<p>Over the past while I have driven measurable impact:</p>
<ul>
{bullets}
</ul>
<p>{loc}{avail}. {_closing(p)}</p>
<p>Thank you for your time. I look forward to hearing from you.</p>
<p style="margin-bottom:0;">Best regards,<br>
{_sig_html(p)}</p>
{_unsub_footer_html(unsub_url)}
</div>"""


def _sig_html(p: dict) -> str:
    parts = [p.get("full_name", "")]
    if p.get("phone"):
        parts.append(p["phone"])
    if p.get("email"):
        parts.append(f'<a href="mailto:{p["email"]}">{p["email"]}</a>')
    links = []
    if p.get("linkedin_url"):
        links.append(f'<a href="{p["linkedin_url"]}">LinkedIn</a>')
    if p.get("github_url"):
        links.append(f'<a href="{p["github_url"]}">GitHub</a>')
    if links:
        parts.append(" | ".join(links))
    return "<br>\n".join(x for x in parts if x)


def build_followup(p: dict, greeting: str, company: str) -> str:
    company = (company or "").strip() or _FALLBACK_COMPANY
    sig = "\n".join(_signature_lines(p)[:3])  # name, phone, email
    return f"""Dear {greeting},

Just following up on my note below, in case it slipped through. I remain very interested in opportunities at {company} and am {p.get('availability', 'available to join immediately')}.

If there is anyone better placed on your team for this, I would be grateful if you could point me their way.

Thank you again for your time.

Best regards,
{sig}
"""


def build_followup_html(p: dict, greeting: str, company: str) -> str:
    company = (company or "").strip() or _FALLBACK_COMPANY
    return f"""<div style="{_STYLE}">
<p>Dear {greeting},</p>
<p>Just following up on my note below, in case it slipped through. I remain very interested in opportunities at {company} and am {p.get('availability', 'available to join immediately')}.</p>
<p>If there is anyone better placed on your team for this, I would be grateful if you could point me their way.</p>
<p>Thank you again for your time.</p>
<p style="margin-bottom:0;">Best regards,<br>{_sig_html(p)}</p>
</div>"""


def build_resume_cover(p: dict, greeting: str) -> tuple[str, str]:
    sig = "\n".join(_signature_lines(p))
    plain = f"""Dear {greeting},

Thank you for getting back to me. As requested, I have attached my resume for your review. My project portfolio is on my GitHub, linked in the signature.

I would be happy to discuss how I can contribute, at any time convenient to you.

Best regards,
{sig}
"""
    html = f"""<div style="{_STYLE}">
<p>Dear {greeting},</p>
<p>Thank you for getting back to me. As requested, I have attached my resume for your review. My project portfolio is on my GitHub, linked below.</p>
<p>I would be happy to discuss how I can contribute, at any time convenient to you.</p>
<p style="margin-bottom:0;">Best regards,<br>{_sig_html(p)}</p>
</div>"""
    return plain, html
