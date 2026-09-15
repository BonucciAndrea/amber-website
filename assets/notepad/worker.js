/* worker.js — hosts the Amber engine off the main thread, so a long computation never
   freezes the page and a runaway expression can be stopped by terminating the worker. */
importScripts("amber.wasm.js?v=2.1.0", "amber.js?v=3");

const vm = new AmberVM();
const booted = vm.boot().then(
  () => postMessage({ type: "ready", version: vm.version, banner: vm.banner }),
  (err) => postMessage({ type: "fatal", message: String((err && err.message) || err) })
);

onmessage = async (e) => {
  const m = e.data;
  await booted;
  if (!vm.ready) return;
  if (m.type === "eval") {
    for (const line of m.lines) {
      const t0 = performance.now();
      const out = vm.eval(line);
      postMessage({ type: "result", run: m.run, line, out, ms: performance.now() - t0 });
    }
    postMessage({ type: "done", run: m.run });
  } else if (m.type === "read") {
    let src = "";
    try { src = vm.readFile(m.name); } catch (_) { src = ""; }
    postMessage({ type: "file", name: m.name, src });
  }
};
