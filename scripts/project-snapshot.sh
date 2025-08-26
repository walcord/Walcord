#!/usr/bin/env bash
set -euo pipefail

OUT="walcord_snapshot_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT"

# 1) Manifiestos y configs
cp package.json "$OUT"/ || true
[ -f pnpm-lock.yaml ] && cp pnpm-lock.yaml "$OUT"/ || true
[ -f package-lock.json ] && cp package-lock.json "$OUT"/ || true
[ -f yarn.lock ] && cp yarn.lock "$OUT"/ || true
[ -f next.config.js ] && cp next.config.js "$OUT"/ || true
[ -f next.config.mjs ] && cp next.config.mjs "$OUT"/ || true
[ -f tsconfig.json ] && cp tsconfig.json "$OUT"/ || true
[ -f .eslintrc.json ] && cp .eslintrc.json "$OUT"/ || true
[ -f .prettierrc ] && cp .prettierrc "$OUT"/ || true
[ -f .env.local ] && cp .env.local "$OUT"/.env.local.SAMPLE || true

# 2) Reportes
[ -f components-inventory.md ] && cp components-inventory.md "$OUT"/ || true
[ -f dead-exports.txt ] && cp dead-exports.txt "$OUT"/ || true
[ -f depcheck.json ] && cp depcheck.json "$OUT"/ || true
[ -f imports-graph.json ] && cp imports-graph.json "$OUT"/ || true
[ -f pages-routes.md ] && cp pages-routes.md "$OUT"/ || true

# 3) Código fuente principal (solo directorios que EXISTAN)
SRC_DIRS=("components" "pages" "app" "lib" "public" "styles")
EXISTING=()
for d in "${SRC_DIRS[@]}"; do
  [ -d "$d" ] && EXISTING+=("$d")
done

if [ ${#EXISTING[@]} -gt 0 ]; then
  tar -czf "$OUT/code.tar.gz" "${EXISTING[@]}"
else
  echo "Aviso: no se encontró ningún directorio de código en ${SRC_DIRS[*]}"
fi

# 4) Supabase artefactos (si existen)
mkdir -p "$OUT/supabase"
[ -f supabase/schema.sql ] && cp supabase/schema.sql "$OUT/supabase"/ || true
[ -f supabase/types.ts ] && cp supabase/types.ts "$OUT/supabase"/ || true
[ -f supabase/storage_buckets.csv ] && cp supabase/storage_buckets.csv "$OUT/supabase"/ || true
[ -f supabase/seed_minimal.sql ] && cp supabase/seed_minimal.sql "$OUT/supabase"/ || true

# 5) Empaquetar
zip -r "$OUT.zip" "$OUT" >/dev/null
echo "Listo -> $OUT.zip"
