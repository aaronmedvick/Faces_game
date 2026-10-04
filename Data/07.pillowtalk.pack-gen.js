#!/usr/bin/env node
// Generates 07.pillowtalk.manifest.json by scanning for all 07.pillowtalk.pack.*.json files.
// Run from the repo root: node data/07.pillowtalk.pack-gen.js
// This auto-discovers packs, so you never edit the manifest manually.
const fs = require("fs"), path = require("path");
const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => /^07\.pillowtalk\.pack\..+\.json$/.test(f)).sort();
if (!files.length) { console.warn("No packs found (expect 07.pillowtalk.pack.*.json)"); process.exit(1); }
const TYPES = ["scale", "self", "who", "pick"];
const seen = new Map(); let bad = 0, good = 0;
const fail = (m) => { bad++; console.log("  x " + m); };
const manifest = { version: 1, packs: files };
for (const file of files) {
  console.log(file);
  let pack;
  try { pack = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")); }
  catch (e) { fail("cannot read/parse: " + e.message); continue; }
  if (!Array.isArray(pack.cards)) { fail("missing cards array"); continue; }
  const heat = [0, 0, 0, 0];
  pack.cards.forEach((c, i) => {
    const w = "card #" + (i + 1) + (c && c.id ? " (" + c.id + ")" : "");
    if (!c || typeof c.id !== "string" || !c.id) return fail(w + ": needs a string id");
    if (seen.has(c.id)) return fail(w + ": duplicate id, first used in " + seen.get(c.id));
    if (![1, 2, 3].includes(c.h)) return fail(w + ": h must be 1, 2 or 3");
    if (!TYPES.includes(c.t)) return fail(w + ": t must be one of " + TYPES.join(", "));
    if (typeof c.q !== "string" || c.q.trim().length < 5) return fail(w + ": q is missing or too short");
    if (c.t === "pick" && !(Array.isArray(c.o) && c.o.length >= 2 && c.o.length <= 6 && c.o.every(x => typeof x === "string" && x)))
      return fail(w + ": pick cards need o with 2-6 strings");
    if (c.t !== "pick" && c.o) return fail(w + ": only pick cards take o");
    seen.set(c.id, file); heat[c.h]++; good++;
  });
  console.log("  ok " + pack.cards.length + " cards  (sweet " + heat[1] + ", flirty " + heat[2] + ", spicy " + heat[3] + ")");
}
fs.writeFileSync(path.join(dir, "07.pillowtalk.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(bad ? "\n" + bad + " problem(s)" : "\nManifest generated: " + good + " total cards");
process.exit(bad ? 1 : 0);
