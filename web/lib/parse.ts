// Client-side parsing helpers for the Compose page.
// Heavy formats (PDF/Excel) are handed to the Python worker later; here we
// handle the two things we can do instantly in the browser: pasted emails
// and CSV text.

export type Contact = {
  name: string;
  first_name: string;
  email: string;
  title: string;
  company: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function firstNameFrom(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const tok = n.split(/\s+/)[0];
    if (tok.length > 1 && !["hr", "the", "mr", "ms", "dr"].includes(tok.toLowerCase()))
      return tok[0].toUpperCase() + tok.slice(1);
  }
  const local = email.split("@")[0].split(/[._\-0-9]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1) : "there";
}

function companyFromDomain(email: string): string {
  const dom = (email.split("@")[1] || "").split(".")[0];
  if (!dom) return "";
  return dom.charAt(0).toUpperCase() + dom.slice(1);
}

// Pasted emails: split on commas / spaces / newlines, validate, dedupe.
export function parseEmails(text: string): Contact[] {
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({
      name: "",
      first_name: firstNameFrom("", email),
      email,
      title: "",
      company: companyFromDomain(email),
    });
  }
  return out;
}

// Minimal CSV parser (header row with name/email/title/company columns).
export function parseCsv(text: string): Contact[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const cells = (l: string) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = cells(lines[0]).map((h) => h.toLowerCase());
  const idx = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const ei = idx(["email", "mail"]);
  const ni = idx(["name", "contact"]);
  const ti = idx(["title", "designation", "role"]);
  const ci = idx(["company", "organisation", "organization"]);
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const line of lines.slice(ei >= 0 ? 1 : 0)) {
    const c = cells(line);
    const email = (ei >= 0 ? c[ei] : c.find((x) => EMAIL_RE.test(x)) || "").toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    const name = ni >= 0 ? c[ni] || "" : "";
    out.push({
      name,
      first_name: firstNameFrom(name, email),
      email,
      title: ti >= 0 ? c[ti] || "" : "",
      company: (ci >= 0 ? c[ci] : "") || companyFromDomain(email),
    });
  }
  return out;
}
