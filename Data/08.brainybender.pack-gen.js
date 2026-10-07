#!/usr/bin/env node
// Brainy Bender pack generator + validator
// Run from the repo root:  node Data/08.brainybender.pack-gen.js
// Scans Data/08.brainybender.pack.*.json, validates every card,
// and writes Data/08.brainybender.manifest.json (auto-generated, never edit).
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => /^08\.brainybender\.pack\..+\.json$/.test(f))
  .sort();

let errors = 0;
const seen = new Map();
const packs = [];

for (const f of files) {
  let pack;
  try { pack = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
  catch (e) { console.log(f + "\n  x invalid JSON: " + e.message); errors++; continue; }

  const bad = [];
  if (!pack.id || typeof pack.id !== "string") bad.push("pack needs a string 'id'");
  if (!pack.title || typeof pack.title !== "string") bad.push("pack needs a string 'title'");
  if (!Array.isArray(pack.cards) || !pack.cards.length) bad.push("pack needs a non-empty 'cards' array");

  (pack.cards || []).forEach((c, i) => {
    const n = "card #" + (i + 1);
    if (!c || typeof c.q !== "string" || c.q.trim().length < 5) { bad.push(n + ": 'q' must be a string of 5+ chars"); return; }
    if (typeof c.a !== "string" || !c.a.trim()) bad.push(n + ": 'a' (correct answer) is required");
    if (!Array.isArray(c.wrong) || c.wrong.length !== 3 || c.wrong.some(w => typeof w !== "string" || !w.trim()))
      bad.push(n + ": 'wrong' must be exactly 3 non-empty strings");
    else if (c.wrong.includes(c.a)) bad.push(n + ": the correct answer also appears in 'wrong'");
    else if (new Set([c.a, ...c.wrong]).size !== 4) bad.push(n + ": answers must all be different");
    if (c.why !== undefined && typeof c.why !== "string") bad.push(n + ": 'why' must be a string");
    if (c.cat !== undefined && (typeof c.cat !== "string" || !c.cat.trim())) bad.push(n + ": 'cat' must be a non-empty string");
    const key = c.q.trim().toLowerCase();
    if (seen.has(key)) bad.push(n + ": duplicate question, first used in " + seen.get(key));
    else seen.set(key, f);
  });

  if (bad.length) { console.log(f); bad.forEach(b => console.log("  x " + b)); errors += bad.length; }
  else packs.push({ file: f, id: pack.id, title: pack.title, count: pack.cards.length });
}

if (errors) { console.log("\n" + errors + " problem(s). Manifest NOT written."); process.exit(1); }

const manifest = { generated: new Date().toISOString(), packs };
fs.writeFileSync(path.join(dir, "08.brainybender.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const total = packs.reduce((s, p) => s + p.count, 0);
console.log("OK: " + packs.length + " pack(s), " + total + " questions -> 08.brainybender.manifest.json");
