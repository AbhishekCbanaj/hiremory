"""
Pluggable send/receive transports. The worker phases call this interface and
don't care whether mail goes over SMTP (any provider) or the Gmail API.

A transport implements:
  send(to, subject, body, html, attachment_path) -> {"id":..., "thread_id":...}
  reply(to, subject, body, html, row, attachment_path) -> {...}
  find_reply(row) -> (msg_id, text) | None   # latest inbound from the contact
"""
import os
import re
import time
import socket
import smtplib
import imaplib
import email
import mimetypes
import datetime as dt
from email.message import EmailMessage
from email.utils import make_msgid, parseaddr, parsedate_to_datetime


class PermanentSendError(Exception):
    """The recipient was permanently refused — suppress that address."""


class MailboxAuthError(Exception):
    """The mailbox's own credentials were rejected — pause the mailbox, do NOT
    blame the recipient. Detected by exception TYPE, not by string matching."""


# classified by exception type (string matching missed e.g. Gmail's
# "Username and Password not accepted" — which contains no "auth").
_AUTH = (smtplib.SMTPAuthenticationError,)
_RECIPIENT = (smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused)
_TRANSIENT = (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError,
              socket.timeout, ConnectionError, TimeoutError)


# --------------------------------------------------------------- SMTP / IMAP
class SmtpTransport:
    """Provider-agnostic. Works with Gmail app passwords, Outlook, Zoho, etc."""

    def __init__(self, mailbox: dict, secret: str):
        self.mb = mailbox
        self.secret = secret
        self.email = mailbox["email"]
        self.from_name = mailbox.get("from_name") or ""
        # Inbox is fetched once per run (not per contact) — see _prime().
        self._primed = False
        self._by_sender: dict = {}   # sender_email -> (uid, body_text)
        self._bounce_blob = ""       # concatenated text of delivery-failure messages

    # -- sending ----------------------------------------------------------
    def _build(self, to, subject, body, html, attachment_path, headers=None):
        msg = EmailMessage()
        msg["From"] = f"{self.from_name} <{self.email}>" if self.from_name else self.email
        msg["To"] = to
        msg["Subject"] = subject
        msg["Message-ID"] = make_msgid()
        for k, v in (headers or {}).items():
            if v:
                msg[k] = v
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")
        if attachment_path and os.path.exists(attachment_path):
            ctype, _ = mimetypes.guess_type(attachment_path)
            maintype, subtype = (ctype or "application/pdf").split("/", 1)
            with open(attachment_path, "rb") as f:
                msg.add_attachment(f.read(), maintype=maintype, subtype=subtype,
                                   filename=os.path.basename(attachment_path))
        return msg

    def _send_once(self, msg):
        host = self.mb["smtp_host"]
        port = int(self.mb.get("smtp_port") or 465)
        if port == 587:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls()
                s.login(self.email, self.secret)
                s.send_message(msg)
        else:
            with smtplib.SMTP_SSL(host, port, timeout=30) as s:
                s.login(self.email, self.secret)
                s.send_message(msg)
        return msg["Message-ID"]

    def _send(self, msg, attempts=3):
        """Retry transient SMTP errors with backoff; fail fast on permanent ones."""
        last = None
        for i in range(attempts):
            try:
                return self._send_once(msg)
            except _AUTH as e:
                raise MailboxAuthError(str(e)) from e
            except _RECIPIENT as e:
                raise PermanentSendError(str(e)) from e
            except _TRANSIENT as e:
                last = e
                time.sleep(2 * (i + 1))
            except smtplib.SMTPResponseException as e:
                # Many providers signal a PERMANENT recipient/policy rejection as a
                # 5xx data error (550/553) rather than SMTPRecipientsRefused. Don't
                # retry those — surface as permanent so the address is suppressed.
                # 4xx stays transient (retry with backoff).
                if 500 <= (e.smtp_code or 0) < 600:
                    raise PermanentSendError(f"{e.smtp_code} {e.smtp_error}") from e
                last = e
                time.sleep(2 * (i + 1))
            except smtplib.SMTPException as e:
                # unknown SMTP error: one retry, then surface it
                last = e
                time.sleep(2 * (i + 1))
        raise last

    def send(self, to, subject, body, html=None, attachment_path=None, headers=None):
        msg = self._build(to, subject, body, html, attachment_path, headers=headers)
        mid = self._send(msg)
        return {"id": mid, "thread_id": mid}  # we thread by original Message-ID

    def reply(self, to, subject, body, html=None, row=None, attachment_path=None):
        orig = (row or {}).get("message_id") or (row or {}).get("thread_id")
        subj = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        headers = {"In-Reply-To": orig, "References": orig}
        msg = self._build(to, subj, body, html, attachment_path, headers=headers)
        mid = self._send(msg)
        return {"id": mid, "thread_id": (row or {}).get("thread_id") or mid}

    # -- receiving --------------------------------------------------------
    def _prime(self):
        """Open IMAP ONCE per run, scan recent INBOX, and index inbound replies +
        delivery failures in memory. Replaces the old per-contact connect+search
        (which opened one IMAP login per send_log row)."""
        if self._primed:
            return
        self._primed = True
        host = self.mb.get("imap_host")
        if not host:
            return
        try:
            with imaplib.IMAP4_SSL(host, int(self.mb.get("imap_port") or 993)) as M:
                M.login(self.email, self.secret)
                M.select("INBOX")
                typ, data = M.search(None, "ALL")
                if typ != "OK" or not data or not data[0]:
                    return
                for mid in data[0].split()[-150:]:  # recent only — bounds cost
                    typ, md = M.fetch(mid, "(RFC822)")
                    if typ != "OK" or not md or not md[0]:
                        continue
                    raw = md[0][1]
                    parsed = email.message_from_bytes(raw)
                    frm = parseaddr(parsed.get("From", ""))[1].lower()
                    subj = (parsed.get("Subject") or "").lower()
                    is_bounce = ("mailer-daemon" in frm or "postmaster" in frm
                                 or "undeliverable" in subj or "delivery status" in subj
                                 or "delivery has failed" in subj)
                    if is_bounce:
                        self._bounce_blob += " " + raw.decode("utf-8", "ignore").lower()
                    elif frm:
                        # keep the newest message per sender (by Date header; falls
                        # back to scan order when a Date is missing/unparseable)
                        cur = (mid.decode(), _body_text(parsed), _msg_date(parsed))
                        prev = self._by_sender.get(frm)
                        if prev is None or _is_newer(cur[2], prev[2]):
                            self._by_sender[frm] = cur
        except Exception:
            pass  # treat an unreachable inbox as "no replies" this run

    def find_reply(self, row):
        """(msg_id, text) of the newest inbound message from the contact, or None.
        Only counts a message that arrived AFTER we emailed them — otherwise an
        unrelated or pre-existing email from the same address would be mistaken
        for a reply (and could trigger an auto-resume). Falls back to returning
        the message when either date is missing, to avoid dropping real replies."""
        self._prime()
        hit = self._by_sender.get((row.get("email") or "").lower())
        if not hit:
            return None
        mid, text, mdate = hit
        sent = _parse_iso(row.get("sent_at"))
        if mdate and sent and mdate < sent:
            return None
        return (mid, text)

    def find_bounces(self, addresses):
        """Addresses that appear in a delivery-failure message."""
        self._prime()
        return {a for a in addresses if _addr_in_blob(a, self._bounce_blob)}


# ------------------------------------------------------------- Gmail OAuth
class GmailTransport:
    """Wraps the existing Gmail API client (engine/gmail_client.py)."""

    def __init__(self, service, email):
        self.svc = service
        self.email = email
        self._reply_cache: dict = {}  # thread_id -> reply result (avoid double API calls)

    @staticmethod
    def _norm(resp: dict) -> dict:
        # Gmail API returns camelCase 'threadId'; normalize to our contract.
        return {"id": resp.get("id"), "thread_id": resp.get("threadId") or resp.get("thread_id")}

    def send(self, to, subject, body, html=None, attachment_path=None, headers=None):
        # gmail_client doesn't set custom headers; the visible footer link covers
        # unsubscribe for Gmail senders (capped at 100 in testing mode anyway).
        import gmail_client as gc
        return self._norm(gc.send_email(self.svc, to, subject, body,
                                        attachment_path=attachment_path, body_html=html))

    def reply(self, to, subject, body, html=None, row=None, attachment_path=None):
        import gmail_client as gc
        return self._norm(gc.reply_in_thread(self.svc, to, subject or "", body,
                                             (row or {}).get("thread_id"),
                                             attachment_path=attachment_path, body_html=html))

    def find_reply(self, row):
        tid = (row or {}).get("thread_id")
        if not tid:
            return None
        if tid in self._reply_cache:
            return self._reply_cache[tid]
        import gmail_client as gc
        res = gc.get_inbound_reply(self.svc, tid, row["email"])
        self._reply_cache[tid] = res
        return res

    def find_bounces(self, addresses):
        import gmail_client as gc
        if not addresses:
            return set()
        return gc.check_bounces(self.svc, addresses)


# ------------------------------------------------------------------ helpers
def _addr_in_blob(addr: str, blob: str) -> bool:
    """True if `addr` appears in `blob` as a whole email address — not merely as a
    substring. Prevents 'hr@acme.co' from matching inside 'hr@acme.com' (which
    would suppress a valid, different contact). Guards the address with negative
    lookarounds for email-continuation characters."""
    if not addr:
        return False
    pattern = r"(?<![\w.+%-])" + re.escape(addr.lower()) + r"(?![\w.\-])"
    return re.search(pattern, blob) is not None


def _msg_date(parsed):
    """Parse a message's Date header to an aware (UTC-defaulted) datetime, or None."""
    try:
        d = parsedate_to_datetime(parsed.get("Date"))
    except (TypeError, ValueError):
        return None
    if d is None:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d


def _parse_iso(s):
    """Parse an ISO timestamp string to an aware (UTC-defaulted) datetime, or None."""
    try:
        d = dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d


def _is_newer(a, b) -> bool:
    """Should a message dated `a` replace one dated `b`? When either date is
    unknown, prefer the later-scanned message (return True)."""
    if a is None or b is None:
        return True
    return a >= b


def _body_text(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    return part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", "ignore")
                except Exception:
                    continue
        return ""
    try:
        return msg.get_payload(decode=True).decode(
            msg.get_content_charset() or "utf-8", "ignore")
    except Exception:
        return msg.get_payload() or ""
