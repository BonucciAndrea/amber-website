/* The Pit: the simulation has to balance, be reproducible, and remain a game
   — a tight quote must lose to adverse selection and a skewed one must not. */
"use strict";

const fs = require("fs");
const path = require("path");
const { ROOT, boot, suite, NL } = require("./lib");

const FIELDS = ["px", "bid", "ask", "inv", "cash", "pnl", "tk", "nf",
                "vol", "flow", "fs", "fp", "fz", "rej", "cap", "mdd"];
const ROUND = 1200;

module.exports = async function () {
  const t = suite("The Pit — assets/tape/sim.k");
  const { ev } = await boot("assets/tape/sim.k");

  function play(quote, seed, ticks) {
    ev("tinit " + seed);
    const def = ev("Q:{" + quote + "}");
    if (/error\[/.test(def)) return { err: def.split(NL)[0] };
    let last = null, idErr = 0, maxInv = 0, badRow = 0;
    for (let k = 0; k < (ticks || ROUND); k++) {
      const row = ev("tgo[]").split(";").map(Number);
      if (row.length !== FIELDS.length) { badRow++; break; }
      const o = {}; FIELDS.forEach((n, j) => o[n] = row[j]);
      // the books must balance on EVERY tick, not just at the end
      if (Math.abs(o.pnl - (o.cash + o.inv * o.px)) > 1e-6) idErr++;
      maxInv = Math.max(maxInv, Math.abs(o.inv));
      last = o;
    }
    return Object.assign({ idErr, maxInv, badRow }, last);
  }

  // --- the accounting identity ---
  const base = play("px+(-0.05 0.05)-0.005*inv", 11);
  t.ok(!base.err, "a full 1200-tick round runs", base.err);
  t.eq(base.badRow, 0, "every tick reports all 16 fields");
  t.eq(base.idErr, 0, "pnl = cash + inventory marked at the mid, on every tick");
  t.eq(base.tk, ROUND, "the round is " + ROUND + " ticks");

  // --- reproducibility: the whole point of the seed ---
  const a = play("px+(-0.03 0.03)-0.004*inv", 11);
  const b = play("px+(-0.03 0.03)-0.004*inv", 11);
  t.eq(a.pnl, b.pnl, "same seed and quote give the same P&L");
  const c = play("px+((-0.03 0.03)-0.004*inv)+0.0*(*1?1.0)", 11);
  t.ok(Math.abs(a.px - c.px) < 1e-9,
    "a quote that uses randomness does not shift the tape",
    "mid ended " + a.px + " vs " + c.px);

  // --- the inventory cap holds ---
  const oneSided = play("px+-0.001 0.20", 11);
  t.ok(oneSided.maxInv <= 30.0001, "inventory never passes the cap of 30", "reached " + oneSided.maxInv);
  t.ok(oneSided.rej > 0, "fills are refused once the cap is reached");

  // --- a crossed quote must not be free money ---
  const crossed = play("px+9 -9", 11, 300);
  t.ok(crossed.pnl === 0 && crossed.nf === 0, "a crossed quote is repaired, not honoured",
    "pnl " + crossed.pnl + " fills " + crossed.nf);

  // --- it still has to be a game ---
  const seeds = [3, 11, 17, 23, 42, 57, 64, 88, 91, 105];
  const mean = q => seeds.reduce((s, x) => s + play(q, x).pnl, 0) / seeds.length;
  const suicide = mean("px+-0.001 0.001");
  const skew = mean("px+(-0.06 0.06)-0.006*inv");
  t.ok(suicide < 0, "quoting no spread loses to adverse selection", "mean " + suicide.toFixed(2));
  t.ok(skew > 0, "a sensible skewed quote makes money", "mean " + skew.toFixed(2));
  t.ok(skew > suicide + 10, "the gap between them is decisive",
    "skew " + skew.toFixed(1) + " vs suicide " + suicide.toFixed(1));
  t.note("mean over " + seeds.length + " seeds: suicide " + suicide.toFixed(2) + ", skew 6c " + skew.toFixed(2));

  // --- the end-of-round summary is a real query ---
  play("px+(-0.05 0.05)-0.005*inv", 11);
  const stats = ev("tstats[]");
  t.ok(/side/.test(stats) && !/error/.test(stats), "tstats[] returns a qSQL summary table");

  // --- the chart's fill markers stay glued to their price ---
  const app = fs.readFileSync(path.join(ROOT, "assets/tape/tape.js"), "utf8");
  const HIST = Number(/var HIST = (\d+)/.exec(app)[1]);
  ev("tinit 11"); ev("Q:{px+(-0.05 0.05)-0.005*inv}");
  const hist = [], fills = [];
  let misaligned = 0, offWindow = 0, stacked = 0, placements = 0;
  for (let k = 0; k < ROUND; k++) {
    const row = ev("tgo[]").split(";").map(Number);
    const o = {}; FIELDS.forEach((n, j) => o[n] = row[j]);
    hist.push({ tk: o.tk, px: o.px, bid: o.bid, ask: o.ask });
    if (hist.length > HIST) hist.shift();
    while (fills.length && fills[0].tk < hist[0].tk) fills.shift();
    if (o.fs !== 0) fills.push({ tk: o.tk, p: o.fp });
    if (hist.length < 2) continue;
    const t0 = hist[0].tk, seen = new Set();
    for (const f of fills) {
      const idx = f.tk - t0;
      if (idx < 0 || idx >= hist.length) { offWindow++; continue; }
      placements++;
      if (seen.has(idx)) stacked++;
      seen.add(idx);
      if (hist[idx].tk !== f.tk) misaligned++;
      const lo = Math.min(hist[idx].bid, hist[idx].ask), hi = Math.max(hist[idx].bid, hist[idx].ask);
      if (f.p < lo - 1e-9 || f.p > hi + 1e-9) misaligned++;
    }
  }
  t.eq(misaligned, 0, placements + " marker placements, every one on its own tick and inside that tick's quote");
  t.eq(stacked, 0, "no two markers share a slot");
  t.eq(offWindow, 0, "markers that scroll off the window are pruned");

  return t.done();
};
