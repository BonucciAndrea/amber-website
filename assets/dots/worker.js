/* worker.js — hosts the Amber engine off the main thread for Dots.
 *
 * Why a worker: a Dots expression is arbitrary Amber, so a visitor can write a
 * non-converging one (`(1+)/1`) and wedge the interpreter. On the main thread
 * that freezes the tab and the only way out is closing it. Here the page can
 * terminate a wedged worker, boot a fresh one, and put the last good
 * expression back — see the watchdog in dots.js.
 *
 * Protocol (main -> worker):
 *   {type:"boot",  runtime:[...urls], grid:N}   -> {type:"ready", version}
 *   {type:"grid",  grid:N}                      -> {type:"grid", grid}
 *   {type:"setup", src}                         -> {type:"setup", ok, error}
 *   {type:"expr",  src}                         -> {type:"expr", ok, error}
 *   {type:"frame", t, mx, my, md, seq}          -> {type:"frame", seq, cells, ms, error}
 *
 * A frame comes back as `cells`: exactly grid*grid printable ASCII bytes, one
 * per cell, each the value of that cell quantised to 0..93 and offset by 33.
 * See LEVELS in dots.js for the inverse. The engine writes it with `0: (a raw
 * char-vector write, no formatting), which is why one frame is one small
 * string and not a parsed array.
 */

/* global AmberVM */
"use strict";

var vm = null;
var G = 32;
var N = G * G;

/* The per-grid setup. Everything a Dots expression can reference is built once
 * here, so a frame only has to assign t/mx/my/md and call DOT[].
 *
 *   X, Y   column and row of each cell, 0..G-1, as floats
 *   i      flat index, 0..N-1
 *   R      distance from the centre
 *   NB     the 8 wrapped neighbour index vectors (for Life-style presets)
 *   DOT[]  quantise F[] to printable ASCII and write it raw
 *
 * X and Y are capitals on purpose: x and y are k's implicit lambda parameters,
 * so a global `x` would be shadowed the moment an expression contains {...}.
 *
 * The clamp is `-1.0|1.0&v`, which pins the value into [-1,1] and — because
 * `1.0&0n` is 0n and `-1.0|0n` is -1.0 — also folds NaN down to -1 rather than
 * letting `i$ produce an integer null that would escape the ASCII range and
 * corrupt the frame. N#v broadcasts an atom (so `1` is a legal full-grid
 * expression) and cycles a short vector.
 */
function setupSrc(g) {
  return [
    "G:" + g + "; N:G*G; ix:!N",
    "X:`f$G!ix; Y:`f$_ix%G; i:`f$ix",
    "CX:G!ix; RY:_ix%G",
    "cx:0.5*`f$G-1; cy:cx",
    "R:%((X-cx)*(X-cx))+((Y-cy)*(Y-cy))",
    "OFF:(-1 -1;0 -1;1 -1;-1 0;1 0;-1 1;0 1;1 1)",
    "NB:{[o](G*G!RY+o 1)+G!CX+o 0}'OFF",
    "t:0.0; mx:cx; my:cy; md:0.0",
    "DOT:{[]`0:`c$33+`i$46.5*1+(-1.0|1.0&`f$N#F[]);}"
  ].join("; ");
}

var ANSI = /\x1b\[[0-9;]*m/g;

function clean(s) {
  return String(s == null ? "" : s).replace(ANSI, "");
}

/* An Amber error report is multi-line and starts with `error[Ennnn]`. Keep the
 * first line and the inline `help:`/label line if there is one — enough to be
 * actionable in a one-line error slot, without the source echo and carets. */
function firstError(out) {
  var txt = clean(out);
  if (!/error\[/.test(txt)) return txt.split("\n")[0].trim();
  var lines = txt.split("\n"), head = "", help = "";
  for (var k = 0; k < lines.length; k++) {
    var L = lines[k].trim();
    if (!head && /^error\[/.test(L)) head = L.replace(/^error\[[^\]]*\]:\s*/, "");
    else if (!help && /^help:/i.test(L)) help = L.replace(/^help:\s*/i, "");
  }
  return head + (help ? " — " + help : "");
}

function evalLine(src) {
  var out = vm.eval(src);
  var txt = clean(out);
  return { out: out, txt: txt, ok: !/error\[/.test(txt), error: /error\[/.test(txt) ? firstError(out) : "" };
}

function applyGrid(g) {
  G = g; N = g * g;
  var r = evalLine(setupSrc(g));
  return r;
}

onmessage = function (e) {
  var m = e.data || {};

  if (m.type === "boot") {
    try {
      // importScripts is relative to this worker's URL; the page passes the
      // runtime location so the same worker file serves both the standalone
      // folder (runtime beside it) and the website (runtime in ../notepad/).
      var urls = m.runtime && m.runtime.length ? m.runtime : ["./amber.wasm.js", "./amber.js"];
      importScripts.apply(null, urls);
    } catch (err) {
      postMessage({ type: "fatal", message: "could not load the engine: " + String((err && err.message) || err) });
      return;
    }
    vm = new AmberVM();
    vm.boot().then(function () {
      applyGrid(m.grid || 32);
      postMessage({ type: "ready", version: vm.version || "", grid: G });
    }, function (err) {
      postMessage({ type: "fatal", message: "the engine failed to start: " + String((err && err.message) || err) });
    });
    return;
  }

  if (!vm || !vm.ready) return;

  if (m.type === "grid") {
    var g = applyGrid(m.grid);
    postMessage({ type: "grid", grid: G, ok: g.ok, error: g.error });
    return;
  }

  if (m.type === "setup") {
    var s = m.src && m.src.trim() ? evalLine(m.src.replace(/[\r\n]+/g, "; ")) : { ok: true, error: "" };
    postMessage({ type: "setup", ok: s.ok, error: s.error });
    return;
  }

  if (m.type === "expr") {
    // Wrap the expression in a niladic lambda. A bare `F:{...}` define only
    // fails here on a parse error; a runtime error (undefined name, type
    // mismatch) surfaces on the first frame instead, which is why dots.js
    // treats a bad frame as an expression error too.
    var d = evalLine("F:{" + String(m.src || "").replace(/[\r\n]+/g, " ") + "}");
    postMessage({ type: "expr", ok: d.ok, error: d.error });
    return;
  }

  if (m.type === "frame") {
    var t0 = (self.performance || Date).now();
    var r = vm.eval(
      "t:" + m.t + ";mx:" + m.mx + ";my:" + m.my + ";md:" + m.md + ";DOT[]"
    );
    var ms = (self.performance || Date).now() - t0;
    var cells = r.replace(/\n$/, "");
    // A good frame is exactly N printable bytes. Length is the robust check:
    // an error report is longer and carries ANSI, and a wrong-length result
    // would desynchronise the renderer.
    if (cells.length === N && cells.indexOf("\x1b") < 0) {
      postMessage({ type: "frame", seq: m.seq, cells: cells, ms: ms });
    } else {
      postMessage({ type: "frame", seq: m.seq, cells: null, ms: ms, error: firstError(r) || "the expression did not produce one value per cell" });
    }
    return;
  }
};
