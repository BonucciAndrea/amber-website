/* Array Golf: every puzzle must be solvable by its own stated answer, and the
   judge must reject a wrong one. A puzzle whose reference solution no longer
   passes is a puzzle nobody can solve — this is the test that catches it. */
"use strict";

const { boot, suite, readWindowGlobal, NL } = require("./lib");

module.exports = async function () {
  const t = suite("Array Golf — assets/golf/");
  const P = readWindowGlobal("assets/golf/puzzles.js", "GOLF_PUZZLES");
  const { ev } = await boot("assets/golf/golf.k");

  const tiers = {};
  P.forEach(p => tiers[p.tier] = (tiers[p.tier] || 0) + 1);
  t.note(P.length + " puzzles — warm-up " + (tiers[1] || 0) + ", harder " + (tiers[2] || 0) + ", hardest " + (tiers[3] || 0));

  let broken = 0, accepts = 0, tests = 0;
  for (const p of P) {
    const cases = p.show.concat(p.hide);
    const lit = "(" + cases.map(c => "((" + c[0] + ");(" + c[1] + "))").join(";") + ")";

    const def = ev("G:{" + p.par + "}");
    if (/error\[/.test(def)) { broken++; t.ok(false, p.id + ": par does not even define", def.split(NL)[0]); continue; }
    const res = ev("gall[" + lit + "]");
    tests += cases.length;
    if (res !== "1".repeat(cases.length)) {
      broken++;
      const fails = cases.filter((c, j) => res[j] !== "1").map(c => c[0]).slice(0, 2).join(", ");
      t.ok(false, p.id + ": par " + JSON.stringify(p.par) + " fails its own tests (" + res + ")", "e.g. " + fails);
      continue;
    }
    // the judge must say no to something obviously wrong
    ev("G:{99}");
    if (ev("gall[" + lit + "]").indexOf("1") >= 0) { accepts++; t.ok(false, p.id + ": the judge accepts a constant 99"); }
  }
  t.ok(broken === 0, P.length + " puzzles: every reference solution passes all " + tests + " tests");
  t.ok(accepts === 0, "every puzzle rejects a constant answer");

  // no two puzzles may share an answer, and none may be missing tests
  const byPar = new Map(); let dup = 0, thin = 0;
  for (const p of P) {
    const k = p.par.replace(/\s+/g, "");
    if (byPar.has(k)) { dup++; t.ok(false, p.id + " has the same answer as " + byPar.get(k) + ": " + p.par); }
    byPar.set(k, p.id);
    if (p.show.length < 2 || p.hide.length < 1) { thin++; t.ok(false, p.id + " has too few test cases"); }
  }
  t.ok(dup === 0, "no two puzzles share a reference answer");
  t.ok(thin === 0, "every puzzle has shown examples and hidden tests");

  const ids = new Set(P.map(p => p.id));
  t.eq(ids.size, P.length, "every puzzle id is unique");

  // the judge is typed into one character at a time, so it must not throw
  let threw = 0;
  for (const junk of ["", "+", "nosuch", "x+", "1 2 3", "x@", "{", "/"]) {
    const d = ev("G:{" + junk + "}");
    if (/error\[/.test(d)) continue;              // rejected at define, fine
    const r = ev("gall[(((1 2 3);(6)))]");
    if (!/^[01]*$/.test(r) && !/error\[/.test(r)) threw++;
  }
  t.eq(threw, 0, "a half-written expression is judged, not thrown");

  return t.done();
};
