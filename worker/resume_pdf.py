"""
Render a tailored resume (structured) to a clean single-column PDF using fpdf2
(pure-Python, no system deps — works locally and in GitHub Actions).
"""
import os
import tempfile

# fpdf2's core Helvetica font is latin-1 only; map common unicode then drop the rest.
_REPL = {"–": "-", "—": "-", "‘": "'", "’": "'",
         "“": '"', "”": '"', "•": "-", "₹": "Rs.", "…": "..."}


def _safe(s: str) -> str:
    s = s or ""
    for k, v in _REPL.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


def render(name: str, contact: str, summary: str, sections: list[dict]) -> str:
    """Write a PDF to a temp file; return its path."""
    from fpdf import FPDF
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    w = pdf.epw  # effective page width (between margins)

    def line(text, size, bold=False, gap=0, grey=False):
        if gap:
            pdf.ln(gap)
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B" if bold else "", size)
        pdf.set_text_color(90, 90, 90) if grey else pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(w, size * 0.5 + 1, _safe(text))

    line(name, 18, bold=True)
    if contact:
        line(contact, 9, grey=True)
    if summary:
        line(summary, 10.5, gap=2)
    for sec in sections or []:
        line(sec.get("heading", ""), 12.5, bold=True, gap=3)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(1)
        for b in sec.get("bullets", []):
            line(f"-  {b}", 10.5)

    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    pdf.output(path)
    return path
