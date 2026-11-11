/* app.js: blackjack.k on a phone.
   The game is the same Amber file the terminal runs, played by the real interpreter (amber.wasm).
   The page reads the file up to the line where the terminal part starts, then talks to it with two
   calls: bjwebinit[save] once, and bjwebkey[key] for each button. Each answers with the frames to
   show (each after a pause, so a deal is dealt card by card), the state the buttons need, and the
   save text when something changed. The buttons send the terminal's keys; the screen draws the
   terminal's frame (42 columns, its ANSI colours) in JetBrains Mono. */
"use strict";
(function () {

const COLS = 42, ROWS = 31;            // the game's phone layout (bjW, bjFH in blackjack.k)
const ADV = 0.6, LH = 1.2;             // JetBrains Mono: a column is 0.6em; the CSS line height
const STORE = "amber-blackjack";
const screen = document.getElementById("screen"), pad = document.getElementById("pad");
let vm = null, busy = false, lastFrame = null, lastState = "";

/* ---- a frame line (with the engine's ANSI codes) as HTML ------------------------------------ */
const FG = { 31: "r", 32: "gr", 33: "y", 34: "bl", 36: "c" };
const VAR = { r: "--red", gr: "--green", y: "--yellow", bl: "--blue", c: "--cyan" };
const GLYPH = /[♠-♧✓✗•▸]/;   // suits, ✓ ✗ • ▸: not in the mono font
function lineHtml(line) {
  let out = "", fg = "", b = 0, d = 0, inv = 0, open = false;
  const reopen = () => {
    if (open) { out += "</span>"; open = false; }
    const c = [fg, b ? "b" : "", d ? "d" : ""].filter(Boolean).join(" ");
    if (!c && !inv) return;
    out += '<span class="' + c + '"' + (inv ? ' style="background:var(' + (VAR[fg] || "--fg") + ');color:var(--bg)"' : "") + ">";
    open = true;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\x1b" && line[i + 1] === "[") {
      let j = i + 2; while (j < line.length && line[j] !== "m") j++;
      for (const p of line.slice(i + 2, j).split(";")) {
        const n = p === "" ? 0 : +p;
        if (n === 0) { fg = ""; b = d = inv = 0; } else if (n === 1) b = 1; else if (n === 2) d = 1; else if (n === 7) inv = 1;
        else if (n === 39) fg = ""; else if (FG[n]) fg = FG[n];
      }
      reopen(); i = j; continue;
    }
    if (GLYPH.test(ch)) out += '<span class="g">' + ch + "︎</span>";          // text, never emoji
    else out += ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
  }
  if (open) out += "</span>";
  return out;
}
function draw(lines) { lastFrame = lines; screen.innerHTML = lines.map(lineHtml).join("\n"); }

/* ---- size: 42 columns fill the width (or 31 rows the height), centred -------------------------- */
function fit() {
  const r = screen.getBoundingClientRect();
  const fs = Math.min(r.width / (COLS * ADV), r.height / (ROWS * LH));
  screen.style.fontSize = fs.toFixed(2) + "px";
  screen.style.paddingLeft = Math.max(0, (r.width - COLS * ADV * fs) / 2).toFixed(1) + "px";
}

/* ---- talking to the game ---------------------------------------------------------------------- */
const kstr = s => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
// a key as a k string; called with brackets, since `f ,"h"` would join rather than call
const kexpr = k => k === "\x1b" ? ",`c$27" : k === "\x7f" ? ",`c$127" : k === "\n" ? ',"\\n"' : (k.length === 1 ? "," : "") + kstr(k);
function call(src) {
  const out = vm.eval(src);
  if (/error\[/.test(out.replace(/\x1b\[[0-9;]*m/g, ""))) console.error(out.replace(/\x1b\[[0-9;]*m/g, ""));
  const frames = []; let cur = null, save = null, st = null;
  for (const line of out.replace(/\n$/, "").split("\n")) {
    const c = line.charCodeAt(0);
    if (c === 1) { cur = { wait: parseFloat(line.slice(1)) || 0, lines: [] }; frames.push(cur); }
    else if (c === 2) { st = line.slice(1); cur = null; }
    else if (c === 3) { save = []; cur = null; }
    else if (save && !cur) save.push(line);
    else if (cur) cur.lines.push(line);
  }
  if (save) { try { localStorage.setItem(STORE, save.join("\n")); } catch (e) {} }
  return { frames, st: st || lastState };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function play(r) {
  busy = true; pad.classList.add("busy");
  for (const f of r.frames) { if (f.wait > 0) await sleep(f.wait * 1000); draw(f.lines); }
  busy = false; pad.classList.remove("busy");
  lastState = r.st; buttons(r.st);
}
function press(k) { if (!vm || busy) return; play(call("bjwebkey[" + kexpr(k) + "]")); }

/* ---- the pad: the terminal's keys for this moment, as buttons ---------------------------------- */
function buttons(s) {
  const [mode, cd, cp, rebet, pair, focus, page, even, pp, t3, sa] = (s || "idle").split("|");
  const B = (label, key, cls, off) => ({ label, key, cls: cls || "", off: !!off });
  const tab = (label, key, p) => B(label, key, "ghost" + (page === p ? " on" : ""));
  const side = (name, key, v) => B(name + (v && v !== "€0" ? " " + v : ""), key, "ghost" + (v && v !== "€0" ? " on" : ""));
  const rows = {
    hand:  [[B("HIT", "h", "", sa === "1"), B("STAND", "s"), B("DOUBLE", "d", "", cd !== "1"), B("SPLIT", "p", "", cp !== "1")],
            [B("HINT", "?", "ghost"), B("CHART", "c", "ghost")]],
    idle:  [[B("REBET " + rebet, "r", "gold"), B("BET", "b")],
            [side("PAIRS", "x", pp), side("21+3", "z", t3), B("TRAIN", "t", "ghost"), B("CHART", "c", "ghost")]],
    broke: [[B("NEW €1,000", "n", "gold")], [B("TRAIN", "t", "ghost"), B("CHART", "c", "ghost")]],
    bet:   [[B("+10", "+10"), B("+25", "+25"), B("+50", "+50"), B("+100", "+100")],
            [B("CLEAR", "0c", "ghost"), B("CANCEL", "\x1b", "ghost"), B("DEAL", "\n", "gold")]],
    ask:   [[B(even === "1" ? "EVEN MONEY" : "INSURANCE", "y", "ghost"), B("NO THANKS", "n")], []],
    train: [[B("HIT", "h"), B("STAND", "s"), B("DOUBLE", "d"), B("SPLIT", "p", "", pair !== "1")],
            [B("FOCUS: " + (focus || "all").toUpperCase(), "f", "ghost"), B("CHART", "c", "ghost"), B("TABLE", "\x1b", "ghost")]],
    chart: [[tab("HARD", "1", "0"), tab("SOFT", "2", "1"), tab("PAIRS", "3", "2")], [B("BACK", "\x1b")]]
  }[mode] || [[], []];
  pad.innerHTML = "";
  for (const row of rows) {
    const div = document.createElement("div"); div.className = "row" + (row.length ? "" : " empty");
    if (!row.length) div.appendChild(document.createElement("button"));
    for (const b of row) {
      const el = document.createElement("button");
      el.textContent = b.label; el.className = b.cls; el.disabled = b.off;
      el.addEventListener("click", () => press(b.key));
      div.appendChild(el);
    }
    pad.appendChild(div);
  }
}

/* ---- a keyboard works too (the terminal's keys) ------------------------------------------------- */
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key === "Escape" ? "\x1b" : e.key === "Enter" ? "\n" : e.key === "Backspace" ? "\x7f" : e.key.length === 1 ? e.key : "";
  if (k) { e.preventDefault(); press(k); }
});

/* ---- start ---------------------------------------------------------------------------------- */
async function boot() {
  try {
    const [bytes, src] = await Promise.all([
      fetch("amber.wasm").then(r => r.arrayBuffer()), fetch("blackjack.k").then(r => r.text())]);
    vm = await new AmberVM().boot(bytes);
    const cut = src.indexOf("/ ==== the terminal starts here");
    for (const st of amberStatements(src.slice(0, cut < 0 ? src.length : cut))) vm.eval(st);
    let save = ""; try { save = localStorage.getItem(STORE) || ""; } catch (e) {}
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    fit();
    play(call("bjwebinit[" + kstr(save) + "]"));
  } catch (e) {
    screen.textContent = "  the engine could not start:\n  " + (e && e.message || e);
  }
}
window.addEventListener("resize", () => { fit(); if (lastFrame) draw(lastFrame); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
fit(); boot();
})();
