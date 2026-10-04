// Checks every Pillow Talk pack listed in the manifest.
// Run from the repo root:  node Data/07.pillowtalk.validate.js
const fs = require("fs"), path = require("path");
const dir = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "07.pillowtalk.manifest.json"), "utf8"));
const TYPES = ["scale", "self", "who", "pick"];
const seen = new Map(); let bad = 0, good = 0;
const fail = (m) => { bad++; console.log("  x " + m); };
for (const file of manifest.packs) {
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
console.log(bad ? "\n" + bad + " problem(s), " + good + " good cards" : "\nAll good: " + good + " cards across " + manifest.packs.length + " pack(s)");
process.exit(bad ? 1 : 0);
