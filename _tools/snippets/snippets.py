#!/usr/bin/env python3
"""snippets.py [--write] - check every Amber snippet on the site that gets a Run button, in the notepad's engine.

A snippet is a <pre> that assets/js/run.js would pick (lang-q / lang-k / lang-amber / l-q code, or an amber>
transcript). Each one is run alone, the way the notepad runs it. One that fails alone is tried again after the
snippets before it on the same page (nearest first, as few as it needs): a tutorial that builds a table in one block
and queries it in the next. With --write each <pre> is marked for run.js:
    data-rid="N"                       its number on the page
    data-run="ok"                      runs on its own
    data-run="ctx" data-ctx="2 3"      runs after snippets 2 and 3 of the page, which run.js sends first
    data-run="no"                      errors either way (a local file, a server, an error shown on purpose): no button
run.js only puts a Run button on ok and ctx. Run it again after changing a page's code."""
import glob, html, json, os, re, subprocess, sys

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PRE = re.compile(r"<pre\b[^>]*>.*?</pre>", re.S)

# A snippet that only lacks data the prose describes gets a setup: run first, sent with it by run.js under a
# "/ setup" comment, never shown on the page. Keyed by page and the snippet's first line.
SETUP = {
    ("blog/03-attributes.html", "v:`sa asc 2000000?1000000000"): "gentq 1000",
    ("blog/06-two-point-oh.html", "2 3 9 in 2 3 4"): "t:([]sym:`a`b`a; px:10 20 30)\nkt:([sym:`a`b] sector:`tech`bank)",
    ("blog/06-two-point-oh.html", "/ after the stdlib is up:"): "gentq 1000",
    ("blog/temporal-offsets.html", "minbar[w; t]"): "w:5; u:60000\nt:34200000 34400500 34865250 35939999   / times of day in ms, as a time column holds them\nx:0 3 7 12 25",
    ("docs/temporal.html", "minbar[w; t]"): "w:5; u:60000\nt:34200000 34400500 34865250 35939999   / times of day in ms, as a time column holds them\nx:0 3 7 12 25",
    ("docs/gotchas.html", "{[U] 3#U?U}[U]'til NB"): "U:`AAPL`MSFT`IBM`GOOG`AMZN\nNB:4",
    ("docs/language.html", "wavg[sz; px]"): "sz:100 200 300\npx:10.0 11.0 12.5\nw:5\nx:0 1 2 3 4 5 6 7",
    ("docs/performance.html", "M: (1800; 12) # data"): "data:21600?100.0",
}
# A snippet too big for the browser engine is sent with one line swapped (and later snippets run after that):
# (old line, new lines). The browser engine runs on one thread: 5M trades take it ~40 s, a tenth a few seconds.
TENTH = "/ the page makes 5000000 trades; the browser engine runs on one thread, so here it makes a tenth\n"
OVERRIDE = {
    ("tutorials/tick-store.html", "\\ts gentq 5000000"): ("\\ts gentq 5000000", TENTH + "\\ts gentq 500000"),
    ("blog/array-languages-hft.html", "gentq 5000000"): ("gentq 5000000", TENTH + "gentq 500000"),
}

def key_of(rel, code):
    first = code.strip().split("\n")[0]
    for (p, k) in list(SETUP) + list(OVERRIDE):
        if p == rel and first.startswith(k): return (p, k)
    return None

def text_of(block):   # the <pre>'s innerText: tags out, entities decoded
    inner = re.sub(r"^<pre\b[^>]*>|</pre>$", "", block, flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", inner))

def is_amber(block):   # run.js isAmber()
    m = re.search(r'<code\b[^>]*class="([^"]*)"', block)
    cls = m.group(1) if m else ""
    if re.search(r"\b(lang-(q|k|amber)|l-q)\b", cls): return True
    if cls and not re.search(r"\bhl\b", cls): return False
    return re.search(r"(?m)^amber>", text_of(block)) is not None

def runnable(text):   # run.js runnable(): a transcript gives only what was typed, continuations indented
    lines = text.replace("\r", "").split("\n")
    if not any(l.startswith("amber>") for l in lines): return text
    out = []
    for l in lines:
        m = re.match(r"^amber>\s?(.*)$", l); c = re.match(r"^\s*\.\.\.>\s?(.*)$", l)
        if m: out.append(m.group(1))
        elif c: out.append("  " + c.group(1))
    return "\n".join(out)

def run(items):
    p = subprocess.run(["node", os.path.join(SITE, "_tools/snippets/eval.js")], input=json.dumps(items).encode(),
                       stdout=subprocess.PIPE, check=True)
    return {r["id"]: r for r in json.loads(p.stdout)}

def strip_marks(block):
    return re.sub(r'\s+data-(rid|run|ctx|setup|code)="[^"]*"', "", block)

pages = sorted(p for p in glob.glob(os.path.join(SITE, "**/*.html"), recursive=True)
               if "/_" not in p.replace("\\", "/") and not p.endswith("notepad.html"))
found = {}
for p in pages:
    t = open(p, encoding="utf-8", newline="").read()
    snips = []
    for m in PRE.finditer(t):
        b = strip_marks(m.group(0))
        if 'class="np-' in b or not is_amber(b) or not text_of(b).strip(): continue
        code = runnable(text_of(b)); rel = os.path.relpath(p, SITE).replace("\\", "/"); k = key_of(rel, code)
        setup = SETUP.get(k, "") if k else ""
        sw = OVERRIDE.get(k) if k else None
        over = code.replace(sw[0], sw[1], 1) if sw else ""
        snips.append({"start": m.start(), "end": m.end(), "code": code, "setup": setup, "over": over,
                      "full": (setup + "\n" if setup else "") + (over or code)})   # what run.js sends for it
    if snips: found[p] = snips

if "--verify" in sys.argv:
    # what a Run button really sends, rebuilt from the marked pages as run.js builds it (piece, source), then run:
    # every ok and ctx block must come out clean
    def attr(block, n):
        m = re.search(r'^<pre\b[^>]*\bdata-%s="([^"]*)"' % n, block)
        return html.unescape(m.group(1)) if m else None
    def piece(b):
        setup, code = attr(b, "setup"), attr(b, "code") or runnable(text_of(b))
        return ("/ setup, not shown on the page\n" + setup.rstrip() + "\n/ ----\n" if setup else "") + code.rstrip()
    items = []
    for p in pages:
        t = open(p, encoding="utf-8", newline="").read()
        blocks = {attr(m.group(0), "rid"): m.group(0) for m in PRE.finditer(t) if attr(m.group(0), "rid") is not None}
        for rid, b in blocks.items():
            if attr(b, "run") not in ("ok", "ctx"): continue
            deps = [blocks[d] for d in (attr(b, "ctx") or "").split()]
            src = piece(b) if not deps else "/ setup: the code before this on the page\n" + "\n".join(piece(d) for d in deps) + "\n/ ---- this snippet\n" + piece(b)
            items.append({"id": os.path.relpath(p, SITE).replace("\\", "/") + " #" + rid, "code": src})
    res = run(items)
    bad = [r for r in res.values() if not r["ok"]]
    for r in bad: print("FAILS", r["id"], r["why"])
    print("verified", len(items), "Run buttons,", len(bad), "failing")
    sys.exit(1 if bad else 0)

if "--dump" in sys.argv:   # every snippet's code, for reading
    for p, ss in found.items():
        for i, s in enumerate(ss):
            print("=====", os.path.relpath(p, SITE).replace("\\", "/"), "#", i); print(s["code"])
    sys.exit(0)

# 1. each alone
alone = run([{"id": "%s#%d" % (p, i), "code": s["full"]} for p, ss in found.items() for i, s in enumerate(ss)])
# 2. the failures, after the passing snippets before them, nearest first, one more each round
status = {}
for p, ss in found.items():
    okk = []   # indices that run, alone or with context, in page order
    for i, s in enumerate(ss):
        r = alone["%s#%d" % (p, i)]
        if r["ok"]: status[(p, i)] = ("ok", [], ""); okk.append(i); continue
        status[(p, i)] = ("no", [], r["why"])
        for k in range(1, len(okk) + 1):
            deps = sorted(okk[-k:])
            code = "\n".join(ss[j]["full"] for j in deps) + "\n" + s["full"]
            r2 = run([{"id": "x", "code": code}])["x"]
            if r2["ok"]: status[(p, i)] = ("ctx", deps, ""); okk.append(i); break
            # a dependency of a ctx snippet brings its own context along: keep it simple, prefix grows to cover it
        if status[(p, i)][0] == "no":
            status[(p, i)] = ("no", [], r["why"])

# report
cnt = {"ok": 0, "ctx": 0, "no": 0}
for (p, i), (st, deps, why) in status.items():
    cnt[st] += 1
for p, ss in found.items():
    rel = os.path.relpath(p, SITE).replace("\\", "/")
    for i, s in enumerate(ss):
        st, deps, why = status[(p, i)]
        if st != "ok":
            first = s["code"].strip().split("\n")[0][:60]
            print("%-34s #%-2d %-3s %s%s" % (rel, i, st, ("after " + " ".join(map(str, deps)) + "  ") if deps else "", first if st == "ctx" else first + "  ->  " + why))
print("snippets:", sum(cnt.values()), cnt)

# 3. mark the pages
if "--write" in sys.argv:
    for p, ss in found.items():
        t = open(p, encoding="utf-8", newline="").read()
        for i in reversed(range(len(ss))):
            s = ss[i]; st, deps, _ = status[(p, i)]
            block = strip_marks(t[s["start"]:s["end"]])
            attrs = ' data-rid="%d" data-run="%s"' % (i, st) + (' data-ctx="%s"' % " ".join(map(str, deps)) if st == "ctx" else "")
            if st != "no" and s["setup"]: attrs += ' data-setup="%s"' % html.escape(s["setup"], quote=True).replace("\n", "&#10;")
            if st != "no" and s["over"]: attrs += ' data-code="%s"' % html.escape(s["over"], quote=True).replace("\n", "&#10;")
            block = re.sub(r"^<pre\b", lambda m: "<pre" + attrs, block, count=1)   # a function: a replacement STRING would turn \t into a tab
            t = t[:s["start"]] + block + t[s["end"]:]
        open(p, "w", encoding="utf-8", newline="").write(t)
    print("marked", len(found), "pages")
