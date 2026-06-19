"""
Gmail send + tracking via the Gmail API.

One-time setup (see README):
  1. Create an OAuth client (Desktop) in Google Cloud, enable the Gmail API.
  2. Download it as  credentials.json  into this folder.
  3. First run opens a browser to authorize abhishekbanaj01@gmail.com; a
     token.json is cached so you won't be asked again.

Tracking:
  - replies:  thread has > 1 message OR an inbound message from the recipient.
  - bounces:  a mailer-daemon / postmaster message references the address.
"""
import base64
import os
import re
import mimetypes
from email.message import EmailMessage

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
]
HERE = os.path.dirname(os.path.abspath(__file__))


def get_service():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = None
    token_path = os.path.join(HERE, "token.json")
    cred_path = os.path.join(HERE, "credentials.json")
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(cred_path):
                raise FileNotFoundError(
                    "credentials.json not found. See README → Gmail setup."
                )
            flow = InstalledAppFlow.from_client_secrets_file(cred_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w") as f:
            f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def send_email(service, to, subject, body, attachment_path=None, body_html=None):
    """Send one email with optional attachment. Returns the Gmail message id.

    If body_html is given, the email is multipart/alternative: clients that
    render HTML show the formatted version (clickable links, bullets); others
    fall back to the plain-text body.
    """
    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if body_html:
        msg.add_alternative(body_html, subtype="html")
    if attachment_path and os.path.exists(attachment_path):
        ctype, _ = mimetypes.guess_type(attachment_path)
        maintype, subtype = (ctype or "application/pdf").split("/", 1)
        with open(attachment_path, "rb") as f:
            msg.add_attachment(
                f.read(), maintype=maintype, subtype=subtype,
                filename=os.path.basename(attachment_path),
            )
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return sent  # has 'id' and 'threadId'


def reply_in_thread(service, to, subject, body, thread_id,
                    attachment_path=None, body_html=None):
    """Reply inside an existing Gmail thread (keeps the conversation together)."""
    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    msg.set_content(body)
    if body_html:
        msg.add_alternative(body_html, subtype="html")
    if attachment_path and os.path.exists(attachment_path):
        ctype, _ = mimetypes.guess_type(attachment_path)
        maintype, subtype = (ctype or "application/pdf").split("/", 1)
        with open(attachment_path, "rb") as f:
            msg.add_attachment(f.read(), maintype=maintype, subtype=subtype,
                               filename=os.path.basename(attachment_path))
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return service.users().messages().send(
        userId="me", body={"raw": raw, "threadId": thread_id}).execute()


def _decode_part(part):
    data = part.get("body", {}).get("data")
    if not data:
        return ""
    return base64.urlsafe_b64decode(data.encode()).decode("utf-8", "ignore")


def get_inbound_reply(service, thread_id, from_email):
    """Return (message_id, text) of the latest message in the thread that came
    FROM the contact (i.e. an actual reply), or None."""
    try:
        thread = service.users().threads().get(
            userId="me", id=thread_id, format="full").execute()
    except Exception:
        return None
    best = None
    for m in thread.get("messages", []):
        headers = {h["name"].lower(): h["value"]
                   for h in m.get("payload", {}).get("headers", [])}
        sender = headers.get("from", "").lower()
        if from_email.lower() not in sender:
            continue  # skip our own outbound messages
        # gather text from the payload (plain preferred)
        payload = m.get("payload", {})
        text = _decode_part(payload)
        for p in payload.get("parts", []) or []:
            if p.get("mimeType") == "text/plain":
                text = _decode_part(p) or text
        best = (m["id"], text or m.get("snippet", ""))
    return best


def _list_messages(service, query, max_results=500):
    msgs, token = [], None
    while True:
        resp = service.users().messages().list(
            userId="me", q=query, maxResults=min(500, max_results - len(msgs)),
            pageToken=token,
        ).execute()
        msgs.extend(resp.get("messages", []))
        token = resp.get("nextPageToken")
        if not token or len(msgs) >= max_results:
            break
    return msgs


def check_replies(service, addresses):
    """Return set of addresses that have sent us at least one inbound message."""
    replied = set()
    for addr in addresses:
        if _list_messages(service, f"from:{addr} in:anywhere", max_results=1):
            replied.add(addr)
    return replied


def check_bounces(service, addresses, lookback="newer_than:60d"):
    """Return set of addresses that bounced (mailer-daemon mentioned them)."""
    bounced = set()
    bounce_msgs = _list_messages(
        service,
        f'(from:mailer-daemon OR from:postmaster OR subject:"Delivery Status") {lookback}',
        max_results=500,
    )
    addr_set = {a.lower() for a in addresses}
    for m in bounce_msgs:
        full = service.users().messages().get(
            userId="me", id=m["id"], format="full"
        ).execute()
        blob = str(full).lower()
        for a in addr_set:
            # whole-address match, not substring — so 'hr@acme.co' isn't matched
            # inside 'hr@acme.com' (which would suppress a valid, different contact)
            if re.search(r"(?<![\w.+%-])" + re.escape(a) + r"(?![\w.\-])", blob):
                bounced.add(a)
    return bounced
