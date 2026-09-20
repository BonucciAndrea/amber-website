/* Sweep: the rules of Minesweeper, checked against sweep.k. */
"use strict";

const { boot, suite } = require("./lib");

module.exports = async function () {
  const t = suite("Sweep — assets/sweep/sweep.k");
  const { ev } = await boot("assets/sweep/sweep.k");

  const view = () => {
    const p = ev("sout[]").split(";");
    return { dead: +p[0], won: +p[1], left: +p[2], rev: +p[3], n: +p[4], board: p[5] };
  };

  // --- bounded neighbours: the edges must not wrap ---
  ev("snew[5;4;0;1]");
  ev("mn::N#1; cnt::+/NV*mn@NI");
  const c = i => +ev("cnt " + i);
  t.ok(c(0) === 3 && c(4) === 3 && c(15) === 3 && c(19) === 3, "corners of an all-mine board count 3");
  t.eq(c(2), 5, "a top edge counts 5");
  t.eq(c(6), 8, "an interior cell counts 8");

  // --- the first click is safe, and lands in open space ---
  let unsafe = 0, notOpen = 0, wrongCount = 0;
  for (let s = 1; s <= 200; s++) {
    ev("snew[9;9;10;" + s + "]");
    const i = (s * 7) % 81;
    ev("sopen " + i);
    if (+ev("mn " + i) !== 0) unsafe++;
    if (+ev("cnt " + i) !== 0) notOpen++;
    if (+ev("+/mn") !== 10) wrongCount++;
  }
  t.eq(unsafe, 0, "200 boards: the first click is never a mine");
  t.eq(notOpen, 0, "200 boards: the first click always opens a region");
  t.eq(wrongCount, 0, "200 boards: exactly 10 mines are dealt every time");

  // --- flood fill ---
  ev("snew[9;9;10;42]"); ev("sopen 40");
  let v = view();
  t.ok(v.rev > 1, "one click opens a whole empty region", "revealed " + v.rev);
  t.eq(ev("+/rv&mn"), "0", "the flood never reveals a mine");

  // --- flags ---
  ev("snew[9;9;10;7]"); ev("sopen 40");
  const before = view().left;
  const hidden = ev("5#&~rv").trim().split(/\s+/).map(Number);
  ev("sflag " + hidden[0]); ev("sflag " + hidden[1]);
  t.eq(view().left, before - 2, "each flag lowers the mines-left counter");
  ev("sflag " + hidden[0]);
  t.eq(view().left, before - 1, "flagging again removes the flag");
  const revBefore = view().rev;
  ev("sopen " + hidden[1]);
  t.eq(view().rev, revBefore, "a flagged cell is protected from opening");
  ev("sflag " + ev("*&rv"));
  t.eq(view().left, before - 1, "a revealed cell refuses a flag");

  // --- losing ---
  ev("snew[9;9;10;3]"); ev("sopen 40");
  ev("sopen " + ev("*&mn"));
  v = view();
  t.ok(v.dead === 1, "clicking a mine loses");
  t.eq(v.board.split("*").length - 1, 10, "every mine is shown on a loss, including the one just clicked");

  // --- winning ---
  ev("snew[9;9;10;11]"); ev("sopen 40");
  ev("{[i]$[mn i;0;sopen i]}'!N");
  v = view();
  t.ok(v.won === 1 && v.dead === 0, "opening every safe cell wins");
  t.eq(v.rev, 71, "and exactly the 71 safe cells are open");

  // --- the view string ---
  ev("snew[9;9;10;5]"); ev("sopen 40");
  v = view();
  t.ok(v.board.length === v.n && [...v.board].every(ch => ".012345678F*X".includes(ch)),
    "the board is one character per cell, all from the expected set");

  return t.done();
};
