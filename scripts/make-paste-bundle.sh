#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="WALCORD_PASTE_${STAMP}.md"

# helper para añadir secciones con título + fence
append_section () {
  local title="$1"; shift
  local file="$1"; shift || true
  {
    echo ""
    echo "# ---- ${title} ----"
    echo '```'$( [ "${file##*.}" = "json" ] && echo "json" || { [ "${file##*.}" = "md" ] && echo "md" || echo ; } )
    if [ -n "${file:-}" ] && [ -f "$file" ]; then
      cat "$file"
    else
      # si es un comando, ejecútalo; si es texto, imprímelo
      if command -v "$file" >/dev/null 2>&1; then
        "$file"
      else
        echo "$file"
      fi
    fi
    echo '```'
    echo ""
  } >> "$OUT"
}

# 0) Cabecera
{
  echo "# WALCORD TEXT BUNDLE (${STAMP})"
  echo "> Solo texto. No incluye secretos ni binarios."
  echo ""
} > "$OUT"

# 1) Árbol del proyecto (sin node_modules ni .next)
echo "# ---- PROJECT TREE ----" >> "$OUT"
echo '```' >> "$OUT"
find . -maxdepth 3 -type d \( -name node_modules -o -name .next -o -name .git \) -prune -false -o \
  -type f -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" \
  -not -name "*.map" -not -name "*.lock" -not -name "*.log" -not -name ".env*" \
  | sort >> "$OUT"
echo '```' >> "$OUT"
echo "" >> "$OUT"

# 2) package.json (para entender scripts/config)
[ -f package.json ] && append_section "package.json" "package.json" || true

# 3) tsconfig.json (para ts-prune/paths)
[ -f tsconfig.json ] && append_section "tsconfig.json" "tsconfig.json" || true

# 4) next.config (si existe)
[ -f next.config.js ] && append_section "next.config.js" "next.config.js" || true
[ -f next.config.mjs ] && append_section "next.config.mjs" "next.config.mjs" || true

# 5) Inventarios/reportes CLAVE
[ -f components-inventory.md ] && append_section "components-inventory.md" "components-inventory.md" || true
[ -f imports-graph.json ] && append_section "imports-graph.json" "imports-graph.json" || true
[ -f pages-routes.md ] && append_section "pages-routes.md" "pages-routes.md" || true
[ -f dead-exports.txt ] && append_section "dead-exports.txt" "dead-exports.txt" || true
[ -f depcheck.json ] && append_section "depcheck.json" "depcheck.json" || true

# 6) Supabase (opcional si existen)
[ -f supabase/schema.sql ] && append_section "supabase/schema.sql" "supabase/schema.sql" || true
[ -f supabase/types.ts ] && append_section "supabase/types.ts" "supabase/types.ts" || true

# 7) Recordatorio
{
  echo ""
  echo "> FIN DEL BUNDLE. Pega este archivo en el chat (si es grande, divídelo con 'split')."
} >> "$OUT"

echo "Listo -> $OUT"
