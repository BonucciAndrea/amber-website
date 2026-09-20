/* Dots: every preset must produce a well-formed frame at every grid size.
   The presets and the per-grid setup are read out of the SHIPPED files, so
   what is tested is what the page runs. */
"use strict";

const fs = require("fs");
const path = require("path");
const { ROOT, boot, suite, oneLine, NL } = require("./lib");

module.exports = async function () {
  const t = suite("Dots — assets/dots/");

  // the setup comes from the worker, the presets from the app
  const worker = fs.readFileSync(path.join(ROOT, "assets/dots/worker.js"), "utf8");
  const m = /function setupSrc\(g\) \{\s*return \[([\s\S]*?)\]\.join\("; "\);/.exec(worker);
  if (!m) { t.ok(false, "could not read setupSrc from dots/worker.js"); return t.done(); }
  const setupFor = new Function("g", "return [" + m[1] + '].join("; ");');

  const app = fs.readFileSync(path.join(ROOT, "assets/dots/dots.js"), "utf8");
  const PRESETS = eval(/var PRESETS = (\[[\s\S]*?\n\];)/.exec(app)[1].replace(/;$/, ""));
  const GRIDS = eval(/var GRIDS = (\[[^\]]*\])/.exec(app)[1]);

  const { ev } = await boot();
  t.ok(PRESETS.length > 0, PRESETS.length + " presets, grids " + GRIDS.join("/"));

  let checked = 0, bad = 0;
  for (const G of GRIDS) {
    const N = G * G;
    for (const [name, expr, setup] of PRESETS) {
      ev(setupFor(G));                       // fresh grid: presets must not leak
      if (setup) ev(setup);
      const def = ev("F:{" + expr + "}");
      if (/error\[/.test(def)) { bad++; t.ok(false, name + " @" + G + " failed to define", def.split(NL)[0]); continue; }
      // sample time AND cursor: several presets are mouse-driven
      const samples = [[0, 0, 0], [0.7, 3, 5], [1.9, G - 1, 0], [3.3, (G - 1) / 2, (G - 1) / 2], [5.1, 0, G - 1], [8.4, G - 1, G - 1]];
      for (const [tv, mx, my] of samples) {
        const frame = ev("t:" + tv + ";mx:" + mx + ";my:" + my + ";md:0;DOT[]");
        checked++;
        const codes = [...frame].map(c => c.charCodeAt(0));
        const okLen = frame.length === N;
        const okRange = codes.every(c => c >= 33 && c <= 126);
        if (!okLen || !okRange) {
          bad++;
          t.ok(false, name + " @" + G + "x" + G + " t=" + tv,
            okLen ? "byte outside 33..126" : "length " + frame.length + ", want " + N);
          break;
        }
      }
    }
  }
  t.ok(bad === 0, checked + " frames, every one exactly N bytes in printable range");

  // the clamp has to survive what an expression can actually produce
  ev(setupFor(32));
  const edge = [["NaN", "0n"], ["+inf", "0w"], ["-inf", "-0w"], ["atom", "1"],
                ["short vector", "1 2 3"], ["huge", "1e18*X"], ["divide by zero", "X%0"]];
  for (const [label, expr] of edge) {
    ev("F:{" + expr + "}");
    const frame = ev("DOT[]");
    const codes = [...frame].map(c => c.charCodeAt(0));
    t.ok(frame.length === 1024 && codes.every(c => c >= 33 && c <= 126),
      "clamp survives " + label, "length " + frame.length);
  }

  return t.done();
};
