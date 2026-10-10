# Meshy evaluation for Bijou

Investigated **2026-10-05** against Meshy's official documentation and the current
renderer. The user then supplied local API access and the first trial completed
for **40 credits**. See the [actual outputs and findings](../assets/studies/meshy-hime-v1/README.md).
The generated reference was uploaded; the user's supplied pictures were not.

Continued on **2026-10-05** with a T2 comparison and an editable model studio.
The second generation and rig cost **20 credits** (60 total across both trials;
balance 1,040). [T2 findings](../assets/studies/meshy-hime-t2/README.md) record the
15,052-triangle asset, topology audit and remaining limitations. Open
[`dev/model-studio.html`](../dev/model-studio.html) for body editing and GLB export.

## Recommendation

The first trial supplies a useful starting sculpt and a basic humanoid rig.
It does not pass the requirements for a fully customizable companion: body,
clothes and hair are connected, with no finger rig or expression/body morphs.
Keep the existing app model active while developing the necessary topology,
separate garments and rig. This conclusion applies to this tested candidate,
not every possible Meshy output or model.

The continued work now supplies usable regional shaping for both candidates:
20 controls, nine silhouettes, five adult age appearances, five face treatments,
six fitted garments, editable sculpted hair, gaze/blink/expression controls, head
following, close-up inspection, local drafts and undo/redo. Whole-look
recipes and GLB exports include the edited skeleton and walking clip. It is
linked from the companion's Body tab. The original detailed mesh is the default;
the lighter T2 option is faster to edit but has rougher facial/edge detail. Neither
candidate supplies complete body geometry beneath the original outfit or the
richer rig required for adoption. The new fitted layers are editable overlays.
The local face controls are bounded deformations of the source surface, not a
new production facial rig. Outer hair is replaceable; the fringe remains fused
to the face. Guide motion is bounded and preview-only. New manual poses, hair
geometry and a separately tinted atlas can be exported without another API job.

The user's latest clothing feedback remains a separate open issue: bulky fabric,
insufficient upper/lower controls, and underwear that does not follow the body
convincingly. A generated clothed character does not automatically supply a body
under its clothes, independently editable garments, or a cloth solver.

## Documented capabilities

| Tool | Relevant capability | What we must inspect ourselves |
| --- | --- | --- |
| Image to 3D | Textured GLB, A/T pose, PBR maps; standard Meshy 7.1 or T2 Smart Topology | Silhouette, face fidelity, body continuity, hands and usable deformation topology |
| Multi-image to 3D | 1–4 views of the same subject; first view is front for 7.1 | Consistency between views and whether clothing hides missing body surfaces |
| Rigging | Textured biped to a skinned GLB/FBX | Joint mapping, weights, finger chains, facial articulation and bend quality |
| Retexture | Existing UVs can be retained | Seam quality, unwanted painted lighting, material separation and appearance under our three finishes |

Sources: [image generation](https://docs.meshy.ai/en/api/image-to-3d),
[multiple views](https://docs.meshy.ai/en/api/multi-image-to-3d),
[rigging](https://docs.meshy.ai/en/api/rigging),
[retexturing](https://docs.meshy.ai/en/api/retexture).

T2 documents separated parts and a 100–15,000 face range. That makes it an
useful comparison, but our output's additional components are confined to the
head region. It does not supply anatomical edge loops or fitted clothing.
Standard 7.1 remains the more detailed silhouette study.
Neither route is evidence that body morphs, pose corrections, hair constraints or
our wardrobe controls will transfer automatically.
[Smart Topology parameters](https://docs.meshy.ai/en/api/image-to-3d)

## First experiment

1. Prepare a consistent reference for an **original adult character**: preferred
   Hime hair and oval face, rounded anime-figurine proportions, relaxed A-pose,
   separated limbs and visible hands. Use simple opaque fitted clothes, neutral
   lighting and an unobstructed silhouette. Review the reference before spending
   credits; sending the current flawed body risks reproducing its problems.
2. Use one clean reference first, or coherent front/side/back views of that same
   design. The supplied pictures show different designs and poses; they should
   guide the design rather than be passed as matching multi-view inputs.
3. Generate a standard Meshy 7.1 model with 4K textures and PBR maps. Preserve
   the original high-detail output. Review it before paying for rigging.
4. If promising, produce a working mesh within the rigging limit, then rig it.
   Meshy specifies a textured humanoid with clear limbs and at most 300,000 faces
   for task-based rigging. Uploaded GLBs must face +Z. Bijou's raw rest space faces
   -Z, so this conversion must be explicit.
5. Download the model, maps and task metadata immediately. Compare it in a
   separate local inspection scene before replacing any app asset.

The reference criteria and staged review are Bijou-specific decisions. Input
and output requirements come from the [multi-image documentation](https://docs.meshy.ai/en/api/multi-image-to-3d)
and [rigging API](https://docs.meshy.ai/en/api/rigging).

First single-image settings (submitted with `multi_view_thumbnails: true` too):

```json
{
  "image_url": "<approved reference as a PNG/JPEG data URI>",
  "model_type": "standard",
  "ai_model": "meshy-7.1",
  "geometry_resolution": "standard",
  "should_texture": true,
  "texture_resolution": "4k",
  "enable_pbr": true,
  "should_remesh": false,
  "pose_mode": "a-pose",
  "image_enhancement": false,
  "target_formats": ["glb"]
}
```

Submit to `POST https://api.meshy.ai/openapi/v1/image-to-3d`, retain the returned
task ID and poll its GET endpoint. Do not blindly retry a timed-out POST: check
the account's task log first to avoid duplicate paid jobs. Do not set
`remove_lighting` for single-image 7.1; that option is documented for Meshy 6 on
this endpoint. This differs from the multi-image endpoint.
[Request parameters](https://docs.meshy.ai/en/api/image-to-3d)

## Credits and account setup

| Proposed step | Credits |
| --- | ---: |
| 7.1 standard geometry with 4K textures | 30 |
| Rig a promising output | 5 |
| Optional separate remesh | 5 |
| First trial total | **35–40** |

An Ultra geometry pass adds 5. The completed T2 comparison used 15 for generation
and 5 for rigging. These estimates exclude creating reference images, regeneration
and extra animation jobs. Verify the account's current estimate before each
submission. [API pricing](https://docs.meshy.ai/en/api/pricing)

Free accounts can try Image to 3D in the Developer Platform Playground using its
built-in testing key. Creating a personal API key requires a paid plan; buying
credits alone is not a substitute for checking key access. Set a per-key credit
limit for the trial. [Developer Platform access](https://docs.meshy.ai/en/api/developer-platform)

For local automation, create the key in Meshy's Developer Platform and store it
outside this statically served repository, for example:

```text
~/.config/bijou/meshy.env
```

Contents: `MESHY_API_KEY=your_key_here`, with owner-only file permissions (`600`).
Share only the file path in chat. The local runner parses that value,
sends it only in the Meshy API Authorization header and redacts it from errors.
No key belongs in browser code, a public environment file or a request artifact.
`dev/meshy-client.py` provides task status, downloads and guarded follow-up jobs.
The supplied credential file is owner-readable/writable only.

Save downloaded assets locally: ordinary API asset retention is at most three
days. Keep source references, job settings, date and license provenance with each
candidate. Meshy's ownership guidance distinguishes paid private assets from
free-plan CC BY 4.0 assets and conditions ownership on the input materials.
[Retention](https://docs.meshy.ai/en/api/asset-retention) ·
[Ownership guidance](https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models)

## Integration findings from this repository

The existing loader in [avatar.js](../js/avatar.js) expects VRM metadata and
humanoid bones. [avatar-model.js](../js/avatar-model.js) identifies body/hair/face
by source material names; its body topology refinement is specific to that asset.
Morph fields, garment coverage and regional colliders depend on source rest-space
coordinates. Therefore exchanging `bijou.vrm` for an arbitrary GLB will not work.

The studio adapter now handles units/orientation, the neutral pose, regional
body coordinates, rest rebinding and animation translation adjustment. Local
refinements add eight silhouettes, flat/slender chest shaping, five adult age
appearances, four face treatments and six fitted garment layers. Clothing follows
the same skeleton and exports with the edited look. These layers preserve the
source outfit; they do not demonstrate complete anatomy beneath it. Production
integration still needs semantic mesh parts, complete humanoid mapping and
face expressions. A stable production mesh then
needs body morphs, corrective shapes and garment attachment/fit data. Retopology
must happen before those persistent deformations are authored. Hair separation
must support anchored motion; a solid sculpted hair mass is insufficient.

The existing face can also remain a candidate for a hybrid body/head workflow,
but neck seams, proportions, UVs and rig continuity require a real asset test.
Retexturing is another possible use if Meshy's geometry does not pass. It would
not fix the current garment geometry or body silhouette.

## Acceptance before adopting an asset

| Area | Evidence required |
| --- | --- |
| Design | Front, profile, back and close views match the preferred adult proportions and Hime/oval direction |
| Surface | Inspect shoulders, armpits, chest-to-ribcage transition, abdomen, pelvis and limbs for fused surfaces, holes and shading defects |
| Articulation | Raise arms, bend elbows/knees, sit and twist; inspect hands and actual joint weights, not just the existence of an armature |
| Customization | Width/depth, independent cup volume, belly, height and regional fullness alter anatomy smoothly on stable topology |
| Clothes | Body and garments are separable; thin fitted pieces follow all tested body shapes; upper and lower pieces retain independent controls |
| Materials | Face/body agree in anime 3D and anime 2D; realistic finish remains available; inspect unlit color for baked shadows |
| Runtime | Measure loading, texture memory and frame time in the companion, including pop-out and reduced motion |
| Provenance | Local source asset, maps, settings and applicable license recorded before shipping |

If the attractive result is only a fused display sculpt, keep it as an art
reference or retopology source. Do not label it a fully customizable replacement.
The first trial is **complete**. Its generated sculpt has 640,848 triangles; the
working/rigged versions have 102,921. The 24-joint rig supports a supplied walking
clip but has no finger/hair joints or facial morphs. Production adoption remains
open for the concrete modeling work listed in the [study result](../assets/studies/meshy-hime-v1/README.md).
