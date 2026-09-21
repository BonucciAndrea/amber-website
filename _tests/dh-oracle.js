/* dh-oracle.js — an independent implementation of D-reducibility, written from
 * the definitions in the report (4_Color_Theorem.pdf, §2), not from the code:
 *
 *  - block decompositions: every set partition of the sectors that satisfies
 *    Theorem 6.6.4 (Fritsch): (1) a block holds sectors of one type only,
 *    (2) blocks do not overlap (no k1 < l1 < k2 < l2), (3) two blocks that
 *    abut at one point abut at exactly one more;
 *  - a move: swap the colour pair inside ANY subset of the blocks;
 *  - good of stage n+1: some partition, for all decompositions, some move lands
 *    in the stage-n set. Iterate to the fixed point (Φ_N, Definition 2.10).
 *
 * Nothing here is shared with dh.k, so agreement is evidence, not an echo.
 */
"use strict";

function essential(n) {
  const out = [], c = [0];
  (function go(used) {
    if (c.length === n) { if (c[n - 1] !== 0) out.push(c.slice()); return; }
    for (let k = 0; k <= Math.min(used, 3); k++) {
      if (k === c[c.length - 1]) continue;
      c.push(k); go(Math.max(used, k + 1)); c.pop();
    }
  })(1);
  return out;
}

/* rename colours into first-use order */
function canon(c) {
  const m = new Map(); return c.map(x => { if (!m.has(x)) m.set(x, m.size); return m.get(x); });
}

function extendable(V, R, adj, ring) {
  const col = ring.concat(new Array(V - R).fill(-1));
  return (function go(v) {
    if (v === V) return true;
    for (let k = 0; k < 4; k++) {
      if (adj[v].some(u => col[u] === k)) continue;
      col[v] = k; if (go(v + 1)) return true;
    }
    col[v] = -1; return false;
  })(R);
}

/* all set partitions of 0..m-1 as restricted-growth label lists */
function setPartitions(m) {
  const out = [], a = [0];
  (function go(mx) {
    if (a.length === m) { out.push(a.slice()); return; }
    for (let k = 0; k <= mx + 1; k++) { a.push(k); go(Math.max(mx, k)); a.pop(); }
  })(0);
  return m ? out : [[]];
}

/* Theorem 6.6.4. Sectors alternate type around the ring, so type = index parity. */
function isBlockDecomposition(lab) {
  const m = lab.length, nb = Math.max(...lab) + 1;
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++)
    if (lab[i] === lab[j] && (i - j) % 2) return false;                          // (1)
  for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++)
    for (let c = b + 1; c < m; c++) for (let d = c + 1; d < m; d++)
      if (lab[a] === lab[c] && lab[b] === lab[d] && lab[a] !== lab[b]) return false; // (2)
  const abut = {};
  for (let i = 0; i < m; i++) {
    const x = lab[i], y = lab[(i + 1) % m];
    if (x === y) continue;
    const k = Math.min(x, y) + "," + Math.max(x, y); abut[k] = (abut[k] || 0) + 1;
  }
  return Object.values(abut).every(n => n === 2) && (nb > 1 || m === 1);        // (3)
}

function blockDecompositions(m) {
  return setPartitions(m).filter(isBlockDecomposition);
}

/* Kempe sectors of ring colouring c under partition w (0 pairs with w): a list
 * of vertex lists. Consecutive vertices whose colours lie in the same pair share
 * a sector; the ring closes, so the last run joins the first when they match. */
function sectors(c, w) {
  const side = x => (x === 0 || x === w ? 0 : 1), n = c.length, S = [[0]];
  for (let i = 1; i < n; i++) {
    if (side(c[i]) === side(c[i - 1])) S[S.length - 1].push(i); else S.push([i]);
  }
  if (S.length > 1 && side(c[n - 1]) === side(c[0])) S[0] = S.pop().concat(S[0]);
  return S;
}

const PAIR = w => x => (x === 0 ? w : x === w ? 0 : [1, 2, 3].filter(y => y !== w).find(y => y !== x));

/* One Kempe-game stage: is c good relative to the set `good` (of canon keys)? */
function goodUnder(c, good) {
  for (let w = 1; w <= 3; w++) {
    const S = sectors(c, w);
    if (S.length < 2) continue;                    // one sector: every move is a renaming
    const swap = PAIR(w);
    const all = blockDecompositions(S.length).every(lab => {
      const nb = Math.max(...lab) + 1;
      for (let mask = 0; mask < (1 << nb); mask++) {
        const d = c.slice();
        S.forEach((sec, si) => { if (mask >> lab[si] & 1) sec.forEach(v => { d[v] = swap(d[v]); }); });
        if (good.has(canon(d).join(""))) return true;
      }
      return false;
    });
    if (all) return true;
  }
  return false;
}

/* Full D-reducibility with stage counts: returns {phi0, stages:[|Φ0|,|Φ1|,...], reducible}. */
function dReducible(V, R, adj) {
  const ring = essential(R), good = new Set(), sizes = [];
  ring.forEach(c => { if (extendable(V, R, adj, c)) good.add(c.join("")); });
  sizes.push(good.size);
  for (;;) {
    const add = ring.filter(c => !good.has(c.join("")) && goodUnder(c, good));  // Jacobi: Φn fixed
    if (!add.length) break;
    add.forEach(c => good.add(c.join("")));
    sizes.push(good.size);
  }
  return { total: ring.length, stages: sizes, reducible: good.size === ring.length };
}

module.exports = { essential, canon, sectors, blockDecompositions, isBlockDecomposition, dReducible, goodUnder, PAIR };
