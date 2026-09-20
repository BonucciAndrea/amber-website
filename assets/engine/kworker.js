/* kworker.js — a generic Amber worker for the Projects pages.
 *
 * The Pit's worker knows about ticks and rounds. This one knows nothing: it
 * boots the engine, optionally loads a .k file, and evaluates whatever k it is
 * sent. A new game needs a page and a .k file, not another worker.
 *
 * Protocol (main -> worker):
 *   {type:"boot", runtime:[urls], src:url?}   -> {type:"ready", version}
 *   {type:"eval", id, k}                      -> {type:"eval", id, out, error}
 *   {type:"evals", id, ks}                    -> {type:"evals", id, outs, error}
 *
 * `out` is the engine's stdout for that expression, with ANSI stripped and the
 * trailing newline removed. `error` is a one-line summary, empty when fine.
 */

/* global AmberVM, amberStatements */
"use strict";

var vm = null;
var ANSI = /\x1b\[[0-9;]*m/g;

function clean(s) { return String(s == null ? "" : s).replace(ANSI, ""); }
function isErr(s) { return /error\[/.test(s); }

function firstError(out) {
  var txt = clean(out), lines = txt.split("\n"), head = "", help = "";
  for (var k = 0; k < lines.length; k++) {
    var L = lines[k].trim();
    if (!head && /^error\[/.test(L)) head = L.replace(/^error\[[^\]]*\]:\s*/, "");
    else if (!help && /^help:/i.test(L)) help = L.replace(/^help:\s*/i, "");
  }
  return head + (help ? " — " + help : "");
}

/* Statements are flattened to one line before evaluation: a lambda body that
 * still contains a newline defines without complaint and then returns nothing
 * when called. */
function load(src) {
  var stmts = amberStatements(src), bad = [];
  for (var k = 0; k < stmts.length; k++) {
    var out = vm.eval(stmts[k].code.replace(/\n/g, " "));
    if (isErr(clean(out))) bad.push("line " + stmts[k].line + ": " + firstError(out));
  }
  return bad;
}

function one(k) {
  var raw = vm.eval(k), txt = clean(raw).replace(/\n$/, "");
  return isErr(txt) ? { out: "", error: firstError(raw) } : { out: txt, error: "" };
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
      if (!m.src) { postMessage({ type: "ready", version: vm.version || "" }); return; }
      fetch(m.src).then(function (r) {
        if (!r.ok) throw new Error(m.src + " " + r.status);
        return r.text();
      }).then(function (txt) {
        var bad = load(txt);
        if (bad.length) { postMessage({ type: "fatal", message: bad[0] }); return; }
        postMessage({ type: "ready", version: vm.version || "" });
      }).catch(function (err) {
        postMessage({ type: "fatal", message: String((err && err.message) || err) });
      });
    }, function (err) {
      postMessage({ type: "fatal", message: "the engine failed to start: " + String((err && err.message) || err) });
    });
    return;
  }

  if (!vm || !vm.ready) return;

  if (m.type === "eval") {
    var r = one(m.k);
    postMessage({ type: "eval", id: m.id, out: r.out, error: r.error });
    return;
  }

  if (m.type === "evals") {
    var outs = [], err = "";
    for (var j = 0; j < m.ks.length; j++) {
      var q = one(m.ks[j]);
      outs.push(q.out);
      if (q.error && !err) err = q.error;
    }
    postMessage({ type: "evals", id: m.id, outs: outs, error: err });
    return;
  }
};
