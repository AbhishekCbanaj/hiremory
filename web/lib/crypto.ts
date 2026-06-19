import crypto from "crypto";

// AES-256-GCM secret encryption. SERVER-ONLY (uses MAILBOX_ENC_KEY).
// Format: "v1.<base64 iv>.<base64 ciphertext>.<base64 authTag>"
// The Python worker decrypts the same format (worker/crypto.py).
//
// Generate the key once:  openssl rand -base64 32
// and set MAILBOX_ENC_KEY in web/.env.local AND worker/.env (same value).

function key(): Buffer {
  const k = process.env.MAILBOX_ENC_KEY;
  if (!k) throw new Error("MAILBOX_ENC_KEY is not set");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("MAILBOX_ENC_KEY must be 32 bytes (base64-encoded)");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${ct.toString("base64")}.${tag.toString("base64")}`;
}

export function decryptSecret(blob: string): string {
  const [v, ivB, ctB, tagB] = blob.split(".");
  if (v !== "v1") throw new Error("unknown secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}
