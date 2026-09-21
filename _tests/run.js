#!/usr/bin/env node
/* Run every project test against the engine bundle this repo serves.
 *
 *   node _tests/run.js            all of them
 *   node _tests/run.js golf       just the ones whose name matches
 *
 * Exits non-zero if anything failed, so it can gate a deploy.
 */
"use strict";

const SUITES = [
  ["notepad", "./notepad.test.js"],
  ["dots", "./dots.test.js"],
  ["tape", "./tape.test.js"],
  ["sweep", "./sweep.test.js"],
  ["golf", "./golf.test.js"],
  ["semantics", "./golf.semantics.test.js"],
  ["dh", "./dh.test.js"]
];

(async () => {
  const only = process.argv.slice(2).filter(a => !a.startsWith("-"));
  const chosen = only.length ? SUITES.filter(s => only.some(o => s[0].includes(o))) : SUITES;
  if (!chosen.length) {
    console.log("no suite matched " + JSON.stringify(only) + "; known: " + SUITES.map(s => s[0]).join(", "));
    process.exit(2);
  }

  const started = Date.now();
  let failed = 0;
  for (const [name, mod] of chosen) {
    try {
      failed += await require(mod)();
    } catch (err) {
      failed++;
      console.log("\n── " + name + "\n  FAIL the suite itself threw — " + (err && err.message ? err.message : err));
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log("\n" + (failed ? failed + " FAILURE" + (failed === 1 ? "" : "S") : "all suites passed") +
              " in " + secs + "s");
  process.exit(failed ? 1 : 0);
})();
