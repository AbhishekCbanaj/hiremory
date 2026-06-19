"""
Unsubscribe link generation. The token is an HMAC over (user_id, email) keyed
by MAILBOX_ENC_KEY — the web route (web/lib/unsub.ts) verifies the same way, so
no per-link state is stored. Tamper-proof and stateless.
"""
import os
import hmac
import base64
import hashlib
from urllib.parse import urlencode

APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000").rstrip("/")


def _secret() -> bytes:
    return base64.b64decode(os.environ["MAILBOX_ENC_KEY"])


def unsub_token(user_id: str, email: str) -> str:
    msg = f"{user_id}:{email.lower()}".encode()
    return hmac.new(_secret(), msg, hashlib.sha256).hexdigest()[:32]


def unsub_url(user_id: str, email: str) -> str:
    q = urlencode({"u": user_id, "e": email.lower(), "t": unsub_token(user_id, email)})
    return f"{APP_BASE_URL}/api/unsubscribe?{q}"
