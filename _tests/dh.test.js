/* Four colours: the D-reducibility checker behind blog/08-four-colours.html. */
"use strict";

const lib = require("./lib");
const { boot, suite, readWindowGlobal } = lib;

/* Essential colourings of an n-ring by brute force: colour 0 first, new colours
 * in order of first use, neighbours (and last/first) differ. */
function essential(n) {
  const out = [], c = new Array(n).fill(0);
  (function go(j, used) {
    if (j === n) { if (c[n - 1] !== 0) out.push(c.slice()); return; }
    for (let k = 0; k <= Math.min(used, 3); k++) {
      if (k === c[j - 1]) continue;
      c[j] = k; go(j + 1, Math.max(used, k + 1));
    }
  })(1, 1);
  return out;
}

/* How many ring colourings extend to the interior: plain backtracking. */
function extendable(V, R, adj) {
  let count = 0;
  for (const ring of essential(R)) {
    const col = ring.concat(new Array(V - R).fill(-1));
    const ok = (function go(v) {
      if (v === V) return true;
      for (let k = 0; k < 4; k++) {
        if (adj[v].some(u => col[u] === k)) continue;
        col[v] = k;
        if (go(v + 1)) return true;
      }
      col[v] = -1;
      return false;
    })(R);
    if (ok) count++;
  }
  return count;
}

module.exports = async function () {
  const t = suite("Four colours — assets/dh/dh.k");
  const { ev } = await boot("assets/dh/dh.k");
  const field = (out, k) => +(out.match(new RegExp(k + "\\s*\\|?\\s*(-?\\d+)")) || out.match(new RegExp(k + "\\s+(-?\\d+)")) || [])[1];

  // --- the colourings: count matches the closed form and a brute-force enumeration ---
  for (let n = 6; n <= 12; n++) {
    const want = n % 2 ? (3 ** (n - 1) - 1) / 8 : (3 ** (n - 1) + 5) / 8;
    t.eq(+ev("#*ess " + n), want, "ess " + n + " has (3^" + (n - 1) + (n % 2 ? "-1" : "+5") + ")/8 colourings");
  }
  t.eq(ev("#*ess 7"), essential(7).length, "ess 7 agrees with a brute-force enumeration");

  // --- block decompositions are the Catalan numbers ---
  t.eq(ev("#'DEC 2 4 6 8 10 12"), "1 2 5 14 42 132", "block decompositions of 2..12 sectors are Catalan");

  // --- every embedded configuration: the vectorised join agrees with backtracking and the data file ---
  const conf = name => {
    const V = +ev(name + " 0"), R = +ev(name + " 1"), E = ev(name + " 2");
    const adj = [];
    for (let v = 0; v < V; v++) adj.push(ev("(" + name + " 3) " + v).replace(",", "").trim().split(/\s+/).map(Number));
    return { V, R, E, adj };
  };
  for (const name of ["c1", "c11", "c18", "c27"]) {
    const c = conf(name), out = ev("check " + name);
    const ext = field(out, "extendable"), red = field(out, "reducible");
    t.eq(ext, +c.E, name + " (ring " + c.R + "): extendable count matches U_2822.conf");
    if (c.R <= 11) t.eq(ext, extendable(c.V, c.R, c.adj), name + ": extendable count matches JS backtracking");
    t.eq(red, 1, name + " is D-reducible");
  }

  // --- the negative control ---
  const w = conf("wheel"), wout = ev("check wheel");
  t.eq(field(wout, "extendable"), extendable(w.V, w.R, w.adj), "wheel: extendable count matches JS backtracking");
  t.eq(field(wout, "reducible"), 0, "the degree-6 wheel is NOT D-reducible");
  t.eq(field(wout, "good"), field(wout, "extendable"), "wheel: the Kempe game adds no colourings");

  // --- every playground preset runs clean, statement by statement ---
  const EX = readWindowGlobal("assets/dh/examples.js", "DH_EXAMPLES");
  for (const ex of EX) {
    const bad = ex.code.split("\n").filter(l => l.trim() && !/^\s*\//.test(l))
      .map(l => ev(l)).filter(o => /error\[/.test(o));
    t.eq(bad.length, 0, "preset '" + ex.label + "' runs without errors");
  }
  // the XOR preset's own last line must show a proper colouring after the swap
  const xor = EX.find(e => e.id === "xor").code.split("\n").filter(l => l.trim() && !/^\s*\//.test(l));
  xor.slice(0, -1).forEach(l => ev(l));
  t.eq(lib.oneLine(ev(xor[xor.length - 1])), "(0 1 2 0 1 3;0 1 3 0 1 2)", "the XOR preset swaps 2<->3 on whole sectors");
  const sw = ev("*|" + xor[xor.length - 1]).split(" ").map(Number);
  t.ok(sw.every((v, i) => v !== sw[(i + 1) % sw.length]), "the swapped ring colouring is still proper");

  return t.done();
};
