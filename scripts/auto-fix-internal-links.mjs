import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

// 👈 ESM: la función real está en .default
const traverse = traverseModule.default;

const roots = ["pages", "components"];
const exts = new Set([".js", ".jsx", ".ts", ".tsx"]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (exts.has(path.extname(p))) acc.push(p);
  }
  return acc;
}

function ensureLinkImport(ast) {
  const hasLink = ast.program.body.some(
    n => t.isImportDeclaration(n) && n.source.value === "next/link"
  );
  if (!hasLink) {
    ast.program.body.unshift(
      t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier("Link"))],
        t.stringLiteral("next/link")
      )
    );
  }
}

function isInternalHref(attr) {
  if (!attr || attr.name?.name !== "href") return false;
  const val = attr.value;
  let s = null;
  if (t.isStringLiteral(val)) s = val.value;
  if (t.isJSXExpressionContainer(val) && t.isStringLiteral(val.expression)) {
    s = val.expression.value;
  }
  // Sólo rutas internas absolutas (/algo). Ignora http:, mailto:, #, etc.
  return typeof s === "string" && s.startsWith("/") && !s.startsWith("//");
}

function execFile(file) {
  const src = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(src, { sourceType: "module", plugins: ["jsx", "typescript"] });
  } catch {
    return { file, changed: false };
  }

  let changed = false;

  traverse(ast, {
    JSXElement(pathEl) {
      const open = pathEl.node.openingElement;
      if (!t.isJSXIdentifier(open.name, { name: "a" })) return;

      const hrefAttr = open.attributes.find(
        a => t.isJSXAttribute(a) && a.name?.name === "href"
      );
      if (!isInternalHref(hrefAttr)) return;

      // Cambiar <a> -> <Link>
      open.name = t.jsxIdentifier("Link");
      if (pathEl.node.closingElement) {
        pathEl.node.closingElement.name = t.jsxIdentifier("Link");
      }
      changed = true;
    },
  });

  if (changed) {
    ensureLinkImport(ast);
    const out = generate(ast, { jsescOption: { minimal: true } }, src).code;
    fs.writeFileSync(file, out);
  }
  return { file, changed };
}

// Run
const files = roots.flatMap(r => walk(r));
let count = 0;
for (const f of files) {
  const { changed } = execFile(f);
  if (changed) {
    count++;
    console.log("FIXED:", f);
  }
}
console.log(`Done. Files changed: ${count}`);
