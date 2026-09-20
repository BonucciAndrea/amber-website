/* sweep.js — Minesweeper. The board, the neighbour counts, the flood fill and
   the win/lose test all live in assets/sweep/sweep.k; this file draws the
   result and turns clicks into cell indices. */
"use strict";

(function () {

var CFG = window.SWEEP_CONFIG || {};
var RUNTIME = CFG.runtime || ["./amber.wasm.js", "./amber.js"];
var WORKER = CFG.worker || "./kworker.js";
var SRC = CFG.src || "./sweep.k";

var LEVELS = [
  ["beginner", 9, 9, 10],
  ["intermediate", 16, 16, 40],
  ["expert", 30, 16, 99]
];

var IDS = ["canvas", "status", "led", "levels", "new", "seed", "mines", "time",
           "state", "toast", "source"];
var E = {};
for (var k = 0; k < IDS.length; k++) E[IDS[k]] = document.getElementById("sw-" + IDS[k]);
var ctx = E.canvas.getContext("2d");

var S = {
  ready: false, lvl: 0, w: 9, h: 9, m: 10, seed: 1,
  board: "", dead: 0, won: 0, left: 10, rev: 0,
  started: false, t0: 0, elapsed: 0, timer: 0, hover: -1
};

/* ------------------------------------------------------------------ worker */
var W = null, nextId = 1, waiting = {};

function boot() {
  if (W) { try { W.terminate(); } catch (e) {} }
  S.ready = false;
  setStatus("booting", "starting the engine…");
  try { W = new Worker(WORKER); }
  catch (err) {
    setStatus("error", "engine blocked");
    toast(location.protocol === "file:"
      ? "Browsers block workers on file:// URLs — serve the folder over HTTP."
      : "the engine worker could not start");
    return;
  }
  W.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.type === "fatal") { setStatus("error", "engine unavailable"); toast(m.message); return; }
    if (m.type === "ready") {
      S.ready = true;
      setStatus("ready", "Amber " + (m.version || "") + " · wasm");
      newGame();
      return;
    }
    if (m.type === "eval") {
      var cb = waiting[m.id]; delete waiting[m.id];
      if (m.error) { toast(m.error); return; }
      if (cb) cb(m.out);
    }
  };
  W.postMessage({ type: "boot", runtime: RUNTIME, src: SRC });
}

function K(src, cb) {
  if (!S.ready) return;
  var id = nextId++;
  waiting[id] = cb;
  W.postMessage({ type: "eval", id: id, k: src });
}

/* ------------------------------------------------------------------- state */
function absorb(out) {
  var p = out.split(";");
  if (p.length < 6) return;
  S.dead = +p[0]; S.won = +p[1]; S.left = +p[2]; S.rev = +p[3];
  S.board = p[5];
  if ((S.dead || S.won) && S.timer) { clearInterval(S.timer); S.timer = 0; }
  paint(); draw();
}

function newGame() {
  var L = LEVELS[S.lvl];
  S.w = L[1]; S.h = L[2]; S.m = L[3];
  S.started = false; S.elapsed = 0;
  if (S.timer) { clearInterval(S.timer); S.timer = 0; }
  sizeCanvas();
  K("snew[" + S.w + ";" + S.h + ";" + S.m + ";" + S.seed + "];sout[]", absorb);
}

function startClock() {
  if (S.started) return;
  S.started = true; S.t0 = Date.now();
  S.timer = setInterval(function () {
    S.elapsed = (Date.now() - S.t0) / 1000;
    if (E.time) E.time.textContent = S.elapsed.toFixed(1) + "s";
  }, 100);
}

/* ------------------------------------------------------------------ canvas */
var dpr = 1, cell = 24;

function sizeCanvas() {
  var box = E.canvas.parentNode.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  var avail = Math.max(120, box.width - 2);
  cell = Math.max(14, Math.min(34, Math.floor(avail / S.w)));
  var w = cell * S.w, h = cell * S.h;
  E.canvas.style.width = w + "px";
  E.canvas.style.height = h + "px";
  E.canvas.width = Math.floor(w * dpr);
  E.canvas.height = Math.floor(h * dpr);
}

function cssVar(n, f) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return v || f;
}
var COL = {};
function readColours() {
  COL.hidden = cssVar("--sw-hidden", "#20202b");
  COL.hover = cssVar("--sw-hover", "#2b2b39");
  COL.open = cssVar("--sw-open", "#111119");
  COL.line = cssVar("--border", "rgba(255,255,255,.09)");
  COL.flag = cssVar("--accent", "#ffb020");
  COL.mine = cssVar("--red", "#ff6b6b");
  COL.text = cssVar("--text", "#ecedf1");
  COL.nums = ["", cssVar("--blue", "#6aa6ff"), cssVar("--green", "#5ddba0"),
              cssVar("--red", "#ff6b6b"), cssVar("--violet", "#a78bfa"),
              cssVar("--accent", "#ffb020"), cssVar("--cyan", "#56d4dd"),
              cssVar("--text", "#ecedf1"), cssVar("--text-faint", "#6e6f7b")];
}

function draw() {
  if (!S.board) return;
  var g = cell * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, E.canvas.width, E.canvas.height);
  ctx.font = "600 " + Math.round(g * 0.56) + "px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (var i = 0; i < S.board.length; i++) {
    var ch = S.board[i];
    var cx = (i % S.w) * g, cy = Math.floor(i / S.w) * g;
    var open = ch !== "." && ch !== "F";
    ctx.fillStyle = open ? COL.open : (i === S.hover && !S.dead && !S.won ? COL.hover : COL.hidden);
    ctx.fillRect(cx, cy, g, g);
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, g - 1, g - 1);

    var mx = cx + g / 2, my = cy + g / 2;
    if (ch >= "1" && ch <= "8") { ctx.fillStyle = COL.nums[+ch]; ctx.fillText(ch, mx, my); }
    else if (ch === "F") { drawFlag(mx, my, g); }
    else if (ch === "*") { ctx.fillStyle = COL.mine; dot(mx, my, g * 0.2); }
    else if (ch === "X") { ctx.strokeStyle = COL.mine; ctx.lineWidth = Math.max(1.5, g * 0.08); cross(mx, my, g * 0.22); }
  }
}
function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
function cross(x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
  ctx.stroke();
}
function drawFlag(x, y, g) {
  ctx.fillStyle = COL.flag;
  ctx.beginPath();
  ctx.moveTo(x - g * 0.14, y - g * 0.22);
  ctx.lineTo(x + g * 0.20, y - g * 0.06);
  ctx.lineTo(x - g * 0.14, y + g * 0.10);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(x - g * 0.17, y - g * 0.24, Math.max(1.4, g * 0.06), g * 0.46);
}

/* ------------------------------------------------------------------ chrome */
function setStatus(cls, text) {
  if (E.status) E.status.textContent = text;
  if (E.led) E.led.className = "sw-led " + cls;
}
function paint() {
  if (E.mines) E.mines.textContent = String(S.left);
  if (E.time) E.time.textContent = S.elapsed.toFixed(1) + "s";
  if (E.state) {
    E.state.textContent = S.dead ? "boom" : S.won ? "cleared" : S.started ? "playing" : "ready";
    E.state.className = "sw-state" + (S.dead ? " dead" : S.won ? " won" : "");
  }
}
var toastT = 0;
function toast(m) {
  if (!E.toast) return;
  E.toast.textContent = m; E.toast.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(function () { E.toast.classList.remove("on"); }, 2600);
}

/* ------------------------------------------------------------------- input */
function cellAt(ev) {
  var b = E.canvas.getBoundingClientRect();
  var x = Math.floor((ev.clientX - b.left) / cell), y = Math.floor((ev.clientY - b.top) / cell);
  if (x < 0 || y < 0 || x >= S.w || y >= S.h) return -1;
  return y * S.w + x;
}

function wire() {
  E.canvas.addEventListener("mousemove", function (ev) {
    var i = cellAt(ev);
    if (i !== S.hover) { S.hover = i; draw(); }
  });
  E.canvas.addEventListener("mouseleave", function () { S.hover = -1; draw(); });

  E.canvas.addEventListener("click", function (ev) {
    if (S.dead || S.won) return;
    var i = cellAt(ev); if (i < 0) return;
    startClock();
    // A click on an already-open number is the classic chord: open its
    // neighbours when the flags around it already account for its count.
    var ch = S.board[i];
    K((ch >= "1" && ch <= "8" ? "schord " : "sopen ") + i + ";sout[]", absorb);
  });

  E.canvas.addEventListener("contextmenu", function (ev) {
    ev.preventDefault();
    if (S.dead || S.won) return;
    var i = cellAt(ev); if (i < 0) return;
    startClock();
    K("sflag " + i + ";sout[]", absorb);
  });

  LEVELS.forEach(function (L, j) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "sw-pill" + (j === 0 ? " on" : "");
    b.textContent = L[0];
    b.addEventListener("click", function () {
      S.lvl = j;
      Array.prototype.forEach.call(E.levels.querySelectorAll("button"), function (o) { o.classList.toggle("on", o === b); });
      newGame();
    });
    E.levels.appendChild(b);
  });

  E.new.addEventListener("click", function () { S.seed = 1 + Math.floor(Math.random() * 99999); E.seed.value = S.seed; newGame(); });
  E.seed.addEventListener("change", function () {
    var v = parseInt(E.seed.value, 10);
    S.seed = isNaN(v) ? 1 : Math.abs(v) % 100000;
    E.seed.value = S.seed;
    newGame();
  });

  window.addEventListener("resize", function () { sizeCanvas(); draw(); });
  var mo = new MutationObserver(function () { readColours(); draw(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

function init() {
  readColours(); wire();
  E.seed.value = S.seed;
  paint();
  boot();
  // show the actual game logic on the page
  if (E.source) {
    fetch(CFG.srcView || "../assets/sweep/sweep.k").then(function (r) { return r.text(); })
      .then(function (t) { E.source.textContent = t.trim(); })
      .catch(function () { E.source.textContent = "(sweep.k could not be loaded)"; });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
