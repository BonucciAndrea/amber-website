/* tape.js — The Pit: you are the market maker.
 *
 * The page owns the clock, the canvas and the keyboard. Every number it shows
 * — the mid, the fills, the inventory, the cash, the P&L, the capture, the
 * drawdown — is computed in assets/tape/sim.k by the Amber engine and arrives
 * as one delimited line per tick.
 */
"use strict";

(function () {

var CFG = window.TAPE_CONFIG || {};
var RUNTIME = CFG.runtime || ["./amber.wasm.js", "./amber.js"];
var WORKER = CFG.worker || "./worker.js";
var SIM = CFG.sim || "./sim.k";

/* The fields of one tick, in the order sim.k's tout writes them. */
var FIELDS = ["px", "bid", "ask", "inv", "cash", "pnl", "tk", "nf",
              "vol", "flow", "fs", "fp", "fz", "rej", "cap", "mdd"];

var PRESETS = [
  ["flat 5c",    "px+-0.05 0.05"],
  ["tight 2c",   "px+-0.02 0.02"],
  ["wide 8c",    "px+-0.08 0.08"],
  ["skew",       "px+(-0.05 0.05)-0.005*inv"],
  ["skew hard",  "px+(-0.06 0.06)-0.012*inv"],
  ["vol-aware",  "px+((-1 1)*0.025+1.5*vol)-0.005*inv"],
  ["flow-aware", "px+((-0.05 0.05)-0.005*inv)+0.01*flow"],
  ["suicide",    "px+-0.001 0.001"]
];

var IDS = ["canvas", "expr", "err", "status", "led", "presets", "start", "pause",
           "share", "seed", "clock", "pnl", "inv", "fills", "cap", "dd", "spread",
           "tape", "summary", "sumwrap", "toast", "invbar", "note"];
var E = {};
for (var k = 0; k < IDS.length; k++) E[IDS[k]] = document.getElementById("tp-" + IDS[k]);

var ctx = E.canvas.getContext("2d");

var S = {
  ready: false, running: false, done: false,
  seed: 11,
  expr: PRESETS[3][1],
  round: 1200, ms: 50,
  hist: [],            // {px,bid,ask,pnl,inv} per tick, for the chart
  fills: [],           // recent fills for the tape
  last: null,
  err: "",
  acc: 0, lastT: 0, inflight: false
};

var HIST = 420;        // ticks kept on screen

/* ------------------------------------------------------------------ worker */
var W = null;

function boot() {
  if (W) { try { W.terminate(); } catch (e) {} }
  S.ready = false;
  setStatus("booting", "starting the engine…");
  try { W = new Worker(WORKER); }
  catch (err) {
    setStatus("error", "engine blocked");
    showErr(location.protocol === "file:"
      ? "Browsers block workers on file:// URLs. Serve the folder over HTTP and reload."
      : "the engine worker could not start: " + String((err && err.message) || err));
    return;
  }
  W.onmessage = onWorker;
  W.onerror = function (ev) { setStatus("error", "engine error"); showErr((ev && ev.message) || "worker failed"); };
  W.postMessage({ type: "boot", runtime: RUNTIME, sim: SIM });
}

function onWorker(ev) {
  var m = ev.data || {};

  if (m.type === "fatal") { setStatus("error", "engine unavailable"); showErr(m.message); return; }

  if (m.type === "ready") {
    S.ready = true;
    S.round = m.round || 1200;
    S.ms = m.ms || 50;
    setStatus("ready", "Amber " + (m.version || "") + " · wasm");
    W.postMessage({ type: "quote", src: S.expr });
    reset();
    requestAnimationFrame(loop);
    return;
  }

  if (m.type === "quote") { if (m.ok) clearErr(); else showErr(m.error); return; }

  if (m.type === "init") { draw(); paint(); return; }

  if (m.type === "tick") {
    S.inflight = false;
    if (m.error) { showErr(m.error); S.running = false; setRunLabel(); return; }
    for (var j = 0; j < m.rows.length; j++) absorb(m.rows[j]);
    if (m.done) finish();
    draw(); paint();
    return;
  }

  if (m.type === "stats") {
    if (E.summary) E.summary.textContent = m.text;
    if (E.sumwrap) E.sumwrap.hidden = false;
    return;
  }
}

/* One line from sim.k's tout -> one tick of state. */
function absorb(line) {
  var v = line.split(";"), o = {};
  for (var j = 0; j < FIELDS.length; j++) o[FIELDS[j]] = Number(v[j]);
  S.last = o;
  S.hist.push({ px: o.px, bid: o.bid, ask: o.ask, pnl: o.pnl, inv: o.inv });
  if (S.hist.length > HIST) S.hist.shift();
  if (o.fs !== 0) {
    S.fills.push({ tk: o.tk, side: o.fs, p: o.fp, z: o.fz, i: S.hist.length - 1 });
    if (S.fills.length > 400) S.fills.shift();
    // The tape is written here rather than in paint(): several ticks can be
    // absorbed in one batch, and paint() only ever sees the last of them, so
    // printing there would drop every fill but the final one.
    pushTape(o);
  }
}

/* -------------------------------------------------------------- round flow */
function reset() {
  S.hist = []; S.fills = []; S.last = null; S.done = false; S.running = false;
  S.acc = 0; S.inflight = false;
  if (E.sumwrap) E.sumwrap.hidden = true;
  if (E.tape) E.tape.innerHTML = "";
  W.postMessage({ type: "init", seed: S.seed });
  setRunLabel();
  note("Seed " + S.seed + " — the same seed is the same tape, so two runs are comparable.");
}

function finish() {
  S.running = false; S.done = true;
  setRunLabel();
  W.postMessage({ type: "stats" });
  var p = S.last ? S.last.pnl : 0;
  note("Round over — " + (p >= 0 ? "+" : "") + p.toFixed(2) + " on seed " + S.seed + ". Share it and let someone beat it.");
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!S.ready || !S.running || S.inflight) { S.lastT = now; return; }
  var dt = S.lastT ? now - S.lastT : 0;
  S.lastT = now;
  S.acc += dt;
  // Catch up if the tab was throttled, but never more than a short burst:
  // a backgrounded tab must not come back and fast-forward the whole round.
  var n = Math.floor(S.acc / S.ms);
  if (n <= 0) return;
  if (n > 12) n = 12;
  S.acc -= n * S.ms;
  S.inflight = true;
  W.postMessage({ type: "tick", n: n });
}

/* ------------------------------------------------------------------ canvas */
var dpr = 1, W2 = 0, H2 = 0;

function sizeCanvas() {
  var box = E.canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(1, Math.floor(box.width * dpr)), h = Math.max(1, Math.floor(box.height * dpr));
  if (E.canvas.width !== w || E.canvas.height !== h) { E.canvas.width = w; E.canvas.height = h; }
  W2 = E.canvas.width; H2 = E.canvas.height;
}

function cssVar(n, f) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return v || f;
}
var COL = {};
function readColours() {
  COL.up = cssVar("--accent", "#ffb020");
  COL.dn = cssVar("--cyan", "#56d4dd");
  COL.mid = cssVar("--text", "#ecedf1");
  COL.dim = cssVar("--text-faint", "#6e6f7b");
  COL.bg = cssVar("--code-bg", "#0a0a0f");
  COL.band = "rgba(255,176,32,.10)";
  COL.grid = "rgba(255,255,255,.055)";
}

function draw() {
  if (!W2) sizeCanvas();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, W2, H2);
  var h = S.hist;
  if (h.length < 2) return;

  var pad = 10 * dpr;
  var lo = Infinity, hi = -Infinity;
  for (var j = 0; j < h.length; j++) {
    if (h[j].bid < lo) lo = h[j].bid;
    if (h[j].ask > hi) hi = h[j].ask;
  }
  var span = hi - lo; if (!(span > 0)) span = 0.1;
  lo -= span * 0.12; hi += span * 0.12; span = hi - lo;

  // Grow the x-scale with the data until the window is full, then scroll:
  // fixing it at HIST from the first tick leaves the round drawing in a
  // sliver at the left edge for the first twenty seconds.
  var n = Math.max(80, Math.min(HIST, h.length));
  var X = function (i) { return pad + (W2 - 2 * pad) * (i / (n - 1)); };
  var Y = function (p) { return pad + (H2 - 2 * pad) * (1 - (p - lo) / span); };

  // price gridlines
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
  for (var g = 0; g <= 4; g++) {
    var yy = Math.round(pad + (H2 - 2 * pad) * g / 4) + 0.5;
    ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(W2 - pad, yy); ctx.stroke();
  }

  // the quoted band
  ctx.beginPath();
  for (j = 0; j < h.length; j++) { var x = X(j); if (j === 0) ctx.moveTo(x, Y(h[j].ask)); else ctx.lineTo(x, Y(h[j].ask)); }
  for (j = h.length - 1; j >= 0; j--) ctx.lineTo(X(j), Y(h[j].bid));
  ctx.closePath();
  ctx.fillStyle = COL.band; ctx.fill();

  // the mid
  ctx.beginPath();
  for (j = 0; j < h.length; j++) { var x2 = X(j); if (j === 0) ctx.moveTo(x2, Y(h[j].px)); else ctx.lineTo(x2, Y(h[j].px)); }
  ctx.strokeStyle = COL.mid; ctx.lineWidth = 1.6 * dpr; ctx.stroke();

  // fills: amber where we bought, cyan where we sold
  var base = S.hist.length - h.length;
  for (j = 0; j < S.fills.length; j++) {
    var f = S.fills[j], idx = f.i - base;
    if (idx < 0 || idx >= h.length) continue;
    ctx.beginPath();
    ctx.arc(X(idx), Y(f.p), (2.1 + 0.5 * Math.min(4, f.z)) * dpr, 0, 6.2832);
    ctx.fillStyle = f.side > 0 ? COL.up : COL.dn;
    ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
  }
}

/* ----------------------------------------------------------------- numbers */
function fmt(v, d) { return (v < 0 ? "" : "") + v.toFixed(d === undefined ? 2 : d); }

function paint() {
  var o = S.last;
  if (!o) return;
  if (E.pnl) {
    E.pnl.textContent = (o.pnl >= 0 ? "+" : "") + fmt(o.pnl);
    E.pnl.className = "tp-big " + (o.pnl > 0 ? "up" : o.pnl < 0 ? "dn" : "");
  }
  if (E.inv) E.inv.textContent = fmt(o.inv, 0);
  if (E.invbar) {
    var pct = Math.max(-1, Math.min(1, o.inv / 30));
    E.invbar.style.transform = "scaleX(" + Math.abs(pct) + ")";
    E.invbar.style.transformOrigin = pct >= 0 ? "left center" : "right center";
    E.invbar.style.background = pct >= 0 ? COL.up : COL.dn;
    E.invbar.style.marginLeft = pct >= 0 ? "50%" : "0";
    E.invbar.style.width = "50%";
  }
  if (E.fills) E.fills.textContent = String(o.nf);
  if (E.cap) E.cap.textContent = fmt(o.cap);
  if (E.dd) E.dd.textContent = fmt(o.mdd);
  if (E.spread) E.spread.textContent = fmt(100 * (o.ask - o.bid), 1) + "c";
  if (E.clock) {
    var left = Math.max(0, (S.round - o.tk) * S.ms / 1000);
    E.clock.textContent = left.toFixed(1) + "s";
  }
}

function pushTape(o) {
  var row = document.createElement("div");
  row.className = "tp-row " + (o.fs > 0 ? "buy" : "sell");
  row.innerHTML = '<span class="tp-side">' + (o.fs > 0 ? "BOT" : "SLD") + '</span>' +
                  '<span class="tp-sz">' + o.fz.toFixed(0) + '</span>' +
                  '<span class="tp-px">' + o.fp.toFixed(3) + '</span>' +
                  '<span class="tp-vs">' + ((o.fs > 0 ? o.px - o.fp : o.fp - o.px) >= 0 ? "+" : "") +
                  (100 * (o.fs > 0 ? o.px - o.fp : o.fp - o.px)).toFixed(1) + 'c</span>';
  E.tape.insertBefore(row, E.tape.firstChild);
  while (E.tape.childNodes.length > 40) E.tape.removeChild(E.tape.lastChild);
}

/* ------------------------------------------------------------------ chrome */
function setStatus(cls, text) {
  if (E.status) E.status.textContent = text;
  if (E.led) E.led.className = "tp-led " + cls;
}
function setRunLabel() {
  if (!E.start) return;
  E.start.textContent = S.done ? "New round" : S.running ? "Running…" : S.hist.length ? "Resume" : "Start round";
  if (E.pause) E.pause.disabled = !S.running;
}
function showErr(m) {
  S.err = m || "";
  if (E.err) { E.err.textContent = S.err; E.err.hidden = !S.err; }
  if (E.expr) E.expr.classList.toggle("bad", !!S.err);
}
function clearErr() { if (S.err) showErr(""); }
function note(m) { if (E.note) E.note.textContent = m; }

var toastT = 0;
function toast(m) {
  if (!E.toast) return;
  E.toast.textContent = m; E.toast.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(function () { E.toast.classList.remove("on"); }, 2400);
}

/* ------------------------------------------------------------------- share */
function b64(s) {
  var b = new TextEncoder().encode(s), o = "";
  for (var j = 0; j < b.length; j++) o += String.fromCharCode(b[j]);
  return btoa(o).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  var b = atob(s), a = new Uint8Array(b.length);
  for (var j = 0; j < b.length; j++) a[j] = b.charCodeAt(j);
  return new TextDecoder().decode(a);
}
function writeHash() {
  try { history.replaceState(null, "", "#t=" + b64(JSON.stringify({ q: S.expr, s: S.seed }))); } catch (e) {}
}
function readHash() {
  var m = /[#&]t=([^&]+)/.exec(location.hash);
  if (!m) return null;
  try {
    var o = JSON.parse(unb64(m[1]));
    return { q: String(o.q || ""), s: (o.s | 0) || 11 };
  } catch (e) { return null; }
}
function share() {
  writeHash();
  var url = location.href, p = S.last ? S.last.pnl : 0;
  var done = function () { toast("Link copied — same quote, same seed, same tape."); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { toast(url); });
  else toast(url);
}

/* ------------------------------------------------------------------ wiring */
function build() {
  PRESETS.forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "tp-pill"; b.textContent = p[0];
    b.addEventListener("click", function () {
      setExpr(p[1]);
      Array.prototype.forEach.call(E.presets.querySelectorAll("button"), function (o) { o.classList.toggle("on", o === b); });
    });
    E.presets.appendChild(b);
  });
}

function setExpr(src) {
  S.expr = src;
  if (E.expr && E.expr.value !== src) E.expr.value = src;
  if (S.ready) W.postMessage({ type: "quote", src: src });
  writeHash();
}

function wire() {
  E.expr.addEventListener("input", function () { setExpr(E.expr.value); });
  E.expr.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); E.expr.blur(); } });

  E.start.addEventListener("click", function () {
    if (!S.ready) return;
    if (S.done || !S.hist.length) { reset(); S.done = false; }
    S.running = true; S.lastT = 0; S.acc = 0;
    setRunLabel();
  });
  E.pause.addEventListener("click", function () { S.running = false; setRunLabel(); });
  E.share.addEventListener("click", share);

  E.seed.addEventListener("change", function () {
    var v = parseInt(E.seed.value, 10);
    S.seed = isNaN(v) ? 11 : Math.abs(v) % 100000;
    E.seed.value = S.seed;
    reset();
  });

  window.addEventListener("keydown", function (ev) {
    var tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (ev.code === "Space") { ev.preventDefault(); if (S.running) { S.running = false; } else if (S.ready && !S.done) { S.running = true; S.lastT = 0; } setRunLabel(); }
  });

  window.addEventListener("resize", function () { sizeCanvas(); draw(); });
  var mo = new MutationObserver(function () { readColours(); draw(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

function init() {
  readColours(); build(); wire();
  var h = readHash();
  if (h && h.q) { S.expr = h.q; S.seed = h.s; }
  E.expr.value = S.expr;
  E.seed.value = S.seed;
  sizeCanvas();
  setRunLabel();
  boot();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
