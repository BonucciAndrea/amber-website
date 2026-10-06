/* run.js - a Run button on the site's Amber code blocks: it opens the notepad in a new tab with the code in the
   link, and the notepad runs it. Styles itself, works with any page's markup, and sits to the left of the page's
   own copy button.

   Only blocks that are known to run get one. _tools/snippets/snippets.py runs every Amber block in the notepad's
   engine and marks each <pre>:
     data-run="ok"                    runs on its own
     data-run="ctx" data-ctx="0 2"    runs after those blocks of the page (data-rid), which are sent first
     data-run="no"                    errors whatever it is given: no button
     data-setup="..."                 data the prose only describes, sent first under a "/ setup" comment
     data-code="..."                  sent instead of the block's text (a size the browser engine can do)
   A block that has not been checked has no data-run, and no button: run the checker after editing a page. */
(function () {
  "use strict";
  if (location.protocol === "file:") return;

  var ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>';
  var CSS =
    ".amber-run-host{position:relative}" +
    ".amber-run{position:absolute;top:8px;right:8px;z-index:3;display:inline-flex;align-items:center;gap:6px;" +
    "font:500 .72rem/1.2 Inter,system-ui,sans-serif;padding:5px 9px;border-radius:7px;cursor:pointer;" +
    "border:1px solid rgba(255,255,255,.11);background:rgba(20,20,26,.85);color:#9a9ba6;opacity:0;" +
    "transition:opacity .18s,color .16s,border-color .16s;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".amber-run svg{width:11px;height:11px}" +
    ".amber-run-host:hover .amber-run,.amber-run:focus-visible{opacity:1}" +
    ".amber-run:hover{color:#ffb020;border-color:rgba(255,176,32,.45)}" +
    "@media (hover:none){.amber-run{opacity:1}}";

  // the code of a block: a REPL transcript (amber> prompts, ...> continuations, then output) gives only what was
  // typed, a continuation indented so the notepad joins it to the line above
  function runnable(text) {
    var lines = text.replace(/\r/g, "").split("\n"), typed = [];
    if (!lines.some(function (l) { return /^amber>/.test(l); })) return text;
    lines.forEach(function (l) {
      var m = /^amber>\s?(.*)$/.exec(l), c = /^\s*\.\.\.>\s?(.*)$/.exec(l);
      if (m) typed.push(m[1]); else if (c) typed.push("  " + c[1]);
    });
    return typed.join("\n");
  }
  // a block as it is sent: its setup, then its code (or the stand-in for it)
  function piece(pre) {
    var setup = pre.getAttribute("data-setup"), code = pre.getAttribute("data-code") || runnable(pre.innerText);
    return (setup ? "/ setup, not shown on the page\n" + setup.replace(/\s+$/, "") + "\n/ ----\n" : "") + code.replace(/\s+$/, "");
  }
  function source(pre) {
    var deps = (pre.getAttribute("data-ctx") || "").split(/\s+/).filter(Boolean).map(function (id) {
      return document.querySelector('pre[data-rid="' + id + '"]');
    }).filter(Boolean);
    if (!deps.length) return piece(pre);
    return "/ setup: the code before this on the page\n" + deps.map(piece).join("\n") + "\n/ ---- this snippet\n" + piece(pre);
  }
  function b64u(u) {
    var s = ""; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function openInNotepad(src) {
    var w = window.open("", "_blank");   // now, while the click still counts, so it is not blocked as a popup
    var base = location.origin + (location.hostname === "amber-lang.org" ? "/notepad" : "/notepad.html");
    var bytes = new TextEncoder().encode(src.replace(/\s+$/, "") + "\n");
    var go = function (code) { var url = base + "#" + code; if (w) w.location = url; else location.href = url; };
    if (typeof CompressionStream === "function") {
      new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()
        .then(function (b) { go("z" + b64u(new Uint8Array(b))); }, function () { go("u" + b64u(bytes)); });
    } else go("u" + b64u(bytes));
  }

  function add(pre) {
    var host = pre.closest(".code") || pre;
    if (host.querySelector(".amber-run")) return;
    host.classList.add("amber-run-host");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "amber-run";
    btn.title = "Open this code in the notepad and run it";
    btn.innerHTML = ICON + "<span>Run</span>";
    btn.addEventListener("click", function (e) { e.stopPropagation(); openInNotepad(source(pre)); });
    host.appendChild(btn);
    // left of the page's own copy button, at its height
    var copy = host.querySelector(".copy-btn, button.copy, .copy");
    if (copy && copy !== btn) {
      var hr = host.getBoundingClientRect(), cr = copy.getBoundingClientRect();
      if (cr.width) { btn.style.right = (hr.right - cr.left + 6) + "px"; btn.style.top = (cr.top - hr.top) + "px"; }
    }
  }
  function init() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    Array.prototype.forEach.call(document.querySelectorAll('pre[data-run="ok"], pre[data-run="ctx"]'), add);
  }
  // after the page's own scripts have added their copy buttons
  if (document.readyState === "complete") setTimeout(init, 0);
  else window.addEventListener("load", function () { setTimeout(init, 0); });
})();
