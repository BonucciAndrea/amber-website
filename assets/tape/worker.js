/* worker.js — hosts the Amber engine for The Pit, off the main thread.
 *
 * The simulation itself is assets/tape/sim.k, fetched and evaluated at boot.
 * Keeping it as real .k rather than a string inside this file means it can be
 * read, diffed and tested on its own — the same file the headless tests run.
 *
 * Protocol (main -> worker):
 *   {type:"boot",  runtime:[urls], sim:url}  -> {type:"ready", version}
 *   {type:"quote", src}                      -> {type:"quote", ok, error}
 *   {type:"init",  seed}                     -> {type:"init", ok}
 *   {type:"tick",  n}                        -> {type:"tick", rows:[...], done}
 *   {type:"stats"}                           -> {type:"stats", text}
 */

/* global AmberVM, amberStatements */
"use strict";

var vm = null;
var lastGoodQuote = "px+(-0.05 0.05)-0.005*inv";
var ROUND = 1200;                 // read from sim.k at boot, not re-read per tick
var ANSI = /\x1b\[[0-9;]*m/g;

function clean(s) { return String(s == null ? "" : s).replace(ANSI, ""); }
function isErr(s) { return /error\[/.test(clean(s)); }

function firstError(out) {
  var txt = clean(out);
  if (!isErr(txt)) return txt.split("\n")[0].trim();
  var lines = txt.split("\n"), head = "", help = "";
  for (var k = 0; k < lines.length; k++) {
    var L = lines[k].trim();
    if (!head && /^error\[/.test(L)) head = L.replace(/^error\[[^\]]*\]:\s*/, "");
    else if (!help && /^help:/i.test(L)) help = L.replace(/^help:\s*/i, "");
  }
  return head + (help ? " — " + help : "");
}

/* A lambda body that still contains newlines defines without complaint and
 * then returns nothing when called — no error, just a function that does not
 * work. Flattening each statement to a single line is what the native REPL
 * does with a continued line, and it is what makes sim.k's multi-line
 * definitions behave. */
function loadSim(src) {
  var stmts = amberStatements(src), bad = [];
  for (var k = 0; k < stmts.length; k++) {
    var line = stmts[k].code.replace(/\n/g, " ");
    var out = vm.eval(line);
    if (isErr(out)) bad.push("sim.k:" + stmts[k].line + " " + firstError(out));
  }
  return bad;
}

/* Install a quote expression, but only if it survives being called once.
 * The in-round trap keeps a bad expression from killing a round, yet it does
 * not catch an undefined name, so the real gate is here: define, call once,
 * and put the previous expression back if either step fails. */
function setQuote(src) {
  src = String(src || "").replace(/[\r\n]+/g, " ");
  var d = vm.eval("Q:{" + src + "}");
  if (isErr(d)) { vm.eval("Q:{" + lastGoodQuote + "}"); return firstError(d); }
  var c = vm.eval("tqchk[]");
  if (isErr(c)) { vm.eval("Q:{" + lastGoodQuote + "}"); return firstError(c); }
  var v = clean(c).trim().split(/\s+/);
  if (v.length !== 2) {
    vm.eval("Q:{" + lastGoodQuote + "}");
    return "a quote must be two numbers — a bid and an ask — but this gave " + v.length;
  }
  lastGoodQuote = src;
  return "";
}

onmessage = function (e) {
  var m = e.data || {};

  if (m.type === "boot") {
    try {
      importScripts.apply(null, m.runtime && m.runtime.length ? m.runtime : ["./amber.wasm.js", "./amber.js"]);
    } catch (err) {
      postMessage({ type: "fatal", message: "could not load the engine: " + String((err && err.message) || err) });
      return;
    }
    vm = new AmberVM();
    vm.boot().then(function () {
      fetch(m.sim || "./sim.k").then(function (r) {
        if (!r.ok) throw new Error("sim.k " + r.status);
        return r.text();
      }).then(function (src) {
        var bad = loadSim(src);
        if (bad.length) { postMessage({ type: "fatal", message: bad[0] }); return; }
        ROUND = Number(clean(vm.eval("TROUND")));
        vm.eval("tinit 1");
        setQuote(lastGoodQuote);
        postMessage({ type: "ready", version: vm.version || "", round: ROUND, ms: Number(clean(vm.eval("TMS"))) });
      }).catch(function (err) {
        postMessage({ type: "fatal", message: "could not load sim.k: " + String((err && err.message) || err) });
      });
    }, function (err) {
      postMessage({ type: "fatal", message: "the engine failed to start: " + String((err && err.message) || err) });
    });
    return;
  }

  if (!vm || !vm.ready) return;

  if (m.type === "quote") {
    var err = setQuote(m.src);
    postMessage({ type: "quote", ok: !err, error: err });
    return;
  }

  if (m.type === "init") {
    vm.eval("tinit " + (m.seed | 0));
    setQuote(lastGoodQuote);
    postMessage({ type: "init", ok: true, seed: m.seed | 0 });
    return;
  }

  if (m.type === "tick") {
    var rows = [], n = m.n || 1, done = false;
    for (var k = 0; k < n; k++) {
      var line = clean(vm.eval("tgo[]")).replace(/\n$/, "");
      if (isErr(line)) { postMessage({ type: "tick", rows: rows, error: firstError(line) }); return; }
      rows.push(line);
      if (Number(line.split(";")[6]) >= ROUND) { done = true; break; }
    }
    postMessage({ type: "tick", rows: rows, done: done });
    return;
  }

  if (m.type === "stats") {
    postMessage({ type: "stats", text: clean(vm.eval("tstats[]")), terr: clean(vm.eval("terr")).trim() });
    return;
  }
};
