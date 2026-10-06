// eval.js - run Amber snippets the way the notepad does, in the notepad's own wasm engine.
// stdin: JSON [{id, code}]; stdout: JSON [{id, ok, why, out}]. Each snippet gets a fresh engine (as each notepad run
// does) in a worker, so a snippet that never finishes is stopped after TIMEOUT ms and counted as failing.
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const fs = require("fs"), path = require("path"), vm = require("vm");
const SITE = path.resolve(__dirname, "../..");
const TIMEOUT = 20000;
// the notepad marks a result as an error the same way (notepad.html, addCell)
const ERR = /(^|\n)\s*(error\[|runtime error|'\w)/;

if (!isMainThread) {
  global.self = global; global.atob = (s) => Buffer.from(s, "base64").toString("binary");
  vm.runInThisContext(fs.readFileSync(path.join(SITE, "assets/notepad/amber.wasm.js"), "utf8"));
  vm.runInThisContext(fs.readFileSync(path.join(SITE, "assets/notepad/amber.js"), "utf8"));
  (async () => {
    const amber = new self.AmberVM(); await amber.boot();
    let out = "", bad = "";
    for (const s of self.amberStatements(workerData.code)) {
      const o = amber.eval(s.code), p = o.replace(/\x1b\[[\d;]*m/g, "");
      out += p;
      if (!bad && ERR.test(p)) bad = "line " + s.line + ": " + p.trim().split("\n").slice(0, 3).join(" | ").slice(0, 200);
    }
    parentPort.postMessage({ ok: !bad, why: bad, out: out.slice(0, 2000) });
  })().catch((e) => parentPort.postMessage({ ok: false, why: "crash: " + e.message, out: "" }));
} else {
  const items = JSON.parse(fs.readFileSync(0, "utf8"));
  const res = [];
  const one = (it) => new Promise((done) => {
    const w = new Worker(__filename, { workerData: { code: it.code } });
    const t = setTimeout(() => { w.terminate(); done({ id: it.id, ok: false, why: "timeout", out: "" }); }, TIMEOUT);
    w.on("message", (m) => { clearTimeout(t); w.terminate(); done(Object.assign({ id: it.id }, m)); });
    w.on("error", (e) => { clearTimeout(t); done({ id: it.id, ok: false, why: "crash: " + e.message, out: "" }); });
  });
  (async () => {
    const N = 6;   // a few engines at a time
    for (let i = 0; i < items.length; i += N) res.push(...(await Promise.all(items.slice(i, i + N).map(one))));
    process.stdout.write(JSON.stringify(res));
  })();
}
