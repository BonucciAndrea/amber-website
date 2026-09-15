/* amber.js — browser runtime for the Amber array language (the real C interpreter → wasm32).
   Provides AmberVM (instantiate + eval + read bundled examples) and AMBER_EXAMPLES.
   Runs on a page or inside a Web Worker; the .wasm is embedded as base64 by amber.wasm.js. */
(function (global) {
"use strict";

// ---- example catalog (files are embedded in the wasm virtual FS) ----------
const EXAMPLES = [
  ["basics.k", "A two-minute tour: aggregations, tables, group-by, sorted attributes."],
  ["tour.k", "A worked example of (nearly) every Amber function."],
  ["practice.k", "Practice snippets across the core vocabulary."],
  ["extended.k", "Extended vocabulary and idioms."],
  ["attributes.k", "Column attributes and how they speed up search."],
  ["graphs.k", "Terminal graphing: braille line charts, candlesticks, multi-series."],
  ["hft.k", "High-frequency-trading style tick analytics."],
  ["tick.k", "Realistic intraday trades and quotes, kdb+/tick style."],
  ["wj.k", "Window join: summarise prevailing quotes around each trade."],
  ["peach.k", "Parallel-each demo (runs sequentially in the browser sandbox)."],
  ["bench.k", "Micro-benchmarks of core operations."],
  ["test.k", "The interpreter's own test suite."]
];

// amber_eval() prints a line through `wprint(. qrw "...")`; when the line itself fails,
// the wrapper reports a second, confusing error about that wrapper. Keep only the real one.
function dropWrapperErrors(text) {
  const blocks = text.split(/(?=^(?:\x1b\[[\d;]*m)*error\[)/m);
  if (blocks.length < 2) return text;
  const kept = blocks.filter(b => !/wprint\(\. qrw /.test(b.replace(/\x1b\[[\d;]*m/g, "")));
  return kept.length ? kept.join("") : text;
}

// ---- the VM -----------------------------------------------------------------
// ABI (matches src/amber_wasm.c in the C engine 1:1):
//   amber_init()    - kinit() + loads the stdlib modules, same as the native REPL.
//   amber_inbuf()   - scratch buffer pointer for the next line/filename.
//   amber_eval()    - evaluate the NUL-terminated line at amber_inbuf(); backslash
//                     commands (\ast, \disasm, \t, ...) work as in the native REPL.
//   amber_load()    - run an embedded file from the wasm's baked-in filesystem.
//   amber_read()    - return an embedded file's source without running it.
//   amber_version() - the interpreter version string.
class AmberVM {
  constructor() { this.ready = false; this._out = []; this.version = ""; }

  async boot() {
    const bin = Uint8Array.from(atob(global.AMBER_WASM_B64), c => c.charCodeAt(0));
    const dec = new TextDecoder(), enc = new TextEncoder();
    this._enc = enc; this._dec = dec;
    const freeList = new Map();
    let mem, heap;
    const u8 = () => new Uint8Array(mem.buffer);
    const self = this;
    const env = {
      js_alloc: (n) => { n = (n + 4095) & ~4095; const f = freeList.get(n);
        if (f && f.length) return f.pop();
        if (heap + n > mem.buffer.byteLength) mem.grow(Math.ceil((heap + n - mem.buffer.byteLength) / 65536) + 64);
        const p = heap; heap += n; return p; },
      js_free: (p, n) => { n = (n + 4095) & ~4095; let f = freeList.get(n); if (!f) { f = []; freeList.set(n, f); } f.push(p); },
      js_out: (p, n) => { self._out.push(dec.decode(u8().slice(p, p + n))); },
      js_log: () => {},
      js_in: () => 0,
      js_time: (s, u) => { const t = Date.now(); const dv = new DataView(mem.buffer);
        dv.setInt32(s, (t/1000)|0, true); dv.setInt32(u, (t%1000)*1000, true); },
      js_exit: () => {},
      js_eval: () => 0,
      sin: Math.sin, cos: Math.cos, log: Math.log, exp: Math.exp
    };
    const { instance } = await WebAssembly.instantiate(bin, { env });
    this.ex = instance.exports; mem = this.ex.memory; heap = this.ex.__heap_base.value;
    this._u8 = u8;
    this._out = [];
    this.ex.amber_init();
    this.banner = this._out.join("");
    if (this.ex.amber_version) this.version = this._cstr(this.ex.amber_version()).trim();
    this.ready = true;
  }

  _cstr(p) {
    const u = this._u8();
    let end = p; while (u[end] !== 0) end++;
    return this._dec.decode(u.slice(p, end));
  }

  _writeIn(s) {
    const b = this._enc.encode(s), p = this.ex.amber_inbuf(), u = this._u8();
    u.set(b, p); u[p + b.length] = 0;
  }

  // evaluate one line of Amber, return raw output (may contain ANSI)
  eval(line) {
    this._out = []; this._writeIn(line);
    try { this.ex.amber_eval(); } catch (e) { return "\x1b[31mruntime error: " + e.message + "\x1b[0m\n"; }
    return dropWrapperErrors(this._out.join(""));
  }

  // run a whole embedded file (e.g. an example) via the C loader
  load(name) {
    this._out = []; this._writeIn(name);
    try { this.ex.amber_load(); } catch (e) { return "\x1b[31mruntime error: " + e.message + "\x1b[0m\n"; }
    return this._out.join("");
  }

  // read an embedded file's source WITHOUT running it
  readFile(name) {
    this._writeIn(name);
    return this._cstr(this.ex.amber_read());
  }
}

global.AmberVM = AmberVM;
global.AMBER_EXAMPLES = EXAMPLES;
})(typeof window !== "undefined" ? window : self);
