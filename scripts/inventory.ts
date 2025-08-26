#!/usr/bin/env ts-node

import fs from "fs";
import path from "path";

const roots = ["components", "pages", "app", "lib"];
const exts = [".tsx", ".ts", ".jsx", ".js"];

type Entry = { file: string; exports: string[]; defaultExport?: string | null };

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, acc);
    else if (exts.includes(path.extname(p))) acc.push(p);
  }
  return acc;
}

function parseExports(source: string) {
  const named = new Set<string>();
  let def: string | null | undefined = undefined;

  [...source.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z0-9_]+)/g)]
    .forEach(m => named.add(m[1]));
  [...source.matchAll(/export\s*{\s*([^}]+)\s*}/g)]
    .forEach(m => m[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0].trim()).forEach(n => n && named.add(n)));

  const d1 = source.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
  const d2 = source.match(/export\s+default\s+class\s+([A-Za-z0-9_]+)/);
  const d3 = source.match(/export\s+default\s+([A-Za-z0-9_]+)/);
  def = d1?.[1] || d2?.[1] || d3?.[1] || null;

  return { exports: [...named], defaultExport: def };
}

function main() {
  const files: string[] = [];
  roots.forEach(r => walk(r, files));

  const rows: Entry[] = files.map(file => {
    const src = fs.readFileSync(file, "utf8");
    const { exports, defaultExport } = parseExports(src);
    return { file, exports, defaultExport };
  });

  const out = [
    "# Components & Pages Inventory",
    "",
    "| File | Default Export | Named Exports |",
    "|------|----------------|---------------|",
    ...rows.map(r => `| ${r.file} | ${r.defaultExport ?? ""} | ${r.exports.join(", ")} |`)
  ].join("\n");

  fs.writeFileSync("components-inventory.md", out);
  console.log("OK -> components-inventory.md");
}

main();
