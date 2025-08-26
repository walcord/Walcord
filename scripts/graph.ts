#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";

const roots = ["components", "pages", "app", "lib"];
const valid = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walk(dir: string, acc: string[] = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (valid.has(path.extname(p))) acc.push(p);
  }
  return acc;
}

const files: string[] = [];
roots.forEach(r => walk(r, files));

type Edge = { from: string; to: string };

const edges: Edge[] = [];
const importRe = /import\s+[^'"]*from\s+['"]([^'"]+)['"]/g;

function norm(p: string) {
  // Normaliza imports relativos a ruta real
  if (!p.startsWith(".")) return p; // librería externa
  return p.replace(/\\/g, "/");
}

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(src))) {
    const raw = m[1];
    const n = norm(raw);
    if (n.startsWith(".")) {
      // resolver a path real
      const base = path.resolve(dir, n);
      const cand = ["", ".ts", ".tsx", ".js", ".jsx", "/index.tsx", "/index.ts", "/index.js", "/index.jsx"]
        .map(ext => (ext ? base + ext : base));
      const found = cand.find(f => fs.existsSync(f));
      if (found) {
        edges.push({ from: file, to: path.relative(process.cwd(), found) });
      }
    } else {
      edges.push({ from: file, to: `#pkg:${n}` });
    }
  }
}

const out = { nodes: Array.from(new Set([...files, ...edges.map(e => e.to)])), edges };
fs.writeFileSync("imports-graph.json", JSON.stringify(out, null, 2));
console.log("OK -> imports-graph.json");
