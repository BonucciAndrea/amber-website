/* Notepad: the statement splitter has to hand the engine something that
   actually runs. A lambda body containing a newline defines without complaint
   and then returns NOTHING when called — no error, just a function that does
   not work — so this is guarded on purpose. */
"use strict";

const { boot, suite, NL } = require("./lib");

module.exports = async function () {
  const t = suite("Notepad — assets/notepad/amber.js");
  const { ev, vm } = await boot();

  const run = src => {
    let last = "";
    for (const st of global.amberStatements(src)) last = ev(st.code);
    return last;
  };

  t.eq(run("f:{[a]" + NL + "  b:a+1;" + NL + "  b*2" + NL + "  }" + NL + "f 3"), "8",
    "a function typed over several lines works");
  t.eq(run("g:{[a]" + NL + "  $[a>0;" + NL + "    [7];" + NL + "    0]" + NL + "  }" + NL + "g 3"), "7",
    "a multi-line conditional works");
  t.eq(run("k:{[a]" + NL + "  b:a+2;   / a comment" + NL + "  b*10" + NL + "  }" + NL + "k 1"), "30",
    "a comment inside a continued body is stripped");
  t.eq(run("h:{[a]a*3}" + NL + "h 4"), "12", "a one-line function still works");
  t.eq(run("2+2"), "4", "a bare expression still works");
  const tbl = run("t:([]s:`a`b;" + NL + "  p:1 2.0)" + NL + "select sum p from t");
  t.ok(!/error\[/.test(tbl) && tbl.length > 0, "a multi-line table literal works");

  // and the bundled examples, the way the Notepad runs them: fresh engine each
  const FILES = ["basics.k", "tour.k", "practice.k", "extended.k", "attributes.k", "graphs.k",
                 "hft.k", "tick.k", "wj.k", "peach.k", "bench.k", "test.k"];
  let bad = 0, statements = 0;
  for (const f of FILES) {
    const fresh = await boot();
    const src = fresh.vm.readFile(f);
    const sts = global.amberStatements(src);
    statements += sts.length;
    let errs = 0;
    for (const st of sts) if (/error\[/.test(fresh.ev(st.code.replace(/\n/g, " ")))) errs++;
    if (errs) { bad++; t.ok(false, f + " reports " + errs + " error(s) through the Notepad path"); }
  }
  t.ok(bad === 0, "all " + FILES.length + " bundled examples run clean (" + statements + " statements)");

  t.ok(/[0-9]/.test(vm.version || ""), "the engine reports a version: " + (vm.version || "(none)"));

  return t.done();
};
