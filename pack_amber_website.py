#!/usr/bin/env python3
"""
pack_amber_website.py
=====================

Packs the generated Amber showcase site into `amber-website.zip`, ready to
unzip straight into a fresh GitHub repository (or drag onto Vercel / Netlify).

The site has **no build step** — every file is already the deployable
artifact — so this script only walks a directory and writes a zip.

Usage
-----
    python3 pack_amber_website.py                 # pack ./amber-website (or the script's own folder)
    python3 pack_amber_website.py path/to/site    # pack an explicit folder
    python3 pack_amber_website.py site -o out.zip # choose the output name
    python3 pack_amber_website.py --wrap          # nest everything under amber-website/ in the zip

By default the files are placed at the **root of the archive**, so unzipping
into a fresh clone gives you `index.html` at the repository root — which is
what GitHub Pages ("Deploy from a branch", folder `/ (root)`) expects.

Requires nothing but the Python standard library (3.8+).
"""

from __future__ import annotations

import argparse
import os
import sys
import zipfile

NAME = "amber-website"

# Never ship these.
SKIP_DIRS = {
    ".git", ".github", "__pycache__", "node_modules", ".vercel", ".netlify",
    ".idea", ".vscode", ".DS_Store", ".pytest_cache", ".mypy_cache", "venv", ".venv",
}
SKIP_FILES = {".DS_Store", "Thumbs.db", "desktop.ini"}
SKIP_SUFFIXES = (".pyc", ".pyo", ".swp", ".swo", "~", ".orig", ".rej")

# Files that must exist for the archive to be a working site.
REQUIRED = ["index.html", "assets/css/amber.css", "assets/js/amber.js"]


def find_source(explicit: str | None) -> str:
    """Locate the site folder: an explicit path, ./amber-website, or the script's own folder."""
    if explicit:
        src = os.path.abspath(explicit)
        if not os.path.isdir(src):
            sys.exit(f"error: {src} is not a directory")
        return src

    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (os.path.join(os.getcwd(), NAME), os.path.join(here, NAME), here, os.getcwd()):
        if os.path.isfile(os.path.join(candidate, "index.html")):
            return os.path.abspath(candidate)

    sys.exit(
        "error: could not find the site folder.\n"
        f"       Looked for an index.html in ./{NAME}/, next to this script, and in the\n"
        "       current directory. Pass the path explicitly:\n"
        "           python3 pack_amber_website.py path/to/site"
    )


def should_skip(rel: str) -> bool:
    base = os.path.basename(rel)
    return base in SKIP_FILES or rel.endswith(SKIP_SUFFIXES)


def collect(src: str) -> list[tuple[str, str]]:
    """Return (absolute_path, archive_relative_path) pairs, sorted for a reproducible archive."""
    items: list[tuple[str, str]] = []
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, src).replace(os.sep, "/")
            if should_skip(rel):
                continue
            items.append((full, rel))
    return items


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:,.0f} {unit}" if unit == "B" else f"{n / 1:,.1f} {unit}"
        n /= 1024.0
    return f"{n} B"


def main() -> int:
    ap = argparse.ArgumentParser(description="Pack the Amber showcase site into a zip archive.")
    ap.add_argument("source", nargs="?", help="site folder (default: auto-detect)")
    ap.add_argument("-o", "--output", default=f"{NAME}.zip", help=f"output file (default: {NAME}.zip)")
    ap.add_argument("--wrap", action="store_true",
                    help=f"nest the files under a top-level {NAME}/ directory inside the zip")
    ap.add_argument("-q", "--quiet", action="store_true", help="only print the final line")
    args = ap.parse_args()

    src = find_source(args.source)
    out = os.path.abspath(args.output)

    missing = [r for r in REQUIRED if not os.path.isfile(os.path.join(src, r))]
    if missing:
        sys.exit("error: %s does not look like the Amber site — missing: %s"
                 % (src, ", ".join(missing)))

    items = collect(src)
    if not items:
        sys.exit(f"error: nothing to pack in {src}")

    # Do not zip the archive into itself.
    items = [(f, r) for (f, r) in items if os.path.abspath(f) != out]

    if not args.quiet:
        print(f"source : {src}")
        print(f"output : {out}")
        print(f"files  : {len(items)}")
        print()

    raw = 0
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for full, rel in items:
            arc = f"{NAME}/{rel}" if args.wrap else rel
            raw += os.path.getsize(full)
            z.write(full, arc)
            if not args.quiet:
                print(f"  + {arc}")

    packed = os.path.getsize(out)
    ratio = (1 - packed / raw) * 100 if raw else 0
    if not args.quiet:
        print()
    print(f"wrote {out}  —  {len(items)} files, {human(raw)} -> {human(packed)} ({ratio:.0f}% smaller)")

    if not args.quiet:
        print()
        print("Next:")
        print("  1. Create an empty repository on GitHub.")
        print(f"  2. Unzip {os.path.basename(out)} into your clone (files go at the repo root).")
        print("  3. git add -A && git commit -m 'Amber showcase site' && git push")
        print("  4. Settings -> Pages -> Deploy from a branch -> main -> / (root)")
        print()
        print("  Vercel instead:  vercel deploy --prod   (no build command, output directory '.')")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
