#!/usr/bin/env python3
"""
Codemod: makes server/, contracts/, db/ import-safe for Vercel's per-file
TypeScript function compiler (which enforces node16/nodenext resolution:
no bare path aliases, explicit .js extensions on relative imports).

Run from the repo root AFTER moving api/ -> server/:
    python3 fix_imports.py

Idempotent: safe to re-run.
"""
import re
import os
from pathlib import Path

ROOT = Path(__file__).parent.resolve()

IMPORT_RE = re.compile(
    r'''(from\s+|import\s*\(\s*|import\s+)(['"])(.*?)\2'''
)

ALIASES = {
    "@contracts/": ROOT / "contracts",
    "@db/": ROOT / "db",
}

def resolve_target(spec: str) -> Path | None:
    for prefix, base in ALIASES.items():
        if spec.startswith(prefix):
            return base / spec[len(prefix):]
    return None

def to_relative_js(from_file: Path, target_no_ext: Path) -> str:
    rel = os.path.relpath(target_no_ext, from_file.parent)
    if not rel.startswith("."):
        rel = "./" + rel
    return rel.replace(os.sep, "/") + ".js"

def fix_relative_spec(from_file: Path, spec: str) -> str | None:
    """Add .js to extensionless relative imports that point at real .ts files."""
    if not (spec.startswith("./") or spec.startswith("../")):
        return None
    if re.search(r'\.[a-zA-Z0-9]+$', spec):
        return None  # already has an extension
    candidate_file = (from_file.parent / spec).resolve()
    ts_file = candidate_file.with_suffix(".ts")
    tsx_file = candidate_file.with_suffix(".tsx")
    index_file = candidate_file / "index.ts"
    if ts_file.exists() or tsx_file.exists() or index_file.exists():
        if index_file.exists() and not ts_file.exists() and not tsx_file.exists():
            return spec.rstrip("/") + "/index.js"
        return spec + ".js"
    return None

def process_file(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    changed = False

    def repl(m: re.Match) -> str:
        nonlocal changed
        prefix, quote, spec = m.group(1), m.group(2), m.group(3)
        target = resolve_target(spec)
        if target is not None:
            new_spec = to_relative_js(path, target)
            changed = True
            return f"{prefix}{quote}{new_spec}{quote}"
        fixed = fix_relative_spec(path, spec)
        if fixed is not None and fixed != spec:
            changed = True
            return f"{prefix}{quote}{fixed}{quote}"
        return m.group(0)

    new_text = IMPORT_RE.sub(repl, text)
    if changed:
        path.write_text(new_text, encoding="utf-8")
        print(f"fixed: {path.relative_to(ROOT)}")

def main():
    targets = []
    for d in ("server", "contracts", "db"):
        dpath = ROOT / d
        if dpath.exists():
            targets += list(dpath.rglob("*.ts"))
    for f in targets:
        process_file(f)

if __name__ == "__main__":
    main()

