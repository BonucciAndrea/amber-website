/* dots.js — Dots: a 32x32 grid, one Amber expression, re-evaluated every frame.
 *
 * The page owns the markup and the styling; this file owns the engine
 * conversation, the frame loop and the renderer. It expects a DOTS_CONFIG
 * global (runtime script URLs + worker URL) and the element ids listed in IDS.
 *
 * How a frame works, end to end:
 *   rAF -> post {t, mx, my, md} to the worker
 *       -> worker assigns those four globals and calls DOT[]
 *       -> DOT[] quantises F[]'s N values into N printable ASCII bytes
 *       -> the string comes back and is drawn as N circles
 * One frame is one string, so there is no per-cell crossing of the JS/wasm
 * boundary and no array parsing. Measured at ~0.07 ms of engine time for a
 * 32x32 grid, which is about 0.4% of a 60 fps budget — the readout in the
 * footer is that number, live, not a claim.
 */
"use strict";

(function () {

var CFG = window.DOTS_CONFIG || {};
var RUNTIME = CFG.runtime || ["./amber.wasm.js", "./amber.js"];
var WORKER = CFG.worker || "./worker.js";

/* ---------------------------------------------------------------- presets --
 * Each preset is [label, expression, setup]. `setup` runs once (on load and on
 * every grid change) and is shown in the setup box when non-empty, because a
 * preset whose state appears from nowhere reads as a trick rather than as code.
 */
var PRESETS = [
  ["rings",     "sin t-R", ""],
  ["ripple",    "sin (0.1*t)+(0.3*X)+0.3*Y", ""],
  ["cursor",    "sin (2*t)-%((X-mx)*(X-mx))+((Y-my)*(Y-my))", ""],
  // A radial wave multiplied by a hyperbolic one: the product is four-fold
  // symmetric, so the whole frame is a mandala that breathes as cos 0.5*t
  // rescales the rings.
  ["kaleido",   "sin (0.4*%((X-cx)*(X-cx))+((Y-cy)*(Y-cy)))*cos 0.5*t+0.25*(X-cx)*(Y-cy)%8", ""],
  // The same two ingredients added rather than multiplied, with the twist
  // term falling off as 1/R^2 -- which is what curls the rings into a spiral.
  ["vortex",    "sin (1.1*R)-(9*(X-cx)*(Y-cy))%(1+(R*R))-2*t", ""],
  ["mandala",   "sin (0.9*R)-(0.5*t)+2*sin (0.22*(X-cx)*(Y-cy))%(1+0.1*R)", ""],
  // Two copies of the grid rotated at slightly different rates; where they
  // interfere you get moire turbulence that never repeats.
  ["turbulence", "sin ((0.5*(X-cx)*cos t)+(0.5*(Y-cy)*sin t))*sin ((0.5*(X-cx)*cos 1.1*t)-(0.5*(Y-cy)*sin 1.1*t))", ""],
  // An actual escape-time Julia set. 18{...}/ iterates z->z^2+c over the WHOLE
  // grid at once -- the state is a 5-tuple of N-vectors (zr, zi, escape count,
  // and c carried along because a k lambda sees globals, not the enclosing
  // function's locals). c walks the circle of radius 0.7885, so the set morphs
  // between dendrite and disk. sin of the escape count bands the exterior.
  ["julia",     "cr:0.7885*cos 0.27*t; ci:0.7885*sin 0.27*t; s:18{[s](((s 3)+((s 0)*s 0)-(s 1)*s 1);((s 4)+2*(s 0)*s 1);((s 2)+4>((s 0)*s 0)+(s 1)*s 1);s 3;s 4)}/(0.055*X-cx;0.055*Y-cy;N#0;cr;ci); sin (0.85*`f$s 2)-1.5*t", ""],
  ["saddle",    "(X-mx)*(Y-my)%64", ""],
  ["blobs",     "{sin x}@(0.6*X)*sin 0.6*Y+t", ""],
  ["plaid",     "(sin (0.4*X)+t)*cos (0.4*Y)-t", ""],
  ["moire",     "sin (X*Y)%(1+0.6*t)", ""],
  ["plasma",    "0.34*(sin (0.3*X)+t)+(cos (0.3*Y)+0.7*t)+sin (0.2*R)-t", ""],
  ["spin",      "sin (0.35*(X-cx)*cos t)+(0.35*(Y-cy)*sin t)", ""],
  ["pulse",     "(sin 1.5*t)-R%12", ""],
  ["two waves", "0.5*(sin (0.5*t)-%((X-0.3*G)*(X-0.3*G))+((Y-0.3*G)*(Y-0.3*G)))+sin (0.5*t)-%((X-0.7*G)*(X-0.7*G))+((Y-0.7*G)*(Y-0.7*G))", ""],
  ["checker",   "-1+2*0=2!X+Y", ""],
  ["twinkle",   "-1+2*N?1.0", ""],
  // Conway's Life. The whole board's neighbour count is one indexed sum over
  // NB, the 8 wrapped neighbour index vectors the harness precomputes — no
  // loop over cells, no loop over neighbours. A dead cell is 0, which has
  // zero magnitude and so draws nothing.
  ["life",      "`f$b::lf b", "`prng 9; b:N?2; lf:{n:+/x@NB; `i$(n=3)|x&n=2}"],
  // Life again, but keeping a fading memory of where the cells have been.
  // The expression must not END on a `::` assignment: a lambda whose last
  // statement is a global assign returns a projection rather than the value,
  // so it closes on a bare `v`.
  ["trails",    "v::(`f$b::lf b)|0.9*v; v", "`prng 9; b:N?2; v:`f$b; lf:{n:+/x@NB; `i$(n=3)|x&n=2}"],
  // Five gliders, placed at fractions of the grid so they fit at any size.
  ["gliders",   "`f$b::lf b", "b:N#0; gl:{[o]o+(1;G+2;(2*G);(2*G)+1;(2*G)+2)}; os:{[a;b](G*_a*G)+_b*G}; b[,/gl'(os[0.05;0.05];os[0.35;0.55];os[0.6;0.15];os[0.78;0.7])]:1; lf:{n:+/x@NB; `i$(n=3)|x&n=2}"],
  // B36/S23 -- Life plus birth on six, which gives it replicators.
  ["highlife",  "`f$b::hl b", "`prng 4; b:N?2; hl:{n:+/x@NB; `i$((n=3)|x&n=2)|(~x)&n=6}"],
  // B2/S -- nothing survives a turn, so a single domino explodes outwards.
  ["seeds",     "`f$b::sd b", "b:N#0; c:(_N%2)+_G%2; b[(c;c+1)]:1; sd:{n:+/x@NB; `i$(~x)&n=2}"],
  // B3/S45678 -- grows into a coral crust and then holds its shape.
  ["coral",     "`f$b::co b", "`prng 5; b:N?2; co:{n:+/x@NB; `i$((~x)&n=3)|x&n>3}"],
  // B3678/S34678 -- symmetric under swapping alive and dead.
  ["day/night", "`f$b::dn b", "`prng 11; b:N?2; dn:{n:+/x@NB; `i$((~x)&(n=3)|n>5)|x&(n=3)|(n=4)|n>5}"],
  // Brian's Brain: three states. Firing cells are amber, the refractory
  // trail behind them is cyan.
  ["brains",    "b::bb b; (b=1)-0.5*b=2", "`prng 6; b:N?3; bb:{f:x=1; n:+/f@NB; `i$((x=0)&n=2)+2*x=1}"],
  // A cyclic cellular automaton: a cell eats its neighbour if that neighbour
  // is the next colour round. Spiral waves appear on their own.
  ["cyclic",    "-1+2*(`f$b::cy b)%K-1", "`prng 3; K:10; b:N?K; cy:{nx:K!x+1; f:|/(x@NB)=\\:nx; (f*nx)+(1-f)*x}"],
  // A majority rule: noise anneals into large smooth domains.
  ["anneal",    "`f$b::an b", "`prng 8; b:N?2; an:{n:x++/x@NB; `i$(n>5)|n=4}"]
];

var DEFAULT = 0;          // rings — the page should be moving before anything is clicked
var GRIDS = [16, 32, 64];

/* --------------------------------------------------------------- elements -- */
var IDS = ["canvas", "expr", "err", "status", "led", "presets", "grids", "pause",
           "reset", "share", "png", "rec", "dice", "setup", "setupwrap", "setuprun",
           "perf", "toast"];
var E = {};
for (var k = 0; k < IDS.length; k++) E[IDS[k]] = document.getElementById("dots-" + IDS[k]);

var ctx = E.canvas.getContext("2d");

/* ------------------------------------------------------------------ state -- */
var S = {
  grid: 32,
  expr: PRESETS[DEFAULT][1],
  setup: PRESETS[DEFAULT][2],
  paused: false,
  ready: false,
  t0: 0,            // performance.now() at the last time-origin reset
  tPaused: 0,       // the t value frozen at the moment of pausing
  mx: 15.5, my: 15.5, md: 0,
  cells: null,      // the last good frame
  seq: 0, inflight: 0, sentAt: 0,
  ema: 0,           // engine ms/frame, exponentially smoothed
  fps: 0, fpsN: 0, fpsT: 0,
  err: ""
};

/* The inverse of the worker's quantiser: code 33..126 -> value -1..1. Built
 * once as a lookup table, so decoding a frame is one array read per cell. */
var LEVELS = new Float32Array(128);
for (var c = 0; c < 128; c++) LEVELS[c] = Math.max(-1, Math.min(1, (c - 33) / 46.5 - 1));

/* ----------------------------------------------------------------- worker -- */
var W = null;

function boot() {
  if (W) { try { W.terminate(); } catch (e) {} }
  S.ready = false;
  setStatus("booting", "starting the engine…");
  try {
    W = new Worker(WORKER);
  } catch (err) {
    // Browsers refuse to start a worker from a file:// page (its origin is
    // opaque), which is the one way this page fails for a reason the visitor
    // can fix, so say what to do instead of showing a dead grid.
    setStatus("error", "engine blocked");
    showErr(location.protocol === "file:"
      ? "Opening this file directly does not work: browsers block workers on file:// URLs. Serve the folder instead — python -m http.server — and open http://localhost:8000/"
      : "the engine worker could not start: " + String((err && err.message) || err));
    return;
  }
  W.onmessage = onWorker;
  W.onerror = function (ev) {
    setStatus("error", "engine error");
    showErr((ev && ev.message) || "the engine worker failed to load");
  };
  W.postMessage({ type: "boot", runtime: RUNTIME, grid: S.grid });
}

function onWorker(ev) {
  var m = ev.data || {};

  if (m.type === "fatal") {
    setStatus("error", "engine unavailable");
    showErr(m.message || "the engine could not start");
    return;
  }

  if (m.type === "ready") {
    S.ready = true;
    setStatus("ready", "Amber " + (m.version || "") + " · wasm");
    pushSetup();
    pushExpr();
    resetTime();
    requestAnimationFrame(tick);
    return;
  }

  if (m.type === "setup" || m.type === "expr") {
    // A define only catches parse errors; a runtime error arrives with the
    // first frame instead. Either way the message goes to the same slot.
    if (!m.ok) showErr(m.error); else clearErr();
    return;
  }

  if (m.type === "frame") {
    S.inflight = 0;
    if (m.cells) {
      S.cells = m.cells;
      S.ema = S.ema ? S.ema * 0.9 + m.ms * 0.1 : m.ms;
      clearErr();
    } else if (m.error) {
      showErr(m.error);           // keep drawing the last good frame
    }
    draw();
    return;
  }
}

/* Terminate and reboot a worker that has stopped answering. An expression like
 * `(1+)/1` never converges, and no amount of care on this side can interrupt a
 * running wasm call — only killing the worker can. */
function recover() {
  var lastGood = S.expr;
  showErr("that expression did not finish — the engine was restarted");
  S.inflight = 0;
  boot();
  S.expr = lastGood;
}

function pushExpr() { if (S.ready) W.postMessage({ type: "expr", src: S.expr }); }
function pushSetup() { if (S.ready) W.postMessage({ type: "setup", src: S.setup }); }

/* ------------------------------------------------------------- frame loop -- */
function now() { return performance.now(); }

function currentT() {
  return S.paused ? S.tPaused : (now() - S.t0) / 1000;
}

function resetTime() { S.t0 = now(); S.tPaused = 0; }

function tick() {
  requestAnimationFrame(tick);
  if (!S.ready) return;

  if (S.inflight && now() - S.sentAt > 2500) { recover(); return; }
  if (S.inflight) return;                       // one frame in flight at a time

  // fps of delivered frames, sampled over a second
  S.fpsN++;
  if (!S.fpsT) S.fpsT = now();
  else if (now() - S.fpsT >= 1000) {
    S.fps = Math.round((S.fpsN * 1000) / (now() - S.fpsT));
    S.fpsN = 0; S.fpsT = now();
    perf();
  }

  S.inflight = ++S.seq;
  S.sentAt = now();
  W.postMessage({
    type: "frame", seq: S.seq,
    t: round4(currentT()), mx: round4(S.mx), my: round4(S.my), md: S.md
  });
}

function round4(v) { return Math.round(v * 10000) / 10000; }

/* -------------------------------------------------------------- rendering -- */
var BUCKETS = 6;

function cssVar(name, fallback) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
var COL = { pos: "#ffb020", neg: "#56d4dd", bg: "#07070a" };
function readColours() {
  COL.pos = cssVar("--dots-pos", "#ffb020");
  COL.neg = cssVar("--dots-neg", "#56d4dd");
  COL.bg = cssVar("--dots-bg", "#07070a");
}

var dpr = 1, size = 0;

function resize() {
  var box = E.canvas.getBoundingClientRect();
  var css = Math.max(1, Math.floor(Math.min(box.width, box.height)));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  if (E.canvas.width !== Math.floor(css * dpr)) {
    E.canvas.width = Math.floor(css * dpr);
    E.canvas.height = Math.floor(css * dpr);
  }
  size = E.canvas.width;
  draw();
}

function draw() {
  if (!size) return;
  var G = S.grid, cell = size / G, rMax = cell * 0.46;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, size, size);

  if (!S.cells || S.cells.length !== G * G) return;

  // Group the dots into a handful of alpha buckets per sign and fill each
  // bucket as a single path: 12 fills per frame instead of one per cell, which
  // is what keeps a 64x64 grid (4096 dots) cheap on the main thread.
  var pos = [], neg = [], b;
  for (b = 0; b < BUCKETS; b++) { pos.push(new Path2D()); neg.push(new Path2D()); }

  var s = S.cells;
  for (var idx = 0; idx < s.length; idx++) {
    var v = LEVELS[s.charCodeAt(idx)];
    var a = v < 0 ? -v : v;
    if (a < 0.012) continue;
    var r = a * rMax;
    if (r < 0.35) continue;
    var cxp = (idx % G + 0.5) * cell, cyp = ((idx / G) | 0) * cell + 0.5 * cell;
    b = (a * BUCKETS) | 0; if (b >= BUCKETS) b = BUCKETS - 1;
    var p = v > 0 ? pos[b] : neg[b];
    p.moveTo(cxp + r, cyp);
    p.arc(cxp, cyp, r, 0, 6.28318530718);
  }

  for (b = 0; b < BUCKETS; b++) {
    var alpha = 0.42 + 0.58 * ((b + 0.5) / BUCKETS);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COL.pos; ctx.fill(pos[b]);
    ctx.fillStyle = COL.neg; ctx.fill(neg[b]);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------- chrome */
function setStatus(cls, text) {
  if (E.status) E.status.textContent = text;
  if (E.led) E.led.className = "dots-led " + cls;
}

function perf() {
  if (!E.perf) return;
  if (!S.ema) { E.perf.textContent = ""; return; }
  var pct = (S.ema / (1000 / 60)) * 100;
  E.perf.innerHTML = "<strong>" + S.ema.toFixed(3) + " ms</strong> of engine time per frame — " +
    pct.toFixed(1) + "% of a 60 fps budget, at " + S.grid + "×" + S.grid +
    " (" + (S.grid * S.grid) + " values) · " + S.fps + " fps";
}

function showErr(msg) {
  S.err = msg || "";
  if (E.err) { E.err.textContent = S.err; E.err.hidden = !S.err; }
  if (E.expr) E.expr.classList.toggle("bad", !!S.err);
}
function clearErr() { if (S.err) showErr(""); }

var toastTimer = 0;
function toast(msg) {
  if (!E.toast) return;
  E.toast.textContent = msg;
  E.toast.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { E.toast.classList.remove("on"); }, 2200);
}

/* ------------------------------------------------------------------- input -- */
function setExpr(src, opts) {
  S.expr = src;
  if (E.expr && E.expr.value !== src) E.expr.value = src;
  pushExpr();
  if (!opts || !opts.keepHash) writeHash();
}

function setSetup(src) {
  S.setup = src;
  if (E.setup && E.setup.value !== src) E.setup.value = src;
  if (E.setupwrap) E.setupwrap.hidden = false;
  pushSetup();
  writeHash();
}

function loadPreset(p) {
  S.setup = p[2];
  if (E.setup) E.setup.value = p[2];
  if (E.setupwrap) E.setupwrap.open = !!p[2];
  pushSetup();
  setExpr(p[1]);
  resetTime();
  if (S.paused) togglePause();
}

function setGrid(g) {
  S.grid = g;
  Array.prototype.forEach.call(E.grids.querySelectorAll("button"), function (b) {
    b.classList.toggle("on", +b.dataset.grid === g);
  });
  S.cells = null;
  // Recentre the cursor globals so a mouse-driven expression is sane before
  // the pointer moves, then rebuild the grid and re-run the preset's setup
  // (its state is sized by N, which just changed).
  S.mx = S.my = (g - 1) / 2;
  if (S.ready) {
    W.postMessage({ type: "grid", grid: g });
    pushSetup();
    pushExpr();
  }
  resize();
  writeHash();
  perf();
}

function togglePause() {
  if (S.paused) { S.t0 = now() - S.tPaused * 1000; S.paused = false; }
  else { S.tPaused = currentT(); S.paused = true; }
  if (E.pause) {
    E.pause.textContent = S.paused ? "Play" : "Pause";
    E.pause.setAttribute("aria-pressed", S.paused ? "true" : "false");
  }
}

/* ------------------------------------------------------------------- share -- */
function b64url(s) {
  var bin = new TextEncoder().encode(s), out = "";
  for (var j = 0; j < bin.length; j++) out += String.fromCharCode(bin[j]);
  return btoa(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  var bin = atob(s), arr = new Uint8Array(bin.length);
  for (var j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
  return new TextDecoder().decode(arr);
}

var hashLock = false;
function writeHash() {
  var payload = { e: S.expr, g: S.grid };
  if (S.setup && S.setup.trim()) payload.s = S.setup;
  hashLock = true;
  try { history.replaceState(null, "", "#d=" + b64url(JSON.stringify(payload))); } catch (e) {}
  setTimeout(function () { hashLock = false; }, 0);
}

function readHash() {
  var m = /[#&]d=([^&]+)/.exec(location.hash);
  if (!m) return null;
  try {
    var o = JSON.parse(unb64url(m[1]));
    if (!o || typeof o.e !== "string") return null;
    return { e: o.e, g: GRIDS.indexOf(+o.g) >= 0 ? +o.g : 32, s: typeof o.s === "string" ? o.s : "" };
  } catch (e) { return null; }
}

function share() {
  writeHash();
  var url = location.href;
  var done = function () { toast("Link copied — it opens this expression, running."); };
  var manual = function () { toast("Copy this: " + url); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, manual);
  else manual();
}

/* ------------------------------------------------------- image and clip out */
function download(blob, name) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
}

function slug() {
  return (S.expr.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "dots").toLowerCase();
}

function snapPng() {
  E.canvas.toBlob(function (b) {
    if (!b) { toast("Could not render a PNG here."); return; }
    download(b, "amber-dots-" + slug() + ".png");
    toast("PNG saved.");
  }, "image/png");
}

var recording = false;
function record() {
  if (recording) return;
  if (typeof MediaRecorder === "undefined" || !E.canvas.captureStream) {
    toast("This browser cannot record the canvas — use PNG instead.");
    return;
  }
  var types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  var mime = "";
  for (var j = 0; j < types.length; j++) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[j])) { mime = types[j]; break; }
  }
  var stream, mr;
  try {
    stream = E.canvas.captureStream(60);
    mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined);
  } catch (e) { toast("Recording is not available here — use PNG instead."); return; }

  var chunks = [];
  mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = function () {
    recording = false;
    E.rec.classList.remove("on");
    E.rec.textContent = "Record";
    try { stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {}
    if (!chunks.length) { toast("Nothing was recorded."); return; }
    download(new Blob(chunks, { type: mime || "video/webm" }), "amber-dots-" + slug() + ".webm");
    toast("Clip saved (webm, 6 seconds).");
  };

  recording = true;
  E.rec.classList.add("on");
  mr.start();
  var left = 6;
  E.rec.textContent = "● " + left + "s";
  var iv = setInterval(function () {
    left--;
    E.rec.textContent = "● " + left + "s";
    if (left <= 0) { clearInterval(iv); try { mr.stop(); } catch (e) {} }
  }, 1000);
}

/* ------------------------------------------------------------------- wiring */
function buildChrome() {
  PRESETS.forEach(function (p, j) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dots-pill";
    b.textContent = p[0];
    b.addEventListener("click", function () { loadPreset(p); });
    E.presets.appendChild(b);
    if (j === DEFAULT) b.classList.add("on");
  });
  E.presets.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button") : null;
    if (!b) return;
    Array.prototype.forEach.call(E.presets.querySelectorAll("button"), function (o) { o.classList.toggle("on", o === b); });
  });

  GRIDS.forEach(function (g) {
    var b = document.createElement("button");
    b.type = "button";
    b.dataset.grid = g;
    b.textContent = g + "×" + g;
    if (g === S.grid) b.classList.add("on");
    b.addEventListener("click", function () { setGrid(g); });
    E.grids.appendChild(b);
  });
}

function wire() {
  E.expr.addEventListener("input", function () { setExpr(E.expr.value); });
  E.expr.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); E.expr.blur(); }
  });

  if (E.setuprun) E.setuprun.addEventListener("click", function () { setSetup(E.setup.value); resetTime(); });
  if (E.setup) E.setup.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); setSetup(E.setup.value); resetTime(); }
  });

  E.pause.addEventListener("click", togglePause);
  E.reset.addEventListener("click", function () { resetTime(); pushSetup(); });
  E.share.addEventListener("click", share);
  if (E.png) E.png.addEventListener("click", snapPng);
  if (E.rec) E.rec.addEventListener("click", record);
  if (E.dice) E.dice.addEventListener("click", function () {
    var p = PRESETS[(Math.random() * PRESETS.length) | 0];
    loadPreset(p);
    Array.prototype.forEach.call(E.presets.querySelectorAll("button"), function (o) {
      o.classList.toggle("on", o.textContent === p[0]);
    });
  });

  // Pointer -> mx, my in cell coordinates. Kept as floats: an expression that
  // wants a cell index can floor it, and one drawing a field wants the
  // continuous value.
  function at(ev) {
    var b = E.canvas.getBoundingClientRect();
    var cell = Math.min(b.width, b.height) / S.grid;
    S.mx = round4(Math.max(0, Math.min(S.grid - 1, (ev.clientX - b.left) / cell - 0.5)));
    S.my = round4(Math.max(0, Math.min(S.grid - 1, (ev.clientY - b.top) / cell - 0.5)));
  }
  E.canvas.addEventListener("pointermove", at);
  E.canvas.addEventListener("pointerdown", function (ev) { S.md = 1; at(ev); });
  window.addEventListener("pointerup", function () { S.md = 0; });

  window.addEventListener("keydown", function (ev) {
    var tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (ev.code === "Space") { ev.preventDefault(); togglePause(); }
    else if (ev.key === "r") { resetTime(); pushSetup(); }
  });

  window.addEventListener("resize", resize);
  window.addEventListener("hashchange", function () {
    if (hashLock) return;
    var h = readHash();
    if (!h) return;
    if (h.g !== S.grid) setGrid(h.g);
    S.setup = h.s; if (E.setup) E.setup.value = h.s;
    pushSetup(); setExpr(h.e, { keepHash: true }); resetTime();
  });

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").addEventListener) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColours(); draw(); });
  }
  var mo = new MutationObserver(function () { readColours(); draw(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

/* --------------------------------------------------------------------- go -- */
function init() {
  readColours();
  buildChrome();
  wire();

  var h = readHash();
  if (h) {
    S.grid = h.g; S.expr = h.e; S.setup = h.s;
    Array.prototype.forEach.call(E.grids.querySelectorAll("button"), function (b) {
      b.classList.toggle("on", +b.dataset.grid === S.grid);
    });
    Array.prototype.forEach.call(E.presets.querySelectorAll("button"), function (b) { b.classList.remove("on"); });
  }
  E.expr.value = S.expr;
  if (E.setup) E.setup.value = S.setup;
  if (E.setupwrap) E.setupwrap.open = !!(S.setup && S.setup.trim());

  resize();
  boot();

  // Don't steal focus on touch: it would open the keyboard over the grid
  // before anyone has seen the grid. preventScroll matters even on desktop —
  // without it the browser scrolls the input into view on load and the grid,
  // which is the whole point of the page, ends up above the fold.
  if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    try { E.expr.focus({ preventScroll: true }); } catch (e) { /* older browsers: skip the focus */ }
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
