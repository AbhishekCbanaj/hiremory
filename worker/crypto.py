"""
Decrypt mailbox secrets encrypted by the web app (web/lib/crypto.ts).

Same scheme both sides: AES-256-GCM, format
  "v1.<base64 iv>.<base64 ciphertext>.<base64 authTag>"
Key comes from MAILBOX_ENC_KEY (base64, 32 bytes) — identical in web + worker.
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _key() -> bytes:
    k = os.environ.get("MAILBOX_ENC_KEY")
    if not k:
        raise RuntimeError("MAILBOX_ENC_KEY is not set")
    raw = base64.b64decode(k)
    if len(raw) != 32:
        raise RuntimeError("MAILBOX_ENC_KEY must be 32 bytes (base64-encoded)")
    return raw


def decrypt_secret(blob: str) -> str:
    version, iv_b, ct_b, tag_b = blob.split(".")
    if version != "v1":
        raise ValueError("unknown secret format")
    iv = base64.b64decode(iv_b)
    ct = base64.b64decode(ct_b)
    tag = base64.b64decode(tag_b)
    # Python's AESGCM expects ciphertext || tag concatenated.
    return AESGCM(_key()).decrypt(iv, ct + tag, None).decode("utf-8")
