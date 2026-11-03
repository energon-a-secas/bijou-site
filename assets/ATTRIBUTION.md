# Character assets

`models/bijou.vrm` derives from pixiv's **Victoria Rubin / β Ver AvatarSample_4**,
released under **CC0 1.0**. The original mesh, rig, morph targets and textures are
used as the base for Bijou's runtime hair, palette, outfit and pose adaptations.
This is the older CC0 model, not the newer VRoidPreset A–Z assets, which have
different conditions of use. No user reference images are redistributed with
the site.

## `assets/models/bijou.vrm`

- **Source:** pixiv's article https://vroid.pixiv.help/hc/ja/articles/360014900233;
  the file was downloaded as `Victoria_Rubin.vrm` from the mirror
  https://github.com/madjin/vrm-samples/blob/master/vroid/beta/Victoria_Rubin.vrm
- **Author:** pixiv (β Ver AvatarSample_4, "Victoria Rubin")
- **Licence:** CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), as
  the file's embedded VRM 0.x metadata declares, quoted verbatim from
  `extensions.VRM.meta` (`dev/prepare-model.py` asserts it on the source and
  changes only `texture` in that block):
  > "licenseName": "CC0"

  pixiv's Japanese article adds that using the VRM requires agreeing to the
  VRoid Hub Terms, a sentence the English pages drop; it is quoted in
  `docs/research/2026-11-03-complete-model-memo.md`, and whether it binds a
  mirror copy is open (`docs/MODELS-AND-MOTION.md`).
- **Read on:** 2026-11-03 for the embedded metadata (from the committed file)
  and for pixiv's added sentence (the research memo). pixiv's own CC0 wording
  was not recorded when the model was added.
- **SHA-256:** b1372131bdbf233f46320146d565f342a7e4f6f4b8f2aefb301f1a283ec07e1e
  (download, as `dev/prepare-model.py` records it in the file's
  `asset.extras.sourceSha256`);
  ef686c0f35b9896c9b82f810ed6ece3a1bc675af80044608e0ff399162fcf91f (committed)
- **Changes:** by `dev/prepare-model.py`: the embedded thumbnail and unused
  source maps are omitted and active texture maps are resized for the web; the
  source clothing, shoes, ribbon and tied back hair primitives are removed. The
  fitted scalp and bangs remain, with procedural hair and wardrobe pieces added
  by the application.
- **Credit:** not required (CC0)
- **Content check:** not recorded. No age is stated; the model is the stand-in
  for model-agnostic work only (`docs/MODELS-AND-MOTION.md`).

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

- `js/spring-damper.js` ports the exact spring-damper from Daniel Holden's [Spring-It-On](https://github.com/orangeduck/Spring-It-On) (`common.h` at commit 4d97b49), MIT, Copyright (c) 2021 Daniel Holden; the notice is in the file header.
- `js/vrm-limits.js` ports the cone limit and limit-aware joint update from @pixiv/three-vrm's `springbone-limit` branch (commit 4f61363, `packages/three-vrm-springbone`), MIT, Copyright (c) 2019-2026 pixiv Inc.; the notice is in the file header.
- `js/vrm-touch.js` (tap and pat recogniser, touch reaction) and `js/vrm-eyes.js` (saccade gap table) port parts of [Project AIRI](https://github.com/moeru-ai/airi) at commit ded3dd1, **MIT**, Copyright (c) 2024-PRESENT Neko Ayaka; the full notice is in each file's header.
- `js/vrm-bone-maps.js`: the Mixamo bone map is ported from three-vrm's `examples/humanoidAnimation/mixamoVRMRigMap.js` (v3.5.5), Copyright (c) 2019-2026 pixiv Inc., MIT, with its notice kept in the file header.

# Adding a bundled model or motion

Every model, clip, texture or other asset committed under `assets/` gets an
entry here in the same commit, in the shape below. `dev/` and `assets/` are
public on Pages, so committing a file redistributes it. A file that cannot fill
in every line (no verbatim licence text, terms that forbid redistribution, an
unknown origin) stays on the owner's disk and is tested from there in
`dev/lab.html` or `dev/retarget.html`; pixiv's VRMA pack and Mixamo clips are
always in that group. Folders that hold third-party files carry a `NOTICE.txt`
saying so (see `models/NOTICE.txt`). It is plain text because the Pages build
leaves out every Markdown file (`_config.yml`), this one included, and the
notice has to be served beside the files it covers.

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
