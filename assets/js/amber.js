/* =============================================================================
   Amber — site runtime.  No dependencies, no build step.
   ============================================================================= */
(function () {
  "use strict";

  /* ---- theme --------------------------------------------------------- */
  var root = document.documentElement;
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("amber-theme", t); } catch (e) {}
  }
  window.__amberToggleTheme = function () {
    applyTheme(root.getAttribute("data-theme") === "light" ? "dark" : "light");
  };

  /* ---- nav ----------------------------------------------------------- */
  function initNav() {
    var nav = document.querySelector(".nav");
    if (nav) {
      var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 6); };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    var t = document.getElementById("theme-toggle");
    if (t) t.addEventListener("click", window.__amberToggleTheme);
    var burger = document.getElementById("nav-toggle");
    var links = document.getElementById("nav-links");
    if (burger && links) {
      burger.addEventListener("click", function () {
        var open = links.classList.toggle("open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  /* ---- q / K syntax highlighting -------------------------------------- */
  var QWORDS = ("select exec update delete from where by within insert upsert " +
    "asc desc iasc idesc xasc xdesc xkey xcol xcols xgroup ungroup " +
    "aj aj0 wj lj ij uj pj ej asof meta cols keys flip enlist raze " +
    "sum prd min max avg med var dev svar sdev cov cor wsum wavg count first last " +
    "sums prds mins maxs deltas ratios differ prev next distinct group til " +
    "wavg xbar bar minbar hms stime ptime year month day dow hh mm sec milli minute second " +
    "vwap twap ema movavg movsum movmax movmin rollstd rvol ret logret bars symstats " +
    "gentq genopt taq tsign effspread mid spread spreadbps micro imbal notional signedvol " +
    "peach show plot candle string type value key null neg abs exp log sqrt floor ceiling " +
    "signum reciprocal reverse where mod div round xlog like ss ssr sv vs trim ltrim rtrim " +
    "lower upper sublist cross rank xrank rotate xprev in except inter union " +
    "qby qselect qwhere fby dset dget splay dload partsave partload parts " +
    "hopen hclose hsend hrecv hsync mcount msum mavg mprd mvar mdev mmin mmax dot mmu " +
    "parse eval reval ser deser protect cast long int float char sym bool " +
    "import export print len range def class return if else for while lambda True False None"
  ).split(/\s+/);
  var QSET = Object.create(null);
  QWORDS.forEach(function (w) { QSET[w] = 1; });

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function span(cls, txt) { return '<span class="' + cls + '">' + esc(txt) + "</span>"; }

  function highlightQ(src) {
    var out = "", i = 0, n = src.length, prev = "";
    function isValueChar(c) { return c && /[A-Za-z0-9_\])}."`]/.test(c); }
    while (i < n) {
      var c = src[i];
      // whole-line comment  ("/" at line start) or " / " trailing comment
      var atLineStart = (i === 0 || src[i - 1] === "\n");
      if (c === "/" && (atLineStart || (!isValueChar(prev) && /\s/.test(src[i - 1] || " ")))) {
        var j = src.indexOf("\n", i); if (j < 0) j = n;
        out += span("tok-com", src.slice(i, j)); i = j; prev = ""; continue;
      }
      if (c === "#" && atLineStart) { // shell comment inside bash blocks
        var j2 = src.indexOf("\n", i); if (j2 < 0) j2 = n;
        out += span("tok-com", src.slice(i, j2)); i = j2; prev = ""; continue;
      }
      if (c === '"') {                                     // string
        var k = i + 1;
        while (k < n && !(src[k] === '"' && src[k - 1] !== "\\")) k++;
        out += span("tok-str", src.slice(i, Math.min(k + 1, n))); prev = '"'; i = k + 1; continue;
      }
      if (c === "`") {                                     // symbol (possibly `a`b`c or `"x")
        var k2 = i + 1;
        if (src[k2] === '"') { k2++; while (k2 < n && src[k2] !== '"') k2++; k2++; }
        else { while (k2 < n && /[A-Za-z0-9.]/.test(src[k2])) k2++; }
        out += span("tok-sym", src.slice(i, k2)); prev = "`"; i = k2; continue;
      }
      if (/[0-9]/.test(c) && !isValueChar(prev)) {         // number / temporal literal
        var k3 = i;
        while (k3 < n && /[0-9a-fA-FxnNwW.:DT]/.test(src[k3])) {
          // stop a bracket-adjacent letter run from swallowing identifiers
          if (/[a-zA-Z]/.test(src[k3]) && !/[nNwWxbDT]/.test(src[k3])) break;
          k3++;
        }
        out += span("tok-num", src.slice(i, k3)); prev = "0"; i = k3; continue;
      }
      if (/[A-Za-z]/.test(c)) {                            // identifier
        var k4 = i;
        while (k4 < n && /[A-Za-z0-9_.]/.test(src[k4])) k4++;
        var w = src.slice(i, k4);
        var bare = w.indexOf(".") > -1 ? w.split(".").pop() : w;
        if (QSET[w] || QSET[bare]) out += span(/^(select|exec|update|delete|from|where|by|within|if|else|for|while|return|import|def|class|True|False|None)$/.test(w) ? "tok-kw" : "tok-fn", w);
        else out += esc(w);
        prev = "a"; i = k4; continue;
      }
      if ("+-*%!&|<>=~,^#_$?@.:;'\\".indexOf(c) > -1) {
        out += span("tok-op", c); prev = c; i++; continue;
      }
      out += esc(c);
      if (!/\s/.test(c)) prev = c;
      i++;
    }
    return out;
  }

  function highlightPlain(src) {  // terminal output blocks: dim everything, keep structure
    return esc(src);
  }

  function initHighlight(scope) {
    (scope || document).querySelectorAll("pre > code").forEach(function (code) {
      if (code.dataset.hl) return;
      code.dataset.hl = "1";
      var cls = code.className || "";
      if (/lang-(q|k|amber)/.test(cls)) code.innerHTML = highlightQ(code.textContent);
      else if (/lang-(sh|bash|shell)/.test(cls)) code.innerHTML = highlightShell(code.textContent);
      else if (/lang-(py|python)/.test(cls)) code.innerHTML = highlightPy(code.textContent);
      else if (/lang-(json|yaml|yml|toml|ini)/.test(cls)) code.innerHTML = highlightConf(code.textContent);
      else if (/lang-out/.test(cls)) code.innerHTML = '<span class="tok-out">' + highlightPlain(code.textContent) + "</span>";
    });
  }

  function highlightShell(src) {
    return esc(src)
      .replace(/(^|\n|\s{2})(\s*)(#.*)/g, function (m, a, b, c) { return a + b + '<span class="tok-com">' + c + "</span>"; })
      .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-str">$1</span>')
      .replace(/(^|\n)(\s*)(\$ )?\b(git|cd|make|npm|npx|pip|python|python3|sudo|apt-get|apt|brew|curl|docker|go|mage|export|chmod|bash|sh|jupyter|ollama|mkdir|ln|source|pytest|node|vsce|zip|open)\b/g,
        function (m, a, b, d, cmd) { return a + b + (d || "") + '<span class="tok-fn">' + cmd + "</span>"; })
      .replace(/(\s)(--?[A-Za-z][\w-]*)/g, '$1<span class="tok-op">$2</span>');
  }
  function highlightPy(src) {
    return esc(src)
      .replace(/(#.*)/g, '<span class="tok-com">$1</span>')
      .replace(/(&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;|&quot;[^&\n]*?&quot;|&#39;[^&\n]*?&#39;)/g, '<span class="tok-str">$1</span>')
      .replace(/\b(import|from|as|def|class|return|if|elif|else|for|while|with|in|not|and|or|None|True|False|lambda|yield|assert|try|except|finally|print)\b/g, '<span class="tok-kw">$1</span>')
      .replace(/\b(\d[\d_]*\.?\d*)\b/g, '<span class="tok-num">$1</span>');
  }
  function highlightConf(src) {
    return esc(src)
      .replace(/(^|\n)(\s*)(#.*)/g, '$1$2<span class="tok-com">$3</span>')
      .replace(/(&quot;[^&\n]*?&quot;)(\s*:)/g, '<span class="tok-sym">$1</span>$2')
      .replace(/:(\s*)(&quot;[^&\n]*?&quot;)/g, ':$1<span class="tok-str">$2</span>')
      .replace(/(^|\n)(\s*)([A-Za-z_][\w.-]*)(:)/g, '$1$2<span class="tok-sym">$3</span>$4')
      .replace(/\b(true|false|null)\b/g, '<span class="tok-kw">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  }

  /* ---- copy buttons ---------------------------------------------------- */
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  function initCopy() {
    document.querySelectorAll(".code").forEach(function (block) {
      if (block.querySelector(".copy-btn")) return;
      var pre = block.querySelector("pre");
      if (!pre) return;
      var btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code");
      btn.innerHTML = ICON_COPY + "<span>Copy</span>";
      btn.addEventListener("click", function () {
        var text = pre.innerText;
        var done = function () {
          btn.classList.add("done");
          btn.innerHTML = ICON_OK + "<span>Copied</span>";
          setTimeout(function () {
            btn.classList.remove("done");
            btn.innerHTML = ICON_COPY + "<span>Copy</span>";
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
        } else fallback(text, done);
      });
      block.appendChild(btn);
    });
  }
  function fallback(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---- card pointer glow ---------------------------------------------- */
  function initGlow() {
    document.querySelectorAll(".card").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--mx", (e.clientX - r.left) + "px");
        c.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ---- reveal on scroll ----------------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    // safety net: never leave content hidden, whatever the observer does
    setTimeout(function () { els.forEach(function (e) { e.classList.add("in"); }); }, 2400);
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("in"); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---- TOC build + scrollspy ------------------------------------------- */
  function slug(s) {
    return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  }
  function initToc() {
    var content = document.querySelector(".doc-content, .prose-toc-source");
    var toc = document.getElementById("toc-list");
    if (!content) return;
    var heads = content.querySelectorAll("h2, h3");
    heads.forEach(function (h) {
      if (!h.id) h.id = slug(h.textContent);
      if (!h.querySelector(".anchor")) {
        var a = document.createElement("a");
        a.className = "anchor"; a.href = "#" + h.id; a.textContent = "#";
        a.setAttribute("aria-label", "Link to this section");
        h.appendChild(a);
      }
    });
    if (!toc) return;
    heads.forEach(function (h) {
      if (h.tagName === "H3" && heads.length > 22) return;
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.replace(/#$/, "");
      if (h.tagName === "H3") a.className = "lvl3";
      toc.appendChild(a);
    });
    var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visible.add(en.target.id); else visible.delete(en.target.id);
      });
      var first = null;
      heads.forEach(function (h) { if (!first && visible.has(h.id)) first = h.id; });
      links.forEach(function (l) { l.classList.toggle("active", l.getAttribute("href") === "#" + first); });
    }, { rootMargin: "-70px 0px -70% 0px" });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ---- hero terminal --------------------------------------------------- */
  var SCRIPT = [
    { p: "amber> ", t: "gentq 5000000", d: 26,
      o: ["<span class=\"tok-out\">/ 5,000,000 trades + 10,000,000 quotes generated in 2.38s</span>"] },
    { p: "amber> ", t: "select vwap:wavg[sz;px] by time:1m xbar time from trades", d: 17,
      o: [
        "<span class=\"tok-out\">time         vwap    </span>",
        "<span class=\"tok-out\">---------------------</span>",
        "09:30:00.000 <span class=\"tok-num\">187.2841</span>",
        "09:31:00.000 <span class=\"tok-num\">187.3106</span>",
        "09:32:00.000 <span class=\"tok-num\">187.2955</span>",
        "09:33:00.000 <span class=\"tok-num\">187.4012</span>",
        "<span class=\"tok-out\">..</span>",
        "<span class=\"tok-out\">[390 rows x 2 cols]   151.2 ms</span>"
      ] },
    { p: "amber> ", t: "m:aj[`sym`time; trades; quotes]   / native C as-of join", d: 20,
      o: ["<span class=\"tok-out\">704.0 ms  ·  branch-free lower_bound over sorted ns timestamps</span>"] },
    { p: "amber> ", t: "\\trace select from m where px>mid", d: 24,
      o: [
        "<span class=\"tok-out\">+---------------------------------------------------+</span>",
        "<span class=\"tok-out\">| Parse      2us  [                    ]   0.9%   |</span>",
        "<span class=\"tok-out\">| Arena      3us  [                    ]   1.3%   |</span>",
        "<span class=\"tok-out\">| Execute  212us  [</span><span class=\"tok-sym\">■■■■■■■■■■■■■■■</span><span class=\"tok-out\">     ]  76.7%   |</span>",
        "<span class=\"tok-out\">| Format    58us  [</span><span class=\"tok-sym\">■■■■</span><span class=\"tok-out\">                ]  21.1%   |</span>",
        "<span class=\"tok-out\">+---------------------------------------------------+</span>"
      ] }
  ];

  function initTerminal() {
    var el = document.getElementById("hero-term");
    if (!el) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      var html = "";
      SCRIPT.forEach(function (s) {
        html += '<span class="prompt">' + s.p + "</span>" + highlightQ(s.t) + "\n";
        s.o.forEach(function (l) { html += l + "\n"; });
        html += "\n";
      });
      el.innerHTML = html + '<span class="prompt">amber> </span><span class="cursor"></span>';
      return;
    }
    var buf = "", step = 0, chr = 0, phase = "type";
    var cursor = '<span class="cursor"></span>';
    function render(cur) { el.innerHTML = buf + (cur || ""); el.scrollTop = el.scrollHeight; }
    function tick() {
      var s = SCRIPT[step];
      if (phase === "type") {
        if (chr === 0) buf += '<span class="prompt">' + s.p + "</span>";
        chr++;
        var typed = s.t.slice(0, chr);
        render(highlightQ(typed) + cursor);
        if (chr >= s.t.length) {
          buf += highlightQ(s.t) + "\n";
          phase = "out"; chr = 0;
          setTimeout(tick, 380);
        } else setTimeout(tick, s.d + Math.random() * 26);
        return;
      }
      if (phase === "out") {
        if (chr < s.o.length) { buf += s.o[chr] + "\n"; chr++; render(cursor); setTimeout(tick, 70); return; }
        buf += "\n"; phase = "type"; chr = 0; step++;
        if (step >= SCRIPT.length) {
          render('<span class="prompt">amber> </span>' + cursor);
          setTimeout(function () { buf = ""; step = 0; chr = 0; phase = "type"; tick(); }, 5200);
          return;
        }
        setTimeout(tick, 520);
      }
    }
    var started = false;
    var start = function () { if (!started) { started = true; setTimeout(tick, 500); } };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { start(); io.disconnect(); } }, { threshold: .2 });
      io.observe(el);
    } else start();
  }

  /* ---- live tick chart (canvas) ---------------------------------------- */
  function initTickChart() {
    var wrap = document.getElementById("tickchart");
    if (!wrap) return;
    var cv = wrap.querySelector("canvas");
    var pxEl = wrap.querySelector(".px");
    var ctx = cv.getContext("2d");
    var N = 220, px = [], vol = [], last = 187.32;
    for (var i = 0; i < N; i++) {
      last += (Math.random() - 0.5) * 0.055 + (Math.random() < .5 ? 1 : -1) * 0.012;
      last = Math.max(180, Math.min(195, last));
      px.push(last);
      vol.push(Math.pow(Math.random(), 2.4) * 100 + 6);
    }
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function step() {
      // bid-ask bounce + small drift: mean-reverting tick returns
      var drift = (Math.random() - 0.5) * 0.055;
      var bounce = (Math.random() < .5 ? 1 : -1) * 0.012;
      last = Math.max(180, Math.min(195, last + drift + bounce));
      px.push(last); px.shift();
      vol.push(Math.pow(Math.random(), 2.4) * 100 + 6); vol.shift();
    }
    function draw() {
      var W = cv.clientWidth, H = cv.clientHeight;
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      var lo = Math.min.apply(null, px), hi = Math.max.apply(null, px);
      var pad = (hi - lo) * 0.22 + 0.02; lo -= pad; hi += pad;
      var volH = H * 0.26, chartH = H - volH - 8;
      var X = function (i) { return 4 + (i / (N - 1)) * (W - 8); };
      var Y = function (v) { return 6 + (1 - (v - lo) / (hi - lo)) * (chartH - 12); };

      // grid
      ctx.strokeStyle = css("--border") || "rgba(255,255,255,.08)";
      ctx.lineWidth = 1;
      for (var g = 0; g <= 3; g++) {
        var y = 6 + (g / 3) * (chartH - 12);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // volume
      var accent = css("--accent") || "#ffb020";
      ctx.fillStyle = accent; ctx.globalAlpha = .22;
      var bw = Math.max(1, W / N - 1);
      for (var i2 = 0; i2 < N; i2++) {
        var h = (vol[i2] / 110) * volH;
        ctx.fillRect(X(i2) - bw / 2, H - h, bw, h);
      }
      ctx.globalAlpha = 1;
      // area
      var grad = ctx.createLinearGradient(0, 0, 0, chartH);
      grad.addColorStop(0, "rgba(255,176,32,.26)");
      grad.addColorStop(1, "rgba(255,176,32,0)");
      ctx.beginPath(); ctx.moveTo(X(0), chartH);
      for (var i3 = 0; i3 < N; i3++) ctx.lineTo(X(i3), Y(px[i3]));
      ctx.lineTo(X(N - 1), chartH); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      // line
      ctx.beginPath();
      for (var i4 = 0; i4 < N; i4++) { var xx = X(i4), yy = Y(px[i4]); i4 ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.strokeStyle = accent; ctx.lineWidth = 1.7; ctx.lineJoin = "round"; ctx.stroke();
      // last dot
      ctx.beginPath(); ctx.arc(X(N - 1), Y(px[N - 1]), 3.2, 0, Math.PI * 2);
      ctx.fillStyle = accent; ctx.fill();
      ctx.beginPath(); ctx.arc(X(N - 1), Y(px[N - 1]), 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,176,32,.18)"; ctx.fill();
    }
    var prev = last;
    function loop() {
      for (var k = 0; k < 2; k++) step();
      draw();
      if (pxEl) {
        pxEl.textContent = last.toFixed(2);
        pxEl.classList.toggle("dn", last < prev);
        prev = last;
      }
      if (!reduce) timer = setTimeout(function () { requestAnimationFrame(loop); }, 90);
    }
    var timer = null;
    resize(); draw();
    window.addEventListener("resize", function () { resize(); draw(); });
    if ("IntersectionObserver" in window) {
      var running = false;
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && !running) { running = true; loop(); }
        else if (!en[0].isIntersecting) { running = false; clearTimeout(timer); }
      }, { threshold: .15 });
      io.observe(wrap);
    } else loop();
  }

  /* ---- boot ------------------------------------------------------------ */
  function boot() {
    initNav(); initHighlight(); initCopy(); initGlow(); initReveal();
    initToc(); initTerminal(); initTickChart();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
