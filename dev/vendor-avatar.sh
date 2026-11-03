#!/bin/sh
# Rebuild the pinned local renderer. Run from the repository root.
set -eu
bijou_deps=$(mktemp -d)
trap 'rm -rf "$bijou_deps"' EXIT
npm install --prefix "$bijou_deps" --no-audit --no-fund --ignore-scripts three@0.180.0 @pixiv/three-vrm@3.5.5 @pixiv/three-vrm-animation@3.5.5 esbuild@0.25.10
cat > "$bijou_deps/entry.js" <<'EOF'
export * from 'three';
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
export * from '@pixiv/three-vrm';
export { VRMAnimationLoaderPlugin, createVRMAnimationClip, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
EOF
"$bijou_deps/node_modules/.bin/esbuild" "$bijou_deps/entry.js" --bundle --minify --format=esm --legal-comments=eof --outfile=js/vendor/avatar-engine.js
cp "$bijou_deps/node_modules/three/LICENSE" js/vendor/THREE-LICENSE.txt
cp "$bijou_deps/node_modules/@pixiv/three-vrm/LICENSE" js/vendor/THREE-VRM-LICENSE.txt
cp "$bijou_deps/node_modules/@pixiv/three-vrm-animation/LICENSE" js/vendor/THREE-VRM-ANIMATION-LICENSE.txt

# meshoptimizer's decoder, as three ships it, for dev/retarget.html only. It
# compiles WebAssembly as soon as it loads, which index.html's CSP forbids, so
# it is a module of its own and never part of the engine bundle above.
# esbuild drops its plain // notice: the banner keeps the header lines, and
# the licence file takes the copyright line from that same header.
decoder="$bijou_deps/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js"
copyright=$(sed -n 's|^// \(Copyright .*\)$|\1|p' "$decoder")
[ -n "$copyright" ] || { echo "no copyright line in $decoder" >&2; exit 1; }
"$bijou_deps/node_modules/.bin/esbuild" "$decoder" --bundle --minify --format=esm --banner:js="$(sed -n '1,2p' "$decoder")" --outfile=js/vendor/meshopt-decoder.js
{
  printf 'js/vendor/meshopt-decoder.js: the meshoptimizer decoder as three.js ships it.\n\nMIT License\n\n%s\n\n' "$copyright"
  cat <<'EOF'
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
EOF
} > js/vendor/MESHOPTIMIZER-LICENSE.txt
