// try.js FILE - run a file of Amber lines in the notepad's wasm engine, one fresh engine, printing each result
const fs = require("fs"), path = require("path"), vm = require("vm");
const SITE = path.resolve(__dirname, "../..");
global.self = global; global.atob = (s) => Buffer.from(s, "base64").toString("binary");
vm.runInThisContext(fs.readFileSync(path.join(SITE, "assets/notepad/amber.wasm.js"), "utf8"));
vm.runInThisContext(fs.readFileSync(path.join(SITE, "assets/notepad/amber.js"), "utf8"));
(async () => {
  const a = new self.AmberVM(); await a.boot();
  for (const s of self.amberStatements(fs.readFileSync(process.argv[2], "utf8"))) {
    const o = a.eval(s.code).replace(/\x1b\[[\d;]*m/g, "").trim();
    console.log("> " + s.code.slice(0, 100) + "\n" + o.split("\n").slice(0, 6).join("\n"));
  }
})();
