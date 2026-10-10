# Hime T2 comparison

Generated and rigged on **2026-10-05**, after the user requested continued work
on the successful first Meshy study. Uses the same original adult reference as
[the first trial](../meshy-hime-v1/README.md); no supplied user pictures were sent.

Try [the model studio](../../../dev/model-studio.html) to edit either candidate,
or [the source inspector](../../../dev/asset-study.html?asset=t2rig) to see this
rigged asset unchanged. The detailed 7.1 candidate is the studio default because
its face and silhouette hold up better in the inspected views. T2 is an optional
lighter alternative, not a production replacement.

| Output | Triangles | Vertices | Meshes / materials | File size |
| --- | ---: | ---: | --- | ---: |
| Generated | 15,052 | 13,914 | 1 / 1 | 15.2 MB |
| Rigged | 15,052 | 14,003 | 1 / 1 | 15.7 MB |
| Walking | 15,052 | 14,003 | 1 / 1 | 15.7 MB |

Generation used **15 credits**, rigging **5**, total **20**. Across both trials:
**60 credits**, balance **1,040** immediately after completion. No further jobs
were submitted. Task IDs, exact settings and SHA-256 hashes are in
[manifest.json](manifest.json). Raw responses and original separate texture maps
are retained outside the served repository in the user's private Meshy directory.

## What the comparison establishes

- Geometry is about 85% lighter than the first working mesh. Both generated rigs
  have 24 joints and the same approximately 1.067-second walking clip, without
  finger chains, expression morphs or hair bones.
- Welding coincident positions at 0.00001 source-unit precision finds **24
  connected components**, with 6,635 of 7,917 welded vertices in the main one.
  The other 23 components lie in the head region: facial parts and fringe/locks.
  Torso, limbs and clothing still share the largest connected component.
  [Topology measurements](topology-audit.json)
- There are no independent top/bottom objects, complete interchangeable hair
  object, or demonstrated underlying body surface. T2's documented part
  separation does not supply the wardrobe construction this character needs.
- The atlas shows pale seam flecks with mip filtering, especially around hair
  and garment edges. The studio uses linear sampling without mip levels to
  reduce this bleed, retaining texture pixels. This is a close-up preview
  workaround; padded UV islands and cleaner maps are still needed for a small,
  animated desktop companion. Some face/hair geometry artifacts remain.

The connectivity and visual conclusions above are observations of these files.
Meshy documents Smart Topology's intended parts and face-count behavior in its
[Image to 3D API](https://docs.meshy.ai/en/api/image-to-3d). The
[Auto Split API](https://docs.meshy.ai/en/api/auto-split) is oriented toward printing
pieces and connectors; no Auto Split job was submitted for this clothing task.

## Editable study

The Body, Face, Hair and Clothes tabs now provide:

- **20 body controls and nine starting silhouettes**: Original, Figurine, Slender,
  Petite adult, Willow, Soft, Curvy, Athletic and Full; height spans 150–195 cm.
  Slender includes a flatter chest and narrower limbs/hips. Upper-arm and forearm
  lengths are independent controls and vary across presets.
- **Five adult age appearances**, 20s through 60s, independent of body size.
  These are subtle stylized sculpt treatments, not photorealistic age models.
- **Five face treatments**: default Oval, Figurine, Game heroine, Soft and Defined, with
  an adjustable strength. Game heroine interprets the requested
  [official Tifa Remake reference](https://www.jp.square-enix.com/ffviir_ig/character/tifa.html)
  through smaller almond eyes, cheek/jaw proportions and a clearer nose bridge.
  No Square Enix model or texture is embedded or redistributed.
- **Fitted clothing layers**: tank, tee, long sleeve, shorts, leggings and jeans;
  independent top/bottom colors and ease, trouser length, five outfit presets.
  The original tank/shorts remain underneath. These templates do not reconstruct
  the body hidden by the source outfit or simulate loose cloth.

Regional camera focus, orbit/zoom, four surface modes, original comparison,
shared undo/redo and independent drafts cover the whole look. Version 3 look
files contain body, appearance, hair, gaze and clothing parameters; older files
and drafts migrate. GLB downloads contain edited geometry, hair, garment meshes and
materials, textures, the corrected bind pose and adjusted walking clip. The GLB
bakes the chosen look rather than adding Blender shape-key sliders.

Geometry and joints are edited in a normalized +Z-front metre space. The adapter
resolves Meshy's centimetre Armature/metre-vertex bind convention before editing,
then always rebuilds from the captured source. Head/hand/foot weights protect
their proportions; front-only abdomen and cup fields preserve the back and
upper ribcage. Runtime shaping of a clothed mesh does not create a separate body
or garment simulation. Coincident source vertices share morph masks and skin
weights. Authored normals follow the deformation derivative; clothing uses
welded geometric normals for displacement to avoid splitting UV seams. Atlas
material masks keep the lower hair strands out of garments even where Meshy
assigned those strands to torso bones.

Validation and remaining limits are recorded in the
[retained browser report](../model-studio-check.json) and the
[request ledger](../../../docs/COMPANION-ROADMAP.md). Animation remains a diagnostic:
foot contact, shoulder corrections, face/finger articulation, source clothing
separation and the companion's collision constraints still require integration.
No new Meshy jobs were submitted for these local refinements.

The subsequent figurine pass adds separate arm lengths, a ninth silhouette and
fifth face treatment, editable outer hair and gaze/blink/expression/head-follow
controls. The source fringe shares the face surface and stays intact; its tint
is previewed and baked to a separate export atlas. Hair guides and automatic
facial motion are preview behaviors, while manual gaze/expression and hair rest
geometry export. Version 3 recipes retain these settings and migrate older files.
See the [persona checks](../model-persona-check.json). Source texture noise and
production face/finger topology remain open.

```sh
node --test dev/model-shape.test.mjs dev/model-persona.test.mjs
node dev/model-studio-check.cjs
node dev/model-persona-check.cjs
node dev/asset-study-check.cjs
```
