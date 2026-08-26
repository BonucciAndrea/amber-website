# Amber — showcase website

A static marketing + documentation site for **[Amber](https://github.com/BonucciAndrea/amber)**,
the C99 columnar in-memory array engine with a q/kdb+ vocabulary, and its ecosystem.

**Zero build dependencies.** Every file in this folder is already the deployable artifact — plain
HTML, one CSS file, one JS file, a handful of SVGs. There is no bundler, no framework, no
`node_modules`, and no build step. Drop the folder on any static host and it works.

---

## Deploy

### GitHub Pages

1. Create a repository and push the contents of this folder to it (the files must be at the
   repository root, not inside a subfolder).
2. **Settings → Pages → Build and deployment → Source: _Deploy from a branch_**, branch `main`,
   folder `/ (root)`.
3. Done. `.nojekyll` is already present, which stops Jekyll from mangling anything.

All internal links are **relative**, so the site works correctly whether it is served from
`https://user.github.io/` or from `https://user.github.io/repo-name/`.

### Vercel

```bash
npm i -g vercel
vercel deploy --prod
```

`vercel.json` is included: it sets `cleanUrls`, and adds a one-year immutable cache header for
`/assets/*`. Framework preset: **Other**. Build command: none. Output directory: `.`

### Netlify / Cloudflare Pages / S3 / nginx

Upload the folder. Set the 404 page to `404.html` if the host asks.

### Locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Layout

```
.
├── index.html                  landing page — hero terminal, features, benchmarks, ecosystem
├── 404.html
├── docs/
│   ├── index.html              introduction
│   ├── install.html            build from source, shell config, environment variables
│   ├── language.html           K expressions, qSQL, joins, attributes, the finance module
│   ├── temporal.html           the 2000-01-01 epoch, d / t / p types, every conversion
│   ├── protocol.html           amberd, IPC framing, JSONC, streaming sockets
│   ├── capi.html               libamber.so and the ext/ extension seam
│   └── benchmarks.html         ten engines, four workloads, the correctness gate
├── ecosystem/
│   ├── index.html              the three seams and every satellite
│   ├── python-amber.html       zero-copy NumPy / pandas / Arrow, in-process
│   ├── amber-arrow.html        ArrowArrayStream, amberd, Arrow Flight
│   ├── amber-jupyter.html      the native kernel, %%python, batch_rows
│   ├── amber-tick.html         the simulator, the store, the live pipeline
│   ├── grafana.html            mage build, plugin.json, unsigned plugins, panels
│   ├── vscode-amber.html       LSP, qSQL completion, idiom hovers
│   └── amber-ai.html           the local co-pilot and the ext/ seam
├── tutorials/
│   ├── index.html
│   ├── tick-store.html         a 5-million-row in-memory tick store in 60 seconds
│   ├── grafana-pipeline.html   store → marts → amberd → datasource → panels
│   └── arrow-interop.html      Arrow record batches into Python without copying
├── blog/
│   ├── index.html
│   ├── array-languages-hft.html
│   ├── zero-copy-arrow.html
│   └── temporal-offsets.html
├── assets/
│   ├── css/amber.css           the whole design system: tokens, components, responsive rules
│   ├── js/amber.js             theme, nav, copy buttons, q/K highlighter, terminal, tick chart
│   └── img/                    logo.svg, favicon.svg
├── robots.txt
├── sitemap.xml
├── vercel.json
└── .nojekyll
```

---

## Design notes

**Theme.** Dark by default. The toggle in the navigation bar writes `amber-theme` to
`localStorage` and stamps `data-theme` on `<html>`; an inline script in every `<head>` applies the
stored value before first paint, so there is no flash. The entire palette is CSS custom properties
declared on `:root` and overridden under `html[data-theme="light"]`.

**Type.** Inter for prose, JetBrains Mono for code, both from Google Fonts with full system
fallback stacks. If the font request fails the site degrades to `-apple-system` / `ui-monospace`
and still looks deliberate.

**Syntax highlighting** is a small hand-written tokenizer in `assets/js/amber.js` that understands
K/q's two context-sensitive rules — `/` is the *over* adverb after a value and a comment at the
start of a line or when surrounded by whitespace; `\` is the *scan* adverb mid-expression and a
REPL command at line start. Shell, Python, JSON/YAML and plain terminal output have their own
lighter passes. Mark a block with `class="lang-q"`, `lang-sh`, `lang-py`, `lang-json`,
`lang-yaml`, or `lang-out`.

**Progressive enhancement.** Nothing on the page requires JavaScript to be readable. Scroll-reveal
animations are gated behind an `html.has-js` class and have a 2.4-second safety timeout, so a
JS failure can never leave content invisible. `prefers-reduced-motion` disables the typing
animation and the live chart.

**Responsive.** Wide content — tables, diagrams, code blocks, the terminal — scrolls inside its
own container; the page body never scrolls horizontally at any width down to 320 px.

---

## Editing

Pages are plain HTML. Open the file, edit it, reload.

Shared chrome (the navigation bar and the footer) is duplicated into every page so that each file
is standalone and no JavaScript is needed to render it. If you change a navigation link, change it
everywhere — `grep -rl 'ecosystem/index.html' .` finds them.

Two conventions worth keeping:

- **Code blocks** use this structure so the copy button and the highlighter find them:

  ```html
  <div class="code">
    <div class="code-head">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <span class="name">amber&gt;</span>
    </div>
    <pre><code class="lang-q">select vwap:wavg[sz;px] by sym from trades</code></pre>
  </div>
  ```

  `<` and `>` inside a code block must be escaped as `&lt;` / `&gt;`.

- **Documentation pages** wrap their body in
  `<div class="wrap"><div class="docs-layout">…<article class="doc-content prose">…</article>…</div></div>`.
  Heading anchors and the "On this page" list are generated at runtime from the `h2`/`h3` elements
  inside `.doc-content`.

---

## Sources

Every technical claim, benchmark figure, configuration snippet and API signature on this site is
taken from the project repositories:

| | |
|---|---|
| Core engine & server | <https://github.com/BonucciAndrea/amber> |
| Zero-copy Arrow bridge | <https://github.com/BonucciAndrea/amber-arrow> |
| Grafana datasource | <https://github.com/BonucciAndrea/grafana-amber-datasource> |
| VS Code extension (LSP) | <https://github.com/BonucciAndrea/vscode-amber> |
| Jupyter kernel | <https://github.com/BonucciAndrea/amber-jupyter> |
| Tick store & real-time data | <https://github.com/BonucciAndrea/amber-tick> |
| Python bindings | <https://github.com/BonucciAndrea/python-amber> |
| Vector & AI extensions | <https://github.com/BonucciAndrea/amber-ai> |
| Browser scratchpad | <https://github.com/BonucciAndrea/amber-notepad> |

Amber itself is licensed under the GNU AGPLv3; its interpreter core derives from
[ngn/k](https://codeberg.org/ngn/k).
