import { resolveTxt } from "dns/promises";

// Lightweight domain-auth check used at mailbox-connect time. Missing SPF/DMARC
// dramatically increases spam-folder rate, so we warn (not block) the user.
// DKIM is selector-specific and can't be checked generically, so we skip it.
export async function authWarnings(email: string): Promise<string[]> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return ["That email address looks invalid."];

  // public webmail domains are already authenticated — nothing to warn about
  if (["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "zoho.com"].includes(domain)) {
    return [];
  }

  const warnings: string[] = [];
  const hasTxt = async (host: string, marker: string) => {
    try {
      const records = await resolveTxt(host);
      return records.some((parts) => parts.join("").toLowerCase().includes(marker));
    } catch {
      return false;
    }
  };

  if (!(await hasTxt(domain, "v=spf1"))) {
    warnings.push(`No SPF record found for ${domain}. Add one or your mail may land in spam.`);
  }
  if (!(await hasTxt(`_dmarc.${domain}`, "v=dmarc1"))) {
    warnings.push(`No DMARC record found for ${domain}. Recruiters' servers may reject or junk your mail.`);
  }
  return warnings;
}
