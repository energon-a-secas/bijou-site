#!/bin/sh
# Rebuild the pinned local renderer. Run from the repository root.
set -eu
bijou_deps=$(mktemp -d)
trap 'rm -rf "$bijou_deps"' EXIT
npm install --prefix "$bijou_deps" --no-audit --no-fund three@0.180.0 @pixiv/three-vrm@3.4.2 esbuild@0.25.10
cat > "$bijou_deps/entry.js" <<'EOF'
export * from 'three';
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
EOF
"$bijou_deps/node_modules/.bin/esbuild" "$bijou_deps/entry.js" --bundle --minify --format=esm --legal-comments=eof --outfile=js/vendor/avatar-engine.js
cp "$bijou_deps/node_modules/three/LICENSE" js/vendor/THREE-LICENSE.txt
cp "$bijou_deps/node_modules/@pixiv/three-vrm/LICENSE" js/vendor/THREE-VRM-LICENSE.txt
