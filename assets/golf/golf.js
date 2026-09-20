/* golf.js — Array Golf. Type an expression in terms of x; the engine judges it
   against the tests as you type, and counts the bytes. */
"use strict";

(function () {

var CFG = window.GOLF_CONFIG || {};
var RUNTIME = CFG.runtime || ["./amber.wasm.js", "./amber.js"];
var WORKER = CFG.worker || "./kworker.js";
var SRC = CFG.src || "./golf.k";
var P = window.GOLF_PUZZLES || [];
var STORE = "amber-golf-best";

var IDS = ["list", "title", "prompt", "expr", "err", "tests", "hidden", "bytes",
           "par", "status", "led", "share", "reset", "solved", "toast", "verdict",
           "prev", "next"];
var E = {};
for (var k = 0; k < IDS.length; k++) E[IDS[k]] = document.getElementById("gf-" + IDS[k]);

var S = { ready: false, i: 0, expr: "", best: {}, pending: 0, seq: 0 };

try { S.best = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { S.best = {}; }
function saveBest() { try { localStorage.setItem(STORE, JSON.stringify(S.best)); } catch (e) {} }

/* A best used to be just a byte count, which meant the solution itself was
   thrown away the moment you moved on. It is {b: bytes, s: expression} now;
   an older entry is a bare number, so read through this. */
function bestOf(id) {
  var v = S.best[id];
  if (v === undefined || v === null) return null;
  return typeof v === "number" ? { b: v, s: "" } : v;
}

/* ------------------------------------------------------------------ worker */
var W = null, nextId = 1, waiting = {};

function boot() {
  if (W) { try { W.terminate(); } catch (e) {} }
  S.ready = false;
  setStatus("booting", "starting the engine…");
  try { W = new Worker(WORKER); }
  catch (err) {
    setStatus("error", "engine blocked");
    showErr(location.protocol === "file:"
      ? "Browsers block workers on file:// URLs — serve the folder over HTTP."
      : "the engine worker could not start");
    return;
  }
  W.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.type === "fatal") { setStatus("error", "engine unavailable"); showErr(m.message); return; }
    if (m.type === "ready") {
      S.ready = true;
      setStatus("ready", "Amber " + (m.version || "") + " · wasm");
      judge();
      return;
    }
    if (m.type === "evals") {
      var cb = waiting[m.id]; delete waiting[m.id];
      if (cb) cb(m.outs, m.error);
    }
  };
  W.postMessage({ type: "boot", runtime: RUNTIME, src: SRC });
}

/* --------------------------------------------------------------- judging */
function lit(t) { return "((" + t[0] + ");(" + t[1] + "))"; }

function judge() {
  if (!S.ready) return;
  var p = P[S.i], src = S.expr.trim();
  if (!src) { render(null, null, ""); return; }
  var tests = p.show.concat(p.hide);
  var ks = ["G:{" + src + "}", "gall[(" + tests.map(lit).join(";") + ")]"];
  p.show.forEach(function (t) { ks.push("G[(" + t[0] + ")]"); });

  var id = nextId++;
  var mine = ++S.seq;
  var forPuzzle = S.i;
  waiting[id] = function (outs, err) {
    // Drop a result that a later keystroke, or a change of puzzle, has already
    // overtaken. Without the puzzle check a verdict from the previous puzzle
    // lands after go() has cleared the expression, and is rendered as a
    // solve worth zero bytes.
    if (mine !== S.seq || forPuzzle !== S.i) return;
    var digits = (outs[1] || "").replace(/[^01]/g, "");
    render(digits, outs.slice(2), err || "");
  };
  W.postMessage({ type: "evals", id: id, ks: ks });
}

function render(digits, mineOuts, err) {
  var p = P[S.i], nShow = p.show.length, nAll = nShow + p.hide.length;
  var bytes = S.expr.trim().length;

  if (E.bytes) E.bytes.textContent = bytes ? bytes + (bytes === 1 ? " byte" : " bytes") : "—";
  if (E.par) E.par.textContent = p.par.length + (p.par.length === 1 ? " byte" : " bytes");

  showErr(digits === null ? "" : err);

  // per-example rows
  if (E.tests) {
    E.tests.innerHTML = "";
    p.show.forEach(function (t, j) {
      var ok = digits && digits[j] === "1";
      var row = document.createElement("div");
      row.className = "gf-test" + (digits === null ? "" : ok ? " pass" : " fail");
      var got = digits === null ? "" : (mineOuts && mineOuts[j] !== undefined && mineOuts[j] !== "" ? mineOuts[j] : (err ? "—" : "—"));
      row.innerHTML =
        '<span class="gf-mark">' + (digits === null ? "·" : ok ? "✓" : "✕") + '</span>' +
        '<code class="gf-in">' + esc(t[0]) + '</code>' +
        '<span class="gf-arrow">→</span>' +
        '<code class="gf-want">' + esc(t[1]) + '</code>' +
        '<code class="gf-got">' + (digits === null || ok ? "" : esc(got)) + '</code>';
      E.tests.appendChild(row);
    });
  }

  var solved = bytes > 0 && digits && digits.length === nAll && digits.indexOf("0") < 0;
  var hidePass = digits ? (digits.slice(nShow).match(/1/g) || []).length : 0;
  if (E.hidden) {
    E.hidden.textContent = digits === null ? "" : hidePass + " of " + p.hide.length + " further tests pass";
    E.hidden.className = "gf-hidden" + (digits === null ? "" : solved ? " pass" : hidePass ? " part" : " fail");
  }

  if (E.verdict) {
    if (digits === null) { E.verdict.textContent = ""; E.verdict.className = "gf-verdict"; }
    else if (solved) {
      var prev = bestOf(p.id);
      if (bytes > 0 && (!prev || bytes < prev.b)) {
        S.best[p.id] = { b: bytes, s: S.expr.trim() };
        saveBest(); buildList();
      }
      var b = bestOf(p.id).b;
      E.verdict.className = "gf-verdict ok";
      E.verdict.textContent = "Solved in " + bytes + (bytes === 1 ? " byte" : " bytes") +
        (bytes < p.par.length ? " — under par!" : bytes === p.par.length ? " — par." : " — par is " + p.par.length + ".") +
        (b < bytes ? "  Your best is " + b + "." : "");
    } else {
      E.verdict.className = "gf-verdict";
      E.verdict.textContent = "";
    }
  }
  if (E.solved) E.solved.textContent = Object.keys(S.best).length + " / " + P.length;
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* ------------------------------------------------------------------ chrome */
function setStatus(cls, text) {
  if (E.status) E.status.textContent = text;
  if (E.led) E.led.className = "gf-led " + cls;
}
function showErr(m) {
  if (!E.err) return;
  E.err.textContent = m || "";
  E.err.hidden = !m;
  if (E.expr) E.expr.classList.toggle("bad", !!m);
}
var toastT = 0;
function toast(m) {
  if (!E.toast) return;
  E.toast.textContent = m; E.toast.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(function () { E.toast.classList.remove("on"); }, 2400);
}

var TIERS = { 1: "Warm-up", 2: "Harder", 3: "Hardest" };

function buildList() {
  if (!E.list) return;
  E.list.innerHTML = "";
  var tier = 0;
  P.forEach(function (p, j) {
    if (p.tier !== tier) {
      tier = p.tier;
      var h = document.createElement("div");
      h.className = "gf-tier";
      h.textContent = TIERS[tier] || ("Tier " + tier);
      E.list.appendChild(h);
    }
    var b = document.createElement("button");
    b.type = "button";
    var bv = bestOf(p.id);
    b.className = "gf-item" + (j === S.i ? " on" : "") + (bv ? " done" : "");
    b.innerHTML = '<span class="gf-itn">' + esc(p.title) + '</span>' +
                  '<span class="gf-itb">' + (bv ? bv.b : "") + '</span>';
    b.addEventListener("click", function () { go(j); });
    E.list.appendChild(b);
  });
}

function go(j) {
  S.seq++;                               // abandon any judgement still in flight
  S.i = ((j % P.length) + P.length) % P.length;
  var p = P[S.i];
  if (E.title) E.title.textContent = p.title;
  if (E.prompt) E.prompt.innerHTML = p.prompt;
  var saved = bestOf(p.id);
  S.expr = saved && saved.s ? saved.s : "";
  if (E.expr) {
    E.expr.value = S.expr;
    try { E.expr.focus({ preventScroll: true }); } catch (e) {}
    E.expr.select();
  }
  buildList();
  render(null, null, "");
  writeHash();
  if (S.expr) judge();          // show it as solved again straight away
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
  try { history.replaceState(null, "", "#g=" + b64(JSON.stringify({ p: P[S.i].id, s: S.expr }))); } catch (e) {}
}
function readHash() {
  var m = /[#&]g=([^&]+)/.exec(location.hash);
  if (!m) return null;
  try { return JSON.parse(unb64(m[1])); } catch (e) { return null; }
}

/* ------------------------------------------------------------------- wiring */
function wire() {
  var t = 0;
  E.expr.addEventListener("input", function () {
    S.expr = E.expr.value;
    writeHash();
    clearTimeout(t);
    t = setTimeout(judge, 160);          // judge as you type, but not per keystroke
  });
  E.expr.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); clearTimeout(t); judge(); }
  });
  if (E.prev) E.prev.addEventListener("click", function () { go(S.i - 1); });
  if (E.next) E.next.addEventListener("click", function () { go(S.i + 1); });
  if (E.share) E.share.addEventListener("click", function () {
    writeHash();
    var url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(url).then(function () { toast("Link copied — the puzzle and your solution."); }, function () { toast(url); });
    else toast(url);
  });
  if (E.reset) E.reset.addEventListener("click", function () {
    S.best = {}; saveBest(); buildList(); render(null, null, "");
    toast("Progress cleared.");
  });
}

function init() {
  if (!P.length) { showErr("no puzzles loaded"); return; }
  wire();
  var h = readHash(), start = 0;
  if (h && h.p) { var j = P.findIndex(function (p) { return p.id === h.p; }); if (j >= 0) start = j; }
  go(start);
  if (h && typeof h.s === "string" && h.s) { S.expr = h.s; E.expr.value = h.s; }
  boot();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
