#!/bin/sh
# Build only the exporter; retain the existing renderer/VRM bundle.
set -eu
bijou_export_deps=$(mktemp -d)
trap 'rm -rf "$bijou_export_deps"' EXIT
npm install --prefix "$bijou_export_deps" --no-audit --no-fund --ignore-scripts three@0.180.0 esbuild@0.25.10
"$bijou_export_deps/node_modules/.bin/esbuild" "$bijou_export_deps/node_modules/three/examples/jsm/exporters/GLTFExporter.js" --bundle --minify --format=esm --legal-comments=eof --external:three --outfile=js/vendor/model-exporter.js
python3 - <<'PY'
from pathlib import Path
path=Path('js/vendor/model-exporter.js')
path.write_text(path.read_text().replace('from"three"','from"./avatar-engine.js"'))
PY
