"""
Parse an HR contact list (PDF / Excel / Docx) into a clean contacts.csv.

Expected columns (any order, fuzzy-matched): Name, Email, Title, Company.
Output columns: name, first_name, email, title, company.

Usage:
    python parse_contacts.py "uploads/CompanyWise HR contact.pdf"
"""
import re
import sys
import os
import pandas as pd

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")


def _first_name(name: str, email: str) -> str:
    """Best-effort first name for the greeting."""
    name = (name or "").strip()
    if name:
        token = name.split()[0]
        if token.lower() not in {"hr", "the", "mr", "ms", "dr"} and len(token) > 1:
            return token.capitalize()
    # fall back to the email local part
    local = (email or "").split("@")[0]
    local = re.split(r"[._\-0-9]", local)[0]
    return local.capitalize() if local else "there"


def _clean_rows(rows: list[dict]) -> pd.DataFrame:
    out = []
    seen = set()
    for r in rows:
        email = (r.get("email") or "").strip().lower()
        m = EMAIL_RE.search(email)
        if not m:
            continue
        email = m.group(0)
        if email in seen:
            continue
        seen.add(email)
        name = (r.get("name") or "").strip()
        out.append({
            "name": name,
            "first_name": _first_name(name, email),
            "email": email,
            "title": (r.get("title") or "").strip(),
            "company": (r.get("company") or "").strip(),
        })
    return pd.DataFrame(out)


def _match_cols(columns):
    """Map fuzzy header names to our canonical keys."""
    mapping = {}
    for c in columns:
        lc = str(c).strip().lower()
        if "email" in lc or "mail" in lc:
            mapping[c] = "email"
        elif lc in ("name", "hr name", "contact", "contact name"):
            mapping[c] = "name"
        elif "title" in lc or "designation" in lc or "role" in lc:
            mapping[c] = "title"
        elif "company" in lc or "organisation" in lc or "organization" in lc:
            mapping[c] = "company"
        elif lc == "name":
            mapping[c] = "name"
    return mapping


def parse_excel(path):
    df = pd.read_excel(path)
    df = df.rename(columns=_match_cols(df.columns))
    return _clean_rows(df.to_dict("records"))


def parse_docx(path):
    from docx import Document
    doc = Document(path)
    rows = []
    for table in doc.tables:
        headers = [c.text for c in table.rows[0].cells]
        cmap = _match_cols(headers)
        keys = [cmap.get(h, None) for h in headers]
        for row in table.rows[1:]:
            cells = [c.text for c in row.cells]
            rows.append({k: v for k, v in zip(keys, cells) if k})
    return _clean_rows(rows)


def parse_pdf(path):
    import pdfplumber
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables() or []
            for table in tables:
                if not table or len(table) < 2:
                    continue
                headers = [str(h or "") for h in table[0]]
                cmap = _match_cols(headers)
                keys = [cmap.get(h, None) for h in headers]
                # if header row wasn't recognized, fall back to positional guess
                if "email" not in keys:
                    keys = _positional_keys(table)
                for raw in table[1:]:
                    rows.append({k: (c or "") for k, c in zip(keys, raw) if k})
            # fallback: scrape any emails from raw text if no tables found
            if not tables:
                text = page.extract_text() or ""
                for line in text.splitlines():
                    m = EMAIL_RE.search(line)
                    if m:
                        rows.append({"email": m.group(0), "name": line.split(m.group(0))[0]})
    return _clean_rows(rows)


def _positional_keys(table):
    """Guess column order by finding which column holds emails."""
    ncols = max(len(r) for r in table)
    email_col = None
    for ci in range(ncols):
        for r in table[1:]:
            if ci < len(r) and r[ci] and EMAIL_RE.search(str(r[ci])):
                email_col = ci
                break
        if email_col is not None:
            break
    keys = [None] * ncols
    if email_col is not None:
        keys[email_col] = "email"
        if email_col - 1 >= 0:
            keys[email_col - 1] = "name"
        if email_col + 1 < ncols:
            keys[email_col + 1] = "title"
        if email_col + 2 < ncols:
            keys[email_col + 2] = "company"
    return keys


def clean(df: pd.DataFrame, drop_generic=True, dedupe_company=True):
    """Remove low-value rows so we don't burn sends / sender reputation.

    Returns (cleaned_df, report_dict). Drops:
      - role-less / shared inboxes (hr@, info@, jobs@, qa@, ...)
      - placeholder / junk names (e.g. first==last gibberish, single tokens)
      - duplicate companies (keeps the first), if dedupe_company.
    """
    import config
    start = len(df)
    report = {"start": start, "generic": 0, "placeholder": 0, "dupe_company": 0}
    if df.empty:
        return df, report

    keep = []
    seen_companies = set()
    for _, r in df.iterrows():
        email = str(r["email"]).lower()
        local = email.split("@")[0]
        name = str(r.get("name", "")).strip()

        if drop_generic and local in config.GENERIC_LOCALPARTS:
            report["generic"] += 1
            continue
        # placeholder names like "Friend Friend", "Artoon Solutions", "Img Infotech"
        toks = name.split()
        if len(toks) >= 2 and toks[0].lower() == toks[1].lower():
            report["placeholder"] += 1
            continue
        if dedupe_company:
            comp = str(r.get("company", "")).strip().lower()
            if comp and comp in seen_companies:
                report["dupe_company"] += 1
                continue
            if comp:
                seen_companies.add(comp)
        keep.append(r)

    out = pd.DataFrame(keep).reset_index(drop=True)
    report["kept"] = len(out)
    report["removed"] = start - len(out)
    return out, report


def parse(path) -> pd.DataFrame:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".xlsx", ".xls"):
        return parse_excel(path)
    if ext == ".docx":
        return parse_docx(path)
    if ext == ".pdf":
        return parse_pdf(path)
    if ext == ".csv":
        df = pd.read_csv(path).rename(columns=_match_cols(pd.read_csv(path, nrows=0).columns))
        return _clean_rows(df.to_dict("records"))
    raise ValueError(f"Unsupported file type: {ext}")


if __name__ == "__main__":
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "data/contacts.csv"
    df = parse(src)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    df.to_csv(out, index=False)
    print(f"Parsed {len(df)} unique contacts -> {out}")
