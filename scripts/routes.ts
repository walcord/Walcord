#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";

const pagesRoot = "pages"; // (si usas App Router, añade también "app")
const exts = new Set([".tsx", ".ts", ".jsx", ".js"]);

function walk(dir: string, acc: string[] = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (exts.has(path.extname(p))) acc.push(p);
  }
  return acc;
}

function toRoute(p: string) {
  let r = p.replace(/^pages/, "");
  r = r.replace(/index\.(tsx|ts|jsx|js)$/, "");
  r = r.replace(/\.(tsx|ts|jsx|js)$/, "");
  if (!r.startsWith("/")) r = "/" + r;
  if (r === "") r = "/";
  return r || "/";
}

const files = walk(pagesRoot, []);
const rows = files.map(f => ({ file: f, route: toRoute(f) }));

const md =
  "# Next.js Routes\n\n| Route | File |\n|---|---|\n" +
  rows.map(r => `| \`${r.route}\` | \`${r.file}\` |`).join("\n");

fs.writeFileSync("pages-routes.md", md);
console.log("OK -> pages-routes.md");
