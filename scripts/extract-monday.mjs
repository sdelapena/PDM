// One-off: converts the monday.com rows embedded in the mockup into prisma/monday.json.
// Usage: node scripts/extract-monday.mjs <path to Main.dc.html>
import { readFileSync, writeFileSync } from "node:fs";

const line = readFileSync(process.argv[2], "utf8").split("\n").find((l) => l.startsWith("var DATA="));
const DATA = JSON.parse(line.replace(/^var DATA=/, "").replace(/;\s*$/, ""));
// Mockup step index -> column of the old monday.com board (index 19 was the removed PO step).
const MAP = [null, null, null, null, null, 0, 2, null, null, null, null, null, 4, 5, 11, 6, null, 12, null, 8, 9, 10, 13, null, null, 14, 15, null, null, 16, 17, 18];
const LB = { TL5370: "Gerardo", TL5358: "Gerardo", TL5371: "Gerardo", TL5359: "Paul" };

const out = DATA.map((d) => {
  const steps = {};
  const notes = [];
  MAP.forEach((m, i) => {
    if (i === 19) return;
    const no = i < 19 ? i + 1 : i;
    let code = "S";
    let note = "";
    if (i === 0) code = "A";
    else if (m !== null) {
      code = d[6][m][0] === "X" ? "S" : d[6][m][0];
      note = d[6][m][1];
    }
    if (code !== "S") steps[no] = code;
    if (note) notes.push({ stepNo: no, text: note });
  });
  return { factory: d[0], pdNumber: d[1], collection: d[2], price: d[3], po: d[4], firstPoDate: d[5], lineBuilder: LB[d[1]] || null, steps, notes };
});
writeFileSync("prisma/monday.json", JSON.stringify(out, null, 1));
console.log(out.length, "styles");
