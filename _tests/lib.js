/* lib.js — the shared harness for the project tests.
 *
 * Every test boots the SAME engine bundle the site serves
 * (assets/notepad/amber.wasm.js) and loads the SAME .k file the page loads,
 * so a test failing here means the page is broken, not that a copy drifted.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RUNTIME = path.join(ROOT, "assets", "notepad");

const ANSI = /\x1b\[[0-9;]*m/g;
const strip = s => String(s == null ? "" : s).replace(ANSI, "");
const NL = String.fromCharCode(10);

let runtimeLoaded = false;
function loadRuntime() {
  if (runtimeLoaded) return;
  global.window = global;
  global.self = global;
  eval(fs.readFileSync(path.join(RUNTIME, "amber.wasm.js"), "utf8"));
  eval(fs.readFileSync(path.join(RUNTIME, "amber.js"), "utf8"));
  runtimeLoaded = true;
}

/* A lambda body containing a newline defines fine and then returns nothing,
 * so every statement is flattened before evaluation -- the same thing the
 * worker and the native REPL do. */
const flatten = code => code.replace(/\n/g, " ");

/* boot("assets/sweep/sweep.k") -> a fresh engine with that file loaded. */
async function boot(kfile) {
  loadRuntime();
  const vm = new global.AmberVM();
  await vm.boot();
  const ev = line => strip(vm.eval(line)).replace(/\n$/, "");
  if (kfile) {
    const src = fs.readFileSync(path.join(ROOT, kfile), "utf8");
    for (const st of global.amberStatements(src)) {
      const out = ev(flatten(st.code));
      if (/error\[/.test(out)) {
        throw new Error(kfile + " line " + st.line + ": " + out.split(NL)[0]);
      }
    }
  }
  return { vm, ev, version: vm.version || "" };
}

/* A matrix prints across several lines; "(1 3\n 2 4)" is the literal (1 3;2 4). */
const oneLine = s => (s.indexOf(NL) < 0 ? s : s.replace(/\n\s*/g, ";"));

/* A very small reporter: every test file returns its failure count. */
function suite(name) {
  let pass = 0, fail = 0;
  console.log(NL + "── " + name);
  return {
    ok(cond, label, detail) {
      if (cond) { pass++; console.log("  ok   " + label); }
      else { fail++; console.log("  FAIL " + label + (detail ? "  — " + detail : "")); }
      return cond;
    },
    eq(got, want, label) {
      return this.ok(String(got) === String(want), label, "got " + JSON.stringify(String(got)) + ", want " + JSON.stringify(String(want)));
    },
    note(msg) { console.log("       " + msg); },
    done() {
      console.log("  " + pass + " passed" + (fail ? ", " + fail + " FAILED" : ""));
      return fail;
    }
  };
}

/* Read a browser file that assigns to window.<name> and hand back the value. */
function readWindowGlobal(file, name) {
  const sandbox = {};
  const code = fs.readFileSync(path.join(ROOT, file), "utf8");
  new Function("window", code)(sandbox);
  return sandbox[name];
}

module.exports = { ROOT, boot, suite, strip, flatten, oneLine, NL, readWindowGlobal };
