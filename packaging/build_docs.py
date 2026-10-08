"""Takes manual screenshots of the running app and renders the Markdown guides to PDF (Playwright)."""
import os
import re
import sys
from pathlib import Path

import markdown
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "frontend" / "public" / "docs"
IMG = DOCS / "img"
OUT = ROOT / "downloads"
URL = sys.argv[1]
CODE = sys.argv[2]
PROFILE = sys.argv[3]
CONV = sys.argv[4] if len(sys.argv) > 4 else None
TITLES = {"manual": "Manual de uso", "guia-casa": "Guía: PC de casa", "guia-centro": "Guía: PC del centro", "problemas": "Problemas frecuentes"}

CSS = """
@page { size: A4; margin: 18mm 16mm 20mm; }
body { font-family: 'Segoe UI', 'DejaVu Sans', sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.55; }
h1 { color: #1B2A3A; font-size: 22pt; border-bottom: 3px solid #3FE0D0; padding-bottom: 6px; margin-top: 0; }
h2 { color: #1B2A3A; font-size: 14pt; margin-top: 18pt; page-break-after: avoid; }
h3 { color: #1B2A3A; font-size: 12pt; page-break-after: avoid; }
img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; margin: 6pt 0 10pt; page-break-inside: avoid; }
code { background: #f1f5f9; border-radius: 3px; padding: 0 3px; font-size: 9.5pt; }
blockquote { border-left: 4px solid #3FE0D0; background: #F0FDFB; margin: 8pt 0; padding: 6pt 10pt; }
li { margin: 2pt 0; }
.cover { display: flex; align-items: center; gap: 12px; margin-bottom: 10pt; color: #64748b; font-size: 9pt; }
.cover img { width: 42px; border: none; margin: 0; }
"""


def shots(p):
    b = p.chromium.launch(executable_path=os.environ.get('ORI_CHROME') or None)
    pg = b.new_page(viewport={"width": 1366, "height": 768}, device_scale_factor=1)
    pg.route("**/api/setup/status", lambda r: r.fulfill(json={"needs_setup": True}))
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_selector('[data-testid="setup-wizard"]')
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(IMG / "asistente.png"))
    pg.close()
    pg = b.new_page(viewport={"width": 1366, "height": 768}, device_scale_factor=1)
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_selector('[data-testid="access-code-input"]')
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(IMG / "acceso.png"))
    pg.wait_for_timeout(1000)
    pg.locator('[data-testid="access-code-input"]').press_sequentially(CODE, delay=30)
    pg.wait_for_timeout(300)
    pg.click('[data-testid="access-submit-button"]')
    pg.wait_for_timeout(1500)
    if pg.locator('[data-testid="access-error"]').count():
        print("DEBUG access error:", pg.inner_text('[data-testid="access-error"]'))
    try:
        pg.wait_for_selector(f'[data-testid="profile-pick-{PROFILE}"]', timeout=20000)
    except Exception:
        print("DEBUG", pg.url, pg.inner_text("body")[:400])
        raise
    pg.click(f'[data-testid="profile-pick-{PROFILE}"]')
    pg.wait_for_selector('[data-testid="conversation-sidebar"]')
    if CONV:
        pg.goto(f"{URL}/chat/{CONV}", wait_until="domcontentloaded")
        pg.wait_for_selector('[data-testid^="inline-cite-"]')
        pg.wait_for_timeout(1000)
        pg.screenshot(path=str(IMG / "chat.png"))
        pg.wait_for_timeout(1500)
        pg.locator('[data-testid^="inline-cite-"]').first.click()
        pg.wait_for_selector('[data-testid="doc-side-panel"]')
        pg.wait_for_timeout(1500)
        src = pg.get_attribute('[data-testid="doc-side-iframe"]', "src") if pg.locator('[data-testid="doc-side-iframe"]').count() else None
        if src:
            import base64

            import fitz
            m = re.search(r"#page=(\d+)", src)
            doc = fitz.open(stream=pg.request.get(src.split("#")[0]).body(), filetype="pdf")
            png = doc[(int(m.group(1)) if m else 1) - 1].get_pixmap(dpi=110).tobytes("png")
            pg.evaluate("""(b) => { const f = document.querySelector('[data-testid=doc-side-iframe]'); const d = document.createElement('div');
              d.style.cssText = 'height:100%;overflow:hidden;background:#525659;padding:14px;border-radius:8px';
              d.innerHTML = `<img src="data:image/png;base64,${b}" style="width:100%;box-shadow:0 2px 10px rgba(0,0,0,.45)">`; f.replaceWith(d); }""",
                        base64.b64encode(png).decode())
            pg.wait_for_timeout(500)
        pg.screenshot(path=str(IMG / "referencia.png"))
    for route, name, scroll in (("/biblioteca", "biblioteca", None), ("/chuletas", "chuletas", None), ("/plantillas", "plantillas", None),
                                ("/calculadoras", "calculadoras", '[data-testid="calc-cl-rotation-help"]'),
                                ("/ajustes", "ajustes", '[data-testid="settings-backup-card"]')):
        pg.goto(URL + route, wait_until="domcontentloaded")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1200)
        if scroll and pg.locator(scroll).count():
            pg.locator(scroll).scroll_into_view_if_needed()
            pg.wait_for_timeout(400)
        pg.screenshot(path=str(IMG / f"{name}.png"))
    b.close()


def pdfs(p):
    b = p.chromium.launch(executable_path=os.environ.get('ORI_CHROME') or None)
    pg = b.new_page()
    logo = (ROOT / "frontend" / "public" / "favicon.png").as_uri()
    for slug, title in TITLES.items():
        md = (DOCS / f"{slug}.md").read_text(encoding="utf-8")
        body = markdown.markdown(md, extensions=["tables", "fenced_code", "sane_lists"])
        body = re.sub(r'src="/docs/img/', f'src="{IMG.as_uri()}/', body)
        html = f"<html><head><meta charset='utf-8'><title>{title}</title><style>{CSS}</style></head><body>" \
               f"<div class='cover'><img src='{logo}'/><span>Ori · {title}</span></div>{body}</body></html>"
        tmp = DOCS / f".{slug}.html"
        tmp.write_text(html, encoding="utf-8")
        pg.goto(tmp.as_uri())
        pg.wait_for_load_state("networkidle")
        pg.pdf(path=str(OUT / f"{slug}.pdf"), format="A4", print_background=True, display_header_footer=True,
               header_template="<span></span>",
               footer_template="<div style='font-size:8px;color:#94a3b8;width:100%;text-align:center'>Ori · <span class='pageNumber'></span> / <span class='totalPages'></span></div>",
               margin={"top": "16mm", "bottom": "18mm", "left": "15mm", "right": "15mm"})
        tmp.unlink()
        print("pdf", slug)
    b.close()


if __name__ == "__main__":
    IMG.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        if "--no-shots" not in sys.argv:
            shots(p)
        pdfs(p)
