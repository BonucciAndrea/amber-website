/* golf.semantics.test.js — does each puzzle TEST what it ASKS?
 *
 * The other golf test proves the reference answer matches the stored expected
 * values. That is not the same as proving either one matches the prompt, and
 * six puzzles once failed exactly there: "the middle two" of 1 2 3 4 was
 * recorded as 0 -1, because the k subtracted where it should have dropped,
 * and the generator dutifully wrote down whatever it produced.
 *
 * So this file never runs the engine. Every puzzle is re-implemented here in
 * plain JavaScript, written from the PROMPT, and its answer is compared with
 * the stored expected value. Two independent implementations agreeing is
 * evidence; one implementation agreeing with itself is not.
 *
 * A puzzle with no oracle here is a failure, so a new puzzle cannot be added
 * without someone stating twice, in two languages, what it is supposed to do.
 */
"use strict";

const { suite, readWindowGlobal } = require("./lib");

/* ---------------------------------------------------------------- literals */
/* Enough of k's notation to read the test data: atoms, vectors, nested lists,
   enlist, strings and the two empty forms. A char is {c:"a"} so that a string
   (a char VECTOR) stays distinguishable from a char atom, and an atom stays
   distinguishable from a one-element vector -- 5 is not ,5. */
function parse(src) {
  const s = String(src).trim();
  if (s === "!0" || s === "0#0" || s === "0#0.0") return [];
  if (s[0] === '"') {
    const body = [...s.slice(1, -1)].map(c => ({ c }));
    return body.length === 1 ? body[0] : body;   // "a" is a char atom, "ab" a string
  }
  if (s[0] === ",") return [parse(s.slice(1))];
  if (s[0] === "(" && s[s.length - 1] === ")") {
    const parts = splitTop(s.slice(1, -1));
    return parts.length === 1 ? parse(parts[0]) : parts.map(parse);
  }
  const toks = s.split(/\s+/).filter(Boolean).map(num);
  return toks.length === 1 ? toks[0] : toks;
}
function num(t) {
  if (t === "0N") return null;
  if (t === "0w") return Infinity;
  if (t === "-0w") return -Infinity;
  return Number(t);
}
function splitTop(s) {
  const out = []; let depth = 0, cur = "", inStr = false;
  for (const ch of s) {
    if (inStr) { cur += ch; if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; cur += ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/* Structural comparison: shape must match exactly, numbers within a whisker. */
function same(a, b) {
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") return a.c === b.c;
  if (typeof a === "number" && typeof b === "number") {
    if (!isFinite(a) || !isFinite(b)) return a === b;
    return Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  return a === b;
}
function show(v) {
  if (Array.isArray(v)) return "(" + v.map(show).join(";") + ")";
  if (v && typeof v === "object") return v.c;
  return String(v);
}

/* ------------------------------------------------------------------ tools */
const V = x => (Array.isArray(x) ? x : [x]);          // treat an atom as one value
/* An elementwise verb applied to an atom gives an atom back: 0|-5 is 0, not ,0.
   mapv keeps that distinction so the oracle does not invent a vector. */
const mapv = (x, f) => (Array.isArray(x) ? x.map(f) : f(x));
const sum = a => a.reduce((s, v) => s + v, 0);
const prod = a => a.reduce((s, v) => s * v, 1);
const uniq = a => { const o = [], s = new Set(); for (const v of a) if (!s.has(v)) { s.add(v); o.push(v); } return o; };
const asc = a => a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(p => p[0]);
const gradeUp = a => a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(p => p[1]);
const gradeDn = a => a.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]).map(p => p[1]);
const digits = (n, b) => { if (n === 0) return [0]; const o = []; while (n > 0) { o.unshift(n % b); n = Math.floor(n / b); } return o; };
const divisorsOf = n => { const o = []; for (let d = 1; d <= n; d++) if (n % d === 0) o.push(d); return o; };
const groups = a => { const m = new Map(); a.forEach(v => m.set(v, (m.get(v) || 0) + 1)); return m; };
const str = a => V(a).map(o => o.c).join("");
const chars = s => [...s].map(c => ({ c }));
const T = m => m[0].map((_, j) => m.map(r => r[j]));

/* ---------------------------------------------------------------- oracles */
/* Each one is written from the prompt, deliberately the long way round. */
const O = {
  // counting and folding
  count: x => V(x).length,
  sum: x => sum(V(x)),
  prod: x => prod(V(x)),
  max: x => Math.max(...V(x)),
  min: x => Math.min(...V(x)),
  mean: x => sum(V(x)) / V(x).length,
  range: x => Math.max(...V(x)) - Math.min(...V(x)),
  ndistinct: x => uniq(V(x)).length,
  nzero: x => V(x).filter(v => v === 0).length,
  nodd: x => V(x).filter(v => Math.abs(v % 2) === 1).length,
  npos: x => V(x).filter(v => v > 0).length,
  abovemean: x => { const a = V(x), m = sum(a) / a.length; return a.filter(v => v > m).length; },
  twobig: x => { const a = asc(V(x)); return a[a.length - 1] + a[a.length - 2]; },
  evensum: x => sum(V(x).filter(v => v % 2 === 0)),
  prodnz: x => prod(V(x).filter(v => v !== 0)),
  matsum: x => sum(x.flat()),
  trace: x => sum(x.map((r, i) => r[i])),
  dot: x => sum(x[0].map((v, i) => v * x[1][i])),

  // shape
  reverse: x => [...V(x)].reverse(),
  last: x => V(x)[V(x).length - 1],
  append: x => V(x).concat([...V(x)].reverse()),
  flatten: x => x.flat(),
  flat2: x => x.flat().flat(),
  flatuniq: x => uniq(x.flat()),
  transpose: x => T(x.map(V)),
  rot90: x => T([...x.map(V)].reverse()),
  revrows: x => x.map(r => [...V(r)].reverse()),
  rowlens: x => x.map(r => V(r).length),
  rowsum: x => x.map(r => sum(V(r))),
  rowmax: x => x.map(r => Math.max(...V(r))),
  rowscan: x => x.map(r => { let s = 0; return V(r).map(v => (s += v)); }),
  diag: x => x.map((r, i) => V(r)[i]),
  antidiag: x => x.map((r, i) => V(r)[x.length - 1 - i]),
  symm: x => { const m = x.map(V); return same(m, T(m)) ? 1 : 0; },
  issquare: x => (x.length === V(x[0]).length ? 1 : 0),
  ident: x => Array.from({ length: x }, (_, i) => Array.from({ length: x }, (_, j) => (i === j ? 1 : 0))),
  times: x => Array.from({ length: x }, (_, i) => Array.from({ length: x }, (_, j) => (i + 1) * (j + 1))),
  matadd: x => x[0].map((r, i) => V(r).map((v, j) => v + V(x[1][i])[j])),
  chunk3: x => { const a = V(x), o = []; for (let i = 0; i < a.length; i += 3) o.push(a.slice(i, i + 3)); return o; },
  halfway: x => { const a = V(x), h = a.length / 2; return [a.slice(0, h), a.slice(h)]; },
  inter: x => T(x.map(V)).flat(),
  zipidx: x => V(x).map((v, i) => [i, v]),
  pairsums: x => { const a = V(x); return a.map(r => a.map(v => v + r)).flat(); },
  midtwo: x => { const a = V(x); return a.slice(a.length / 2 - 1, a.length / 2 + 1); },

  // selection and order
  sort: x => asc(V(x)),
  sortdesc: x => [...asc(V(x))].reverse(),
  sorteduniq: x => asc(uniq(V(x))),
  sortflat: x => asc(x.flat()),
  sortedrows: x => x.map(r => asc(V(r))),
  sortrows: x => V(x).map((r, i) => [V(r)[0], i, r]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(p => p[2]),
  distinct: x => uniq(V(x)),
  droplast: x => uniq([...V(x)].reverse()).reverse(),
  rank: x => gradeUp(gradeUp(V(x))),
  byabs: x => V(x).map((v, i) => [Math.abs(v), i, v]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(p => p[2]),
  median: x => asc(V(x))[Math.floor(V(x).length / 2)],
  second: x => asc(V(x))[1],
  secondbig: x => { const a = asc(V(x)); return a[a.length - 2]; },
  argmax: x => { const a = V(x), m = Math.max(...a); return a.map((v, i) => [v, i]).filter(p => p[0] === m).map(p => p[1]); },
  dropmax: x => { const a = V(x), m = Math.max(...a); return a.filter(v => v !== m); },
  bigrow: x => { const rows = x.map(V); let bi = 0; rows.forEach((r, i) => { if (sum(r) > sum(rows[bi])) bi = i; }); return rows[bi]; },
  countrows: x => { const s = x.map(r => sum(V(r))), m = sum(s) / s.length; return s.filter(v => v > m).length; },
  nozeros: x => V(x).map((v, i) => [v, i]).filter(p => p[0] === 0).map(p => p[1]),
  evens: x => V(x).filter(v => v % 2 === 0),
  evenidx: x => V(x).filter((_, i) => i % 2 === 0),
  oddidx: x => V(x).filter((_, i) => i % 2 === 1),
  sumodd: x => sum(V(x).filter((_, i) => i % 2 === 1)),
  every3: x => V(x).filter((_, i) => (i + 1) % 3 !== 0),
  takepos: x => { const a = V(x), o = []; for (const v of a) { if (!(v > 0)) break; o.push(v); } return o; },
  rotn: x => { const n = x[0], a = V(x[1]); return a.map((_, i) => a[(i + n) % a.length]); },
  rotmax: x => { const a = V(x), k = a.indexOf(Math.max(...a)); return a.map((_, i) => a[(i + k) % a.length]); },

  // arithmetic over a vector
  clamp: x => mapv(x, v => Math.max(0, v)),
  clip: x => mapv(x, v => Math.max(0, Math.min(10, v))),
  abs: x => mapv(x, Math.abs),
  signs: x => mapv(x, v => (v > 0 ? 1 : v < 0 ? -1 : 0)),
  nearest: x => mapv(x, v => Math.floor(v + 0.5)),
  odddrop: x => mapv(x, v => (v % 2 === 0 ? v : 0)),
  distmean: x => { const a = V(x), m = sum(a) / a.length; return a.map(v => v - m); },
  norm: x => { const a = V(x), lo = Math.min(...a), hi = Math.max(...a); return a.map(v => (v - lo) / (hi - lo)); },
  scan: x => { let s = 0; return V(x).map(v => (s += v)); },
  cumprod: x => { let s = 1; return V(x).map(v => (s *= v)); },
  cummax: x => { let s = -Infinity; return V(x).map(v => (s = Math.max(s, v))); },
  cummin: x => { let s = Infinity; return V(x).map(v => (s = Math.min(s, v))); },
  diff: x => V(x).slice(1).map((v, i) => v - V(x)[i]),
  adjprod: x => V(x).slice(1).map((v, i) => v * V(x)[i]),
  rises: x => V(x).slice(1).filter((v, i) => v > V(x)[i]).length,
  strictup: x => (V(x).every((v, i) => i === 0 || v > V(x)[i - 1]) ? 1 : 0),
  palin: x => (same(V(x), [...V(x)].reverse()) ? 1 : 0),
  allsame: x => (uniq(V(x)).length === 1 ? 1 : 0),
  anyzero: x => (V(x).some(v => v === 0) ? 1 : 0),
  isperm: x => (same(asc(V(x)), V(x).map((_, i) => i)) ? 1 : 0),
  addup: x => V(x).filter((v, i) => i === 0 || v !== V(x)[i - 1]),
  maxsub: x => { const a = V(x); let best = -Infinity, cur = 0; for (const v of a) { cur = Math.max(v, cur + v); best = Math.max(best, cur); } return best; },
  maxrun: x => { const a = V(x); let best = 1, cur = 1; for (let i = 1; i < a.length; i++) { cur = a[i] > a[i - 1] ? cur + 1 : 1; best = Math.max(best, cur); } return best; },
  tally: x => { const a = V(x), m = Math.max(...a); return Array.from({ length: m + 1 }, (_, i) => a.filter(v => v === i).length); },
  rle: x => [...groups(V(x)).values()],
  modecount: x => Math.max(...groups(V(x)).values()),
  longrun: x => Math.max(...groups(V(x)).values()),
  onceonly: x => [...groups(V(x)).values()].filter(c => c === 1).length,
  mode: x => { const g = groups(V(x)); let best = null, n = -1; for (const [v, c] of g) if (c > n) { n = c; best = v; } return best; },

  // numbers
  fact: x => prod(Array.from({ length: x }, (_, i) => i + 1)),
  tri: x => { let s = 0; return Array.from({ length: x }, (_, i) => (s += i + 1)); },
  sumsq: x => sum(Array.from({ length: x }, (_, i) => i * i)),
  pow2: x => Array.from({ length: x }, (_, i) => Math.pow(2, i + 1)),
  bin2dec: x => V(x).reduce((s, b) => s * 2 + b, 0),
  digits2num: x => V(x).reduce((s, d) => s * 10 + d, 0),
  base3: x => digits(x, 3),
  binlen: x => digits(x, 2).length,
  ndigits: x => digits(x, 10).length,
  revnum: x => digits(x, 10).reverse(),
  digitsum: x => sum(digits(x, 10)),
  sumdigitsall: x => V(x).map(n => sum(digits(n, 10))),
  popcount: x => sum(digits(x, 2)),
  ispow2: x => (sum(digits(x, 2)) === 1 ? 1 : 0),
  xor: x => sum(digits(x, 2)) % 2,
  palnum: x => (same(digits(x, 10), digits(x, 10).reverse()) ? 1 : 0),
  ndiv: x => divisorsOf(x).length,
  divisors: x => divisorsOf(x),
  properdiv: x => sum(divisorsOf(x)) - x,
  perfect: x => (sum(divisorsOf(x)) - x === x ? 1 : 0),
  isprime: x => (divisorsOf(x).length === 2 ? 1 : 0),
  primes: x => { const o = []; for (let n = 2; n < x; n++) if (divisorsOf(n).length === 2) o.push(n); return o; },
  gcd: x => { const g = (a, b) => (b ? g(b, a % b) : a); return V(x).reduce((a, b) => g(a, b)); },
  fib: x => { const o = [0, 1]; for (let i = 0; i < x; i++) o.push(o[o.length - 1] + o[o.length - 2]); return o; },
  pascal: x => { let r = [1]; for (let i = 0; i < x; i++) r = [0].concat(r).map((v, j) => v + (r.concat([0]))[j]); return r; },
  collatz: x => { let n = x, c = 0; while (n !== 1) { n = n % 2 ? 3 * n + 1 : n / 2; c++; } return c; },
  diffsigns: x => { const d = V(x).slice(1).map((v, i) => v - V(x)[i]); const s = d.map(v => (v > 0 ? 1 : v < 0 ? -1 : 0)); return s.slice(1).filter((v, i) => v !== s[i]).length; },

  // strings
  countwords: x => str(x).split(" ").length,
  vowels: x => [...str(x)].filter(c => "aeiou".includes(c)).length,
  charcodes: x => mapv(x, o => o.c.charCodeAt(0)),
  joincommas: x => chars(x.map(str).join(","))
};

module.exports = async function () {
  const t = suite("Array Golf semantics — an independent oracle");
  const P = readWindowGlobal("assets/golf/puzzles.js", "GOLF_PUZZLES");

  const missing = P.filter(p => !O[p.id]).map(p => p.id);
  t.ok(missing.length === 0, "every puzzle has an oracle", missing.join(", "));

  let checked = 0, wrong = 0;
  for (const p of P) {
    const fn = O[p.id];
    if (!fn) continue;
    for (const [inp, want] of p.show.concat(p.hide)) {
      checked++;
      let got;
      try { got = fn(parse(inp)); }
      catch (err) { wrong++; t.ok(false, p.id + ": the oracle threw on " + inp, err.message); continue; }
      if (!same(got, parse(want))) {
        wrong++;
        t.ok(false, p.id + " (" + p.par + ")",
          inp + " → stored " + want + ", oracle says " + show(got));
      }
    }
  }
  t.ok(wrong === 0, checked + " cases agree with an independent implementation");

  // two puzzles that ask the same question are one puzzle
  const sig = new Map(); let twins = 0;
  for (const p of P) {
    if (!O[p.id]) continue;
    const key = p.show.concat(p.hide).map(c => show(O[p.id](parse(c[0])))).join("|") + "@" + p.show[0][0];
    if (sig.has(key)) { twins++; t.ok(false, p.id + " asks the same thing as " + sig.get(key)); }
    sig.set(key, p.id);
  }
  t.ok(twins === 0, "no two puzzles are the same question in different words");

  return t.done();
};
