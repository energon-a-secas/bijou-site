# Hime / oval — first Meshy trial

Created 2026-10-05. This is an isolated asset study, not the companion's active
body. Open [the interactive viewer](../../../dev/asset-study.html?asset=rigged)
through the local server (`http://localhost:8897/dev/asset-study.html?asset=rigged`).

The reference is an original adult character in fitted athletic clothes, created
with the built-in image_gen tool. Its exact [prompt](reference-prompt.txt) and
[image](reference.png) are retained. The user-supplied reference pictures were not
uploaded to Meshy. The image generated for this trial was uploaded.

## Result

The generated silhouette is a useful art reference. This trial does **not** supply
the editable anatomy, independent garments, fingers, expressions and hair rig
needed for Bijou. Adopt the design direction as a candidate; keep production
integration open until these requirements are addressed.

| Asset | Triangles | Skeleton | Morphs | File |
| --- | ---: | --- | ---: | --- |
| Original generation | 640,848 | None | 0 | [generated.glb](generated.glb) |
| Remesh | 102,921 | None | 0 | [working.glb](working.glb) |
| Rigged character | 102,921 | 24 joints | 0 | [rigged.glb](rigged.glb) |
| Walking test | 102,921 | Same skeleton | 0 | [walking.glb](walking.glb) |

The rigged file contains a one-frame bind-pose clip. Only the walking file
contains a meaningful motion clip. The viewer disables playback for static poses.

- **Shape:** front/profile/clay views show a continuous rounded body and a closer
  fit than the existing procedural garment shell. Clothing wrinkles are sculpted
  into the surface; they cannot currently respond independently to body edits.
- **Topology:** one mesh, one material, and one connected component after welding
  coincident positions at 0.00001 source units. Body, clothing and hair are joined.
  There is no separate body object underneath the tank top and shorts.
- **Rig:** 24 joints include spine, shoulders, arms, hands, legs, feet and head
  markers. There are no finger, facial or hair joints and no morph targets.
  Neutral, raised-arm, elbow/knee bend, head-turn and walking views were inspected.
  Bends need joint corrections; raw joint rotation offers no collision constraints.
  At five sampled walking frames the lowest surface sits roughly 3.5–5.4 cm above
  the neutral floor. The source clip needs foot-contact retargeting for Bijou.
- **Weights:** every vertex has valid joint indices, finite nonnegative weights
  and a normalized sum (maximum error 0.000000179). This validates the data, not
  attractive deformation or collision-free animation.
- **Materials:** the source has 4K base color/normal maps and 2K metallic/roughness
  maps. Hair and eye edges show noise; some shading is already painted into the
  color map. Anime finishes are viewable, but clean texture/normal art is needed.
- **Size:** the GLBs are roughly 35–42 MB each. These study assets are not loaded
  by the companion. Production needs a smaller texture/export budget and real
  desktop performance measurements.

## Cost and provenance

The trial consumed **40 Meshy credits**: generation 30, remesh 5, rigging 5.
No additional animation job was submitted; walking was included in rigging.
The private account balance changed from 1,100 to 1,060.

[manifest.json](manifest.json) records settings, task IDs, file hashes and measured
structure. [topology-audit.json](topology-audit.json) and
[skinning-audit.json](skinning-audit.json) retain the geometry findings. Original
downloads and raw task responses are also retained outside the statically served
repository; signed URLs and credentials are not part of these study files.

Generated through the user's Meshy account from the original reference. This
candidate is separate from the CC0 VRoid asset used by the app; do not label it
CC0. Meshy's [ownership guidance](https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models)
describes its generated-asset terms. Nothing was published to Meshy Community or
deployed by this trial.

## Next modeling work

1. Establish body topology with usable shoulder/hip loops and continuous anatomy.
2. Separate hair and clothing, reconstruct covered body regions, and author
   thin garment surfaces with independent upper/lower patterns and seams.
3. Add finger chains, facial expressions, hair guides and pose corrections.
4. Define semantic regions and a skeleton adapter before porting body morphs,
   garment fitting, collision and companion movement.

A second T2 trial could test part separation, but it has not been run or charged.
Simply generating more texture detail will not address the missing structure.

## Local tools

`dev/meshy-client.py` resumes status/downloads and supports explicit remesh/rig
submissions with duplicate-submission and trial-budget guards. Its default run
directory is outside the repository. It does not expose a browser API key.

`node dev/asset-study-check.cjs` checks available study assets through all five
surface modes, view changes, wireframe/skeleton display, walking playback and
scrubbing, reduced motion, mobile layout and GPU resource reuse.

The final [browser check](browser-check.json) passes all four assets over two
cycles with no JavaScript/shader errors. Resource counts remain at 3 geometries
and 4 textures, including the viewer floor/helper and the active skeleton texture.
Camera gestures and the 390px layout pass. The viewer disposes skeleton textures
when switching models and renders static inspections only when the view changes.
Model-switch checks verify a consistent floor and 1.68 m display height; raw
walking frames are checked separately so a framing error cannot masquerade as
a successful load.
These checks do not establish production frame rate or complete art acceptance.
