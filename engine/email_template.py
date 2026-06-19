"""
Builds the personalized cold email for each HR contact.

Human-toned, concise, STAR-style proof points. Personalizes on first name +
company. Picks the best-fit resume from the contact's title when possible,
else the default. No buzzword soup, no "I am writing to express my interest".
"""
import os
import config


def pick_resume(title: str, company: str) -> str:
    """Choose a resume based on hints in the HR title/company text."""
    hay = f"{title} {company}".lower()
    for kw, path in config.ROLE_RESUME_MAP.items():
        if kw in hay:
            return path
    return config.DEFAULT_RESUME


def subject_line() -> str:
    if config.ATTACH_RESUME:
        return f"Application for Analyst Roles | {config.SENDER_NAME} (Immediate Joiner)".strip()
    return f"Exploring Analyst Opportunities | {config.SENDER_NAME} (Immediate Joiner)".strip()


ROLE_PHRASE = ("Data Analytics, Business Analytics, Product Analytics, "
               "or Junior Data Science / AI-ML")
_FALLBACK_COMPANY = "your team"
_STYLE = "font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;"


def _closing() -> str:
    if config.ATTACH_RESUME:
        return ("I have attached my resume and project portfolio for your review.")
    return ("If there are any suitable openings, I would be glad to share my "
            "resume and project portfolio for your review.")


def build_email(greeting_name: str, company: str) -> str:
    """Plain-text email body (no dashes)."""
    company = company.strip() or _FALLBACK_COMPANY
    return f"""Dear {greeting_name},

I'm {config.SENDER_NAME}, a Data and Business Analyst with experience at Practo and InLighn Tech, reaching out about analyst opportunities at {company} across {ROLE_PHRASE}.

Over the past year I have driven product analytics, automation, and revenue impact:

  • Identified a payment funnel issue behind a 34% conversion drop and supported the fix.
  • Built LTV and CAC models that flagged unprofitable subscription plans and informed pricing decisions that lifted paid transactions.
  • Detected approximately Rs.12 lakh per month in ad spend leakage and helped drive corrective action.
  • Automated recurring reporting, cutting turnaround from days to under an hour.

I am based in {config.SENDER_LOCATION} and available to join immediately. {_closing()}

Thank you for your time. I look forward to hearing from you.

Best regards,
{config.SENDER_NAME}
{config.SENDER_PHONE}
{config.SENDER_EMAIL}
LinkedIn: {config.SENDER_LINKEDIN}
GitHub: {config.SENDER_GITHUB}
"""


def build_email_html(greeting_name: str, company: str) -> str:
    """HTML version: stacked signature, clickable LinkedIn / GitHub links."""
    company = company.strip() or _FALLBACK_COMPANY
    style = _STYLE
    return f"""<div style="{style}">
<p>Dear {greeting_name},</p>

<p>I'm {config.SENDER_NAME}, a Data and Business Analyst with experience at Practo and InLighn Tech, reaching out about analyst opportunities at {company} across {ROLE_PHRASE}.</p>

<p>Over the past year I have driven product analytics, automation, and revenue impact:</p>
<ul>
  <li>Identified a payment funnel issue behind a 34% conversion drop and supported the fix.</li>
  <li>Built LTV and CAC models that flagged unprofitable subscription plans and informed pricing decisions that lifted paid transactions.</li>
  <li>Detected approximately &#8377;12 lakh per month in ad spend leakage and helped drive corrective action.</li>
  <li>Automated recurring reporting, cutting turnaround from days to under an hour.</li>
</ul>

<p>I am based in {config.SENDER_LOCATION} and available to join immediately. {_closing()}</p>

<p>Thank you for your time. I look forward to hearing from you.</p>

<p style="margin-bottom:0;">Best regards,<br>
{config.SENDER_NAME}<br>
{config.SENDER_PHONE}<br>
<a href="mailto:{config.SENDER_EMAIL}">{config.SENDER_EMAIL}</a><br>
<a href="{config.SENDER_LINKEDIN}">LinkedIn</a> | <a href="{config.SENDER_GITHUB}">GitHub</a></p>
</div>"""


def followup_subject() -> str:
    return f"Re: {subject_line()}"


def build_followup(greeting_name: str, company: str) -> str:
    """Short, polite nudge for non-repliers (plain text)."""
    company = company.strip() or _FALLBACK_COMPANY
    return f"""Dear {greeting_name},

Just following up on my note below, in case it slipped through. I remain very interested in analyst opportunities at {company} and am available to join immediately.

If there is anyone better placed on your team for this, I would be grateful if you could point me their way.

Thank you again for your time.

Best regards,
{config.SENDER_NAME}
{config.SENDER_PHONE}
{config.SENDER_EMAIL}
"""


def build_followup_html(greeting_name: str, company: str) -> str:
    company = company.strip() or _FALLBACK_COMPANY
    style = _STYLE
    return f"""<div style="{style}">
<p>Dear {greeting_name},</p>
<p>Just following up on my note below, in case it slipped through. I remain very interested in analyst opportunities at {company} and am available to join immediately.</p>
<p>If there is anyone better placed on your team for this, I would be grateful if you could point me their way.</p>
<p>Thank you again for your time.</p>
<p style="margin-bottom:0;">Best regards,<br>
{config.SENDER_NAME}<br>{config.SENDER_PHONE}<br>
<a href="mailto:{config.SENDER_EMAIL}">{config.SENDER_EMAIL}</a></p>
</div>"""


def build_resume_cover(greeting_name: str) -> tuple[str, str]:
    """The note sent when auto-attaching the resume after a positive reply.
    Returns (plain, html)."""
    plain = f"""Dear {greeting_name},

Thank you for getting back to me. As requested, I have attached my resume for your review. My project portfolio is on my GitHub, linked in the signature.

I would be happy to discuss how I can contribute, at any time convenient to you.

Best regards,
{config.SENDER_NAME}
{config.SENDER_PHONE}
{config.SENDER_EMAIL}
LinkedIn: {config.SENDER_LINKEDIN}
GitHub: {config.SENDER_GITHUB}
"""
    style = _STYLE
    html = f"""<div style="{style}">
<p>Dear {greeting_name},</p>
<p>Thank you for getting back to me. As requested, I have attached my resume for your review. My project portfolio is on my GitHub, linked below.</p>
<p>I would be happy to discuss how I can contribute, at any time convenient to you.</p>
<p style="margin-bottom:0;">Best regards,<br>
{config.SENDER_NAME}<br>{config.SENDER_PHONE}<br>
<a href="mailto:{config.SENDER_EMAIL}">{config.SENDER_EMAIL}</a><br>
<a href="{config.SENDER_LINKEDIN}">LinkedIn</a> | <a href="{config.SENDER_GITHUB}">GitHub</a></p>
</div>"""
    return plain, html


def preview(contact: dict) -> dict:
    """Return subject, body (plain + html), and resume path for one contact."""
    resume = pick_resume(contact.get("title", ""), contact.get("company", ""))
    # first name keeps the greeting warm; fall back to "Hiring Team"
    greeting = contact.get("first_name") or "Hiring Team"
    company = contact.get("company", "")
    return {
        "to": contact["email"],
        "subject": subject_line(),
        "body": build_email(greeting, company),
        "body_html": build_email_html(greeting, company),
        "resume": resume,
        "resume_exists": os.path.exists(resume),
    }
