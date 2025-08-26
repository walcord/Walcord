#!/usr/bin/env node

const fs = require("fs");

const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.scripts = pkg.scripts || {};
pkg.scripts.inventory = "ts-node scripts/inventory.ts";
pkg.scripts.deadcode = "ts-prune > dead-exports.txt && depcheck --json > depcheck.json";
pkg.scripts.snapshot = "bash scripts/project-snapshot.sh";

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("OK -> package.json actualizado con scripts {inventory, deadcode, snapshot}");
