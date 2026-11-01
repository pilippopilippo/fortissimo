#!/usr/bin/env python3
"""Assembla i sorgenti di src/ in un'unica pagina index.html.
Builds the sources in src/ into a single index.html page."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
MODULES = ["i18n.js", "schema.js", "engine.js", "ui.js"]

shell = (SRC / "shell.html").read_text(encoding="utf-8")
js = "\n".join((SRC / f).read_text(encoding="utf-8") for f in MODULES)
# l'export per Node serve solo ai test / the Node export is for tests only
js = js.replace('if (typeof module !== "undefined") module.exports', "if (false) module.exports")
assert "</script" not in js, "a module contains </script"
assert "/*@@SCRIPTS@@*/" in shell, "placeholder missing in shell.html"
out = shell.replace("/*@@SCRIPTS@@*/", js)
(ROOT / "index.html").write_text(out, encoding="utf-8")
print(f"index.html: {len(out):,} bytes")
