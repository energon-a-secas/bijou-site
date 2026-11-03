# Character assets

`models/bijou.vrm` derives from pixiv's **Victoria Rubin / β Ver AvatarSample_4**,
released under **CC0 1.0**. The original mesh, rig, morph targets and textures are
used as the base for Bijou's runtime hair, palette, outfit and pose adaptations.

- Author and license: https://vroid.pixiv.help/hc/ja/articles/360014900233
- CC0: https://creativecommons.org/publicdomain/zero/1.0/
- Source file: https://github.com/madjin/vrm-samples/blob/master/vroid/beta/Victoria_Rubin.vrm
- Source file SHA-256 is recorded by `dev/prepare-model.py` during preparation.

The model's embedded metadata declares CC0. This is the older CC0 model, not
the newer VRoidPreset A–Z assets, which have different conditions of use.
The embedded thumbnail and unused source maps are omitted from the optimized
file; active texture maps are resized for the web. The source clothing, shoes,
ribbon, and tied back hair primitives are removed. The fitted scalp and bangs
remain, with procedural hair and wardrobe pieces added by the application.
No user reference images are
redistributed with the site.

Model Studio's corrective Hime head also uses this same CC0 asset: face, iris,
lash, scalp and source fringe surfaces, with runtime coordinate conversion,
palette changes and the authored blink shapes. It does not introduce another
third-party face model. The original Game heroine source face is retained.

## Meshy evaluation assets

`studies/meshy-hime-v1/` contains an original adult reference generated with the
built-in image_gen tool and the resulting Meshy generation, remesh and rigging
outputs. These are development studies, separate from the CC0 source above, and
are not loaded by the companion. The [study record](studies/meshy-hime-v1/README.md)
contains the prompt, provenance, hashes, costs and limitations. No supplied user
reference files or API credentials are included.

`studies/meshy-hime-t2/` is a second generation and rig from that same original
reference, using Meshy T2. [Its study record](studies/meshy-hime-t2/README.md)
contains provenance, costs and audit results. Both candidates are available in
the separate model studio; they have not replaced the companion's CC0 asset.

The studio's Game heroine face is a local geometric interpretation of the
user-requested [Tifa Lockhart / FFVII Remake reference](https://www.jp.square-enix.com/ffviir_ig/character/tifa.html).
The official illustration was inspected for proportions; no Square Enix images,
models, textures or animation files are served with the site. The fitted clothing
geometry and textile patterns are procedural project code.

# Rendering dependencies

`js/vendor/avatar-engine.js` is a pinned, local ESM bundle of:

- Three.js **0.180.0**, MIT; `js/vendor/THREE-LICENSE.txt`, including the
  GLTFLoader, OrbitControls and SkeletonUtils addons.
- @pixiv/three-vrm **3.5.5**, MIT; `js/vendor/THREE-VRM-LICENSE.txt`.
- @pixiv/three-vrm-animation **3.5.5**, MIT (VRMA loading and clips);
  `js/vendor/THREE-VRM-ANIMATION-LICENSE.txt`.

Bundled with esbuild 0.25.10; no runtime CDN or build step is required.
`dev/vendor-avatar.sh` documents the reproducible bundle command. The script
also builds `js/vendor/meshopt-decoder.js`, meshoptimizer's decoder as
Three.js 0.180.0 ships it (MIT, Copyright (C) 2016-2024 Arseny Kapoulkine;
`js/vendor/MESHOPTIMIZER-LICENSE.txt`), for meshopt-compressed GLBs in
`dev/retarget.html` only. It compiles WebAssembly as it loads, which the
companion's CSP forbids, so it is never part of `avatar-engine.js`. Neither
file exists until the script next runs.

`js/vendor/model-exporter.js` bundles the Three.js **0.180.0 GLTFExporter** (MIT,
same `THREE-LICENSE.txt`), importing the existing renderer rather than another
Three instance. Rebuild with `sh dev/vendor-model-exporter.sh`.

# Ported code

- `js/vrm-bone-maps.js`: the Mixamo bone map is ported from three-vrm's `examples/humanoidAnimation/mixamoVRMRigMap.js` (v3.5.5), Copyright (c) 2019-2026 pixiv Inc., MIT, with its notice kept in the file header.

# Adding a bundled model or motion

Every model, clip, texture or other asset committed under `assets/` gets an
entry here in the same commit, in the shape below. `dev/` and `assets/` are
public on Pages, so committing a file redistributes it. A file that cannot fill
in every line (no verbatim licence text, terms that forbid redistribution, an
unknown origin) stays on the owner's disk and is tested from there in
`dev/lab.html` or `dev/retarget.html`; pixiv's VRMA pack and Mixamo clips are
always in that group. Folders that hold third-party files carry a `NOTICE.md`
saying so (see `models/NOTICE.md`).

```markdown
## `assets/<folder>/<file>`

- **Source:** <the creator's own page, not a mirror>; download <file name>
- **Author:** <as the creator credits themselves>
- **Licence:** <name, with a link>, quoted verbatim from the source page or
  the licence file inside the download:
  > "<the sentence that grants the use>"
- **Read on:** <YYYY-MM-DD, the day that text was read>
- **SHA-256:** <of the file as downloaded> (download); <of the committed file> (committed)
- **Changes:** <converted with dev/retarget.html (bone map, options), retimed,
  trimmed, renamed, re-exported; or "none">
- **Credit:** <the attribution the licence asks for, or "not required">
- **Content check:** <for a model: the owner's adults-only judgment, and its date>
```
