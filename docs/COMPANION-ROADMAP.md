# Bijou companion requests and research

Updated **2026-10-05**. This file is the persistent source of truth for the user's
requests, corrections, implementation progress and research queue. Supporting
studies: [archetypes and animation](ARCHETYPES.md),
[clothing templates](CLOTHING-TEMPLATES.md),
[figurine and animation look development](LOOK-DEVELOPMENT.md),
[Meshy asset evaluation](MESHY-EVALUATION.md),
[rig contract](RIG.md).

This is the working request ledger. A feature marked **in progress** is not yet
accepted as visually finished. The body and natural movement take priority over
adding more outfits. All character baselines use adult anime proportions.

## Confirmed direction

- Use a continuous, editable 3D anime character with rounded forms and the finish
  of the supplied figurine reference. Avoid a flat paper-doll appearance.
- Make **Hime with the existing oval face** the default. Keep the other face and
  hair variants; the user clarified that these options are already suitable.
- Remove **Crimson ribbon** as a starting ensemble and add a bikini option.
  The source asset's built-in clothes and ribbon have already been removed.
- Prefer quality and a reusable modeling foundation over more superficial
  controls. Preserve the desktop companion, saving, outfits and pop-out window.

### Clarifications to preserve

- “Plan” meant a written implementation plan first; that plan preceded the
  current implementation. It did not mean only a flatter body preset.
- “Pinch” means reshaping a selected body region with a gesture.
- The initial ribbon removal applied to source-model pieces. The later
  correction also retires the **Crimson ribbon ensemble option**. Existing
  separate wardrobe pieces remain usable in saved/custom looks.
- The later face clarification supersedes the request to replace the anime face:
  keep the existing variants, with **oval preferred** and **Hime as default**.
- Natural posture, height/shape archetypes and small character movements are
  part of the body/companion work. Clothing generation follows the body baseline.
- Latest clothing review: fabric is too bulky, upper/lower customization lacks
  detail, and underwear does not convincingly fit the body. Existing functional
  tests do not resolve this visual feedback. Prioritize fit over more pose tools.
- Investigate Meshy as a possible better model/texture source. The user offered
  to register and supplied local API access after the 35–40 credit trial proposal.
  The first trial consumed 40 credits; after the user requested continued modeling,
  a T2 comparison used 20 more. Both now support studio editing and export;
  adoption remains open because clothing is connected and the rigs lack fingers
  and expressions.
- Latest refinement: more adult ages and sizes, explicitly a flat/slender option
  alongside fuller builds, an alternative Tifa Remake inspired face, and more
  clothes. Age appearance, body proportions and outfit must stay independent.
- Match the supplied figurine more closely, improve hair, and make arm length
  change across body types. Preserve the accepted Game heroine face option.
- Movable eyes are requested. The user explicitly prioritized **blinking,
  expressions and head tracking** as the accompanying add-ons.
- Continue visual iteration toward realism as the baseline. Numerical passes
  alone do not establish the requested quality or perfection; assess the face,
  hair and skin in close-up and from multiple angles against the supplied Aion
  creator and figurine references.
- Latest review: **“oh god it's awful.”** The neutral anatomy presentation was
  visually rejected despite passing technical checks. It is withdrawn from the
  visible choices; its files/drafts remain. Prioritize a coherent Hime/Oval face,
  hair silhouette, neck/shoulder join and fitted clothing before adding controls.
  The earlier Game heroine face must remain available.

## Feature ledger

| ID | Request | Status | Acceptance evidence / next step |
| --- | --- | --- | --- |
| R-01 | Rounded anime style; 3D accepted over paper-doll appearance | Implemented; art refinement open | Local skinned 3D renderer and figurine direction; SVG fallback retained |
| R-02 | Remove source clothes and ribbon | Implemented | Removed source primitives; independent fitted wardrobe and base garment |
| R-03 | Hime / oval default, retain face and hair variants | Implemented, checked | Fresh-visit default checked; nine heads, four faces, ten hairstyles remain selectable |
| R-04 | Bikini replaces Crimson starting option | Implemented, checked | Free item, fitted top and bottom, refreshed preview; no Crimson ensemble option |
| R-05 | Continuous, better-shaped body | Implemented foundation; art refinement open | Subdivision, volume-preserving skinning, four bounded underarm/hip corrections; artist-authored corrective library remains open |
| R-06 | Better shadows, textures and material quality | Three finishes implemented; art refinement open | Shared anime treatment, covered-surface shadows, procedural fabric and separate physical finish; authored texture maps remain open |
| R-07 | Body shape presets and regional width / depth | Implemented, checked | Five shapes, nine regions, mouse/touch sculpting, sliders, history and persistence |
| R-08 | Detailed belly adjustment | Implemented, checked; visual refinement open | Width, projection, independent upper/lower fullness and placement; locality/continuity tests |
| R-09 | Armpit customization | Implemented, checked; visual refinement open | Local width/depth, clavicle movement and bounded raised-arm corrections; artist sculpting at extreme poses remains open |
| R-10 | Nail customization | First pass implemented, checked | Four shapes, length, six colors, skinned plates and hand inspection; close-up contour refinement remains open |
| R-11 | Natural resting pose and anime pose baselines | Support implemented, checked; art refinement open | Relaxed arm targets, grounded feet, forward knee poles and measured seat contact; 96 body/height/shoe/pose cases |
| R-12 | Prevent arms crossing torso / unintended rear paths | Implemented, checked; broader contact work open | IK lengths, elbow limits, torso/head clearance and bounded front/back transitions; default stretch visually checked |
| R-13 | Soft-body motion / jiggle | Implemented, checked | Bounded damped motion; off switch and reduced-motion support; not a volumetric soft-body simulation |
| R-14 | Pinch gestures reshape regions | Implemented, checked | Native two-finger tests, cancellation rollback and keyboard equivalents |
| R-15 | Convincing, adjustable hair physics | First pass implemented, checked | Anchored guides, gravity, damping and collision; settling/frame-rate tests; all-style visual contact review remains open |
| R-16 | Archetypes for fast height/shape customization | Implemented, checked; research continues | Elegant, Bright, Athletic, Gentle preserve face/outfit; see [A-01..A-08](ARCHETYPES.md) |
| R-17 | Different levels of detail | Rendering controls implemented; model-detail study queued | Light/Balanced/Detailed resolution and shadows; all currently share body topology |
| R-18 | Finger/head motion, quirks and archetype mannerisms | First pass implemented | Small head/finger movement, timing and weighted idles; authored gesture library and independent behavior editor queued |
| R-19 | Clothing generation templates | Pattern editor implemented, checked; cloth simulation queued | [Clothing studio](CLOTHING-TEMPLATES.md) exposes ten new patterns plus bikini, cuts, fabrics and fit; loose-cloth cages and export remain future work |
| R-20 | Realistic, fully editable modeling foundation | Editable foundation implemented; production art open | Stable topology, saved regional morphs, support IK, procedural joint corrections and material finishes; sculpted correctives, authored maps and interchange require further work |
| R-21 | Customizable desktop companion | Existing foundation preserved, checked | Saved looks, snapshots, window pop-out/return, responsive editor and fallback |
| R-22 | Keep every request, feature and investigation tracked | Implemented | This ledger, linked research, explicit priorities and future-work instructions in `CLAUDE.md` |
| R-23 | Automatic close-up of selected region, orbit/zoom, return to normal on exit | Implemented, checked | Region focus, separate Sculpt/Rotate tools; mouse, native touch, keyboard and exit restoration pass |
| R-24 | Independent cup size rather than flattening the ribcage | Implemented, checked; extreme silhouettes open | Local volume, spacing and lift separate from torso depth; locality tests and covered clothing inspection |
| R-25 | Fully articulated custom pose editor with realistic joint limits | Backlog, explicitly requested | Existing pose/IK foundation; needs saved pose schema, manipulators, finger controls and contact constraints |
| R-26 | Coherent default 3D anime, 2D animation and realistic shading options | Implemented, checked; art refinement open | Shared light direction and controlled shadows, persisted per look; physical finish retains anime face geometry |
| R-27 | Adaptable underwear, jeans, leggings, jeggings, crop tops and generic clothes | Controls implemented; fit not visually accepted | Ten free templates plus bikini; saved-look roundtrips pass; latest feedback requires thinner fit and more upper/lower detail (R-30) |
| R-28 | Regional extended body fullness and oversized/stretch clothing | Implemented, checked; cloth contact open | Six extra-fullness controls, independent garment ease and stretch cues; shape first, fit second; oversized sweater/jeans inspected |
| R-29 | Figurine and professional animation research for style/shape balance | Researched and applied; ongoing study | [Primary-source study](LOOK-DEVELOPMENT.md), deliberate normal/shadow control, shoulder/support corrections and multi-view reviews |
| R-30 | Thinner clothing, detailed independent upper/lower tailoring, close-fitting underwear | Open; next visual priority | Refine surface allowance, separate coverage/band/strap/rise/leg-opening controls, and inspect front/profile/back through body extremes; current inflated shell is insufficient |
| R-31 | Investigate Meshy for a better 3D model and textures | Two trials and editable studio complete; production adoption open | [T2 comparison / modeling results](../assets/studies/meshy-hime-t2/README.md): 60 credits total; detailed/light candidates; 20 shape controls, nine silhouettes, adult face appearances, fitted clothing layers, hair/gaze controls, local drafts, close-up cameras, GLB and recipe export; underlying covered body and richer articulation remain open |
| R-32 | More adult ages, heights and sizes, including flat/slender | Implemented in model studio | Five adult appearance treatments (20s–60s), nine body starts, 150–195 cm, independent build and ribcage-based chest reduction; main companion adoption remains open |
| R-33 | Alternative video-game face inspired by Tifa in FFVII Remake | Implemented in model studio; art refinement open | Game heroine changes eye, cheek, nose and jaw geometry; Oval stays default, Soft and Defined remain available; [official reference](https://www.jp.square-enix.com/ffviir_ig/character/tifa.html), no imported Square Enix asset |
| R-34 | More clothes for the Meshy character studies | Fitted layers implemented; production construction open | Tank, tee, long sleeve, shorts, leggings and jeans; separate color/ease, trouser length, five outfits; source outfit stays covered; loose cloth simulation and authored garment topology remain open |
| R-35 | Closer figurine style, better hair, actual arm-length changes between body types | Implemented in model studio; art acceptance open | Hime now uses a clean CC0 anime head, layered/tapered locks, torso rest fit and lower arms; balanced Figurine body on fresh drafts; arm-length controls retained; source fringe no longer limits Hime replacement hair |
| R-36 | Movable eyes, blinking, expressions and head tracking | Implemented in model studio; production facial rig open | Horizontal/vertical gaze, pointer following, bounded head turns, automatic/manual blink, neutral/smile/bright/serene/wink; height/face-aware anchors, history, comparison, versioned recipes, reduced motion and GLB manual-pose export |
| R-37 | Aion 2 quality, realistic creator and finer character generation | Studio refinement implemented; production art and full game parity open | [Research and implementation](CHARACTER-CREATOR.md): 31 geometric face controls, 18 skin/iris/makeup/hair parameters, portrait starts/variations, physical finish, light pad, close-ups, v4 recipes and atlas-baked export; authored facial topology, separate eyes, clean maps and a hair groom remain required |
| R-38 | Iterate until realism and perfection are the baseline | Latest anatomy presentation rejected; corrective art pass in progress | Anatomy study withdrawn, assets/drafts preserved; Hime head replaced with clean anime surfaces and authored lids, hair/neck/shoulder/garment corrections; earlier Game heroine head retained; body sculpt, real garment construction, groom, coordinated maps and visual reference acceptance remain open |

## Prioritized work queue

0. **P0 — Portrait realism and source quality:** R-37, R-38, the latest request.
   Review the face with textures off as well as in the intended finish, then
   inspect eyes, lips, chin and fringe at portrait distance in front/profile/¾.
   Keep improvements reversible and exportable. Production adoption requires
   clean facial loops, separate eyeballs/corneas, coordinated maps and a separate
   groom, with the same body/pose/clothing acceptance checks. Do not certify the
   generated Meshy sculpt as visually finished because its controls pass tests.
   The CC0 anatomical presentation was visually rejected and withdrawn. The
   corrective Hime pass uses the existing clean anime head and preserves the
   earlier Game heroine option. Judge its hair roots/tips, neck length, face/body
   proportions and collar fit in front/profile/¾; technical passes alone do not
   accept the art. Continuous anatomical data remains an internal study.
1. **P0 — Clothing fit and baseline asset decision:** R-27, R-28, R-30, R-31.
   Address thin fabric and independent upper/lower construction, especially
   underwear. Evaluate a Meshy candidate against silhouette, articulation and
   customization criteria before adopting a new base mesh. The first Meshy trial
   is retained as a candidate sculpt; separate surfaces and a richer rig are
   required. Both candidates now have an editable modeling workspace and tested
   export. T2 reduces geometry but does not separate the outfit; 60 credits used
   in total. The studio now has separate fitted overlays, adult face appearances
   and a wider body range (R-32–R-34), with no further API spend. Next: production
   body topology under the source outfit, constructed garment patterns, clean
   padded texture atlases and face/finger/hair rigging.
2. **P0 — Body and natural posture:** R-05, R-06, R-09, R-11, R-12, R-20.
   Inspect the existing mesh at joints and region boundaries. Refine the bounded
   procedural corrections with authored pose sculpts before widening morph ranges
   or promising production-level anatomy. Review underarms and extreme garment fit.
   Follow the archetype study's A-01, A-02, A-03 and A-07 acceptance criteria.
3. **P1 — Companion movement and detail:** R-10, R-15, R-16, R-18.
   Review all hairstyles in motion, refine nail fit and silhouettes, and develop
   small authored gestures. Measure desktop performance before adding complexity.
4. **P2 — Articulated pose authoring:** R-25, explicitly requested as backlog.
   Build a saved-pose schema and joint manipulators on the current constrained
   arms, planted legs and support contacts. Add finger editing and undo/redo.
5. **P2 — Loose clothing:** R-19, R-27, R-28. The pattern editor and independent
   fit allowance are implemented. Investigate simulation cages, garment layering,
   seams and self-contact; current stretch marks are procedural visual cues.

Keep completed implementation separate from visual acceptance. For future work,
update the existing request ID with evidence, next action and any limitation;
add new IDs for new requests. Record corrections in Confirmed direction instead
of silently replacing the user's preference. Investigations need a source,
an application-specific inference and a concrete experiment or acceptance check.

## Research applied to the foundation

1. **Skinning and volume:** Blender documents the joint-volume loss of ordinary
   linear skinning. Kavan and colleagues describe dual-quaternion blending, its
   advantages and its limitations. Bijou now has a shared body/garment/shadow
   skinning implementation; its appearance still requires pose validation.
   [Blender armature modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/armature.html)
   · [Original dual-quaternion research](https://users.cs.utah.edu/~ladislav/dq/index.html)
2. **Topology before morphs:** establish the surface topology before defining
   persistent deformations. Body refinement carries UVs and normalized joint
   weights, then regional morphs act on that stable surface.
   [Blender shape-key workflow](https://docs.blender.org/manual/en/latest/animation/shape_keys/workflow.html)
3. **Clothing fit:** VRoid's body editor explicitly notes that body movement can
   expose skin through clothing. Shared morphs alone are insufficient: garment
   allowance, masks, pose testing and eventually cloth contact are separate work.
   [VRoid body editor](https://vroid.pixiv.help/hc/en-us/articles/360012340434-Body-Editor)
4. **Secondary hair motion:** the VRM spring-bone specification separates
   stiffness, gravity, drag and collision groups. Bijou's generated strands use
   fixed simulation steps, anchored roots, length constraints and bounded motion;
   these are controllable effects, not a strand-by-strand offline hair simulation.
   [VRM spring-bone specification](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_springBone-1.0/README.md)
5. **Archetypes and acting:** professional character-animation workflows use
   reusable poses and hand-authored performance. The current Elegant, Bright,
   Athletic and Gentle profiles are our design choices based on that approach.
   Their timing, asymmetry and idle preferences remain editable implementation
   data; an independent mannerism editor is still queued. See the
   [archetype study](ARCHETYPES.md) for source findings, design inferences and tests.
   [Autodesk character animation](https://www.autodesk.com/solutions/media-entertainment/character-animation-software)
   · [Pose-based animation workflow](https://help.autodesk.com/cloudhelp/2024/ENU/MotionBuilder/files/GUID-CDEEAD5A-79A2-4961-9687-4FE00CEC8DD5.htm)

## Next investigations and validation

- Compare relaxed, elegant and energetic posture references. Archetype names
  should describe optional animation styles, not lock anatomy or personality.
- Validate hair as constrained motion, preserving the designed hairstyle at rest.
  Measure rest settling, rapid turns, shoulder contact and reduced-motion behavior.
- Inspect hips, knees, elbows, shoulders and the abdomen across all morph limits.
  A numerical collision pass does not establish attractive or natural anatomy.
- Explore garment templates with explicit seam lines and ease. A generated
  fitted shell is not a substitute for a cloth simulator or an artist-authored
  production garment.
- Keep the CC0 source license and local dependency provenance. Do not silently
  replace the asset with a model whose license prohibits character creation.

## Verification record

2026-10-05, corrective Hime pass after visual rejection:

- The MakeHuman presentation is withdrawn from the picker and public query
  links; files/drafts remain. The earlier Game heroine head remains selectable.
- Hime's damaged fused head is replaced with the existing CC0 anime face,
  separate iris/lash surfaces and authored blink shapes. Hair has layered shallow
  locks, narrower roots, fine tips and torso rest clearance; arms rest lower.
  Geometric neck/shoulder cuts retain shoulder caps, and covered source triangles
  no longer bleed through fitted garments. Normals fit against the full base
  index, preserving seam directions while its visibility changes.
- **27 mathematical tests** and `dev/model-anime-check.cjs` pass. The browser
  check covers **124 face-detail extremes** across both bodies, approximately
  4.8 mm manual iris movement, authored lid closure, exact reset, body locality,
  three body extremes, normalized clothing weights, base outfit restoration and
  bounded hair/reset. Both GLBs reload with matching rest bounds and their
  24-joint skeletons; six facial alpha probes per source remain transparent.
- Saved drafts remain independent, the rejected study's draft is preserved,
  its public link falls back to Hime, and the earlier Game heroine head remains.
  Two model cycles retain **48 geometries / 22 textures** in this check session.
  Mobile/reduced motion passes with no browser/shader errors. No paid generation
  jobs or credential use occurred.
- Detailed/light exports in this check are about **57.3 MB / 8.7 MB**. The detailed
  source's atlas bake remains large; production export optimization is open.
- **Visual acceptance remains open.** The face is cleaner, but the neck, body
  silhouette, collar construction and hair grooming are still prototype art.
  Do not mark R-30/R-38 complete from these numerical passes.
- The surface/editor regression also passes on both corrected sources: skin,
  iris and authored hair color plus roughness survive GLB export; region focus,
  history, recipe reload, older recipes, material cycles and reduced motion pass.
  Current portrait thumbnails are regenerated from the new head. These checks
  validate editing/export, not realistic face or body art.
- Additional GLB checks preserve the chosen wink's facial vertices exactly and
  match three sampled walking-frame bounds on both sources (maximum difference
  below 0.000001 m in this session).
- [Integration report](../assets/studies/model-anime-check.json),
  [surface/editor report](../assets/studies/model-anime-surface-check.json),
  [Hime face](../assets/studies/model-anime-sculpt-face.png),
  [¾ portrait](../assets/studies/model-anime-sculpt-three.png),
  [body](../assets/studies/model-anime-sculpt-body.png),
  [wink](../assets/studies/model-anime-sculpt-wink.png),
  [light model](../assets/studies/model-anime-t2-face.png),
  [mobile](../assets/studies/model-anime-mobile.png).

2026-10-05, realism follow-up and continuous anatomical source (historical
technical checks; subsequently **visually rejected and withdrawn**):

- **27 mathematical tests** pass, including immutable facial-normal fitting,
  physical-look defaults and an outward-only, bounded fabric envelope that
  leaves skin and garment hems unchanged.
- Existing source refinement fixes tangents after shaping/gaze, restores the
  sclera/iris/pupil, protects side hair from skin cleanup, adds source hair
  definition/roughness and uses bounded diffuse falloff. The 124-case detail
  regression passes on both Meshy sources; skin, iris, hair and roughness pixel
  probes survive GLB export. New renders are retained below.
- The adult anatomical source uses verified pinned CC0 data, prepared by Bijou's
  own scripts. Its continuous body has 26,756 triangles; the full clothed source
  has 68,144 triangles and 163 joints. Facial/eye landmarks are calibrated;
  source normals bypass remesh repair. It is optional, with its own draft and no
  invented walking animation. Fresh Hime/Oval and existing drafts are preserved.
- `dev/model-human-check.cjs` passes **49 body cases and 62 face detail cases**,
  exact reset, body locality, finite normals/tangents, normalized weights,
  preserved body topology across four hair choices and mandatory base coverage.
  Both eye joints rotate by 0.2604 radians in the manual-gaze check. Curved lids
  close over the globes without collapsing face vertices. Generated hair remains
  bounded (0.0585 m maximum tested displacement) and resets exactly.
- New-source history, saved recipe reload and GLB export/reload pass. The edited
  10,603,700-byte GLB retains 32 skinned meshes, 163 joints, independent eye
  clearcoat and roughness maps, fitted clothing and base coverage. It has no clip.
  Chosen winks retain closed lid/lash surfaces and baked skin color/roughness in
  both physical and clay-preview exports; export restores the selected preview.
  Four repeated clothing/hair cycles show no resource growth (33 geometries,
  41 textures in this particular export/check session). No browser/shader errors.
- The observed median edit is about 180 ms on this machine during the check;
  this is not a cross-device performance guarantee. The prepared source is
  4,509,016 bytes. Source provenance and reproduction are in
  [the study notes](../assets/studies/human-adult-v1/README.md).
- Reference-quality acceptance remains open. Face sculpt, eyebrows/lashes,
  coordinated skin maps, corneal/tear-line detail, strand grooming, real garment
  construction, articulation/correctives and companion physics adoption still
  need work. Source hair is static; generated guides provide prototype motion.
  No paid generation jobs or credentials were used in this pass.
- Reports: [anatomy checks](../assets/studies/model-human-check.json),
  [surface/export checks](../assets/studies/model-details-check.json).
  Previews: [anatomy body](../assets/studies/model-human-body.png),
  [anatomy face](../assets/studies/model-human-face.png),
  [anatomy profile](../assets/studies/model-human-profile.png),
  [closed eye](../assets/studies/model-human-wink.png),
  [generated Hime](../assets/studies/model-human-hair.png),
  [slender shape](../assets/studies/model-human-slender.png),
  [mobile anatomy editor](../assets/studies/model-human-mobile.png),
  [refined Hime portrait](../assets/studies/model-creator-preview.png),
  [eye finish](../assets/studies/model-creator-eyes.png),
  [hair finish](../assets/studies/model-creator-hair.png).

2026-10-05, Aion-inspired creator refinement:

- **24 mathematical tests** pass. The new tests cover all 31 bounded facial
  controls, mirror symmetry, body/scalp locality, combined face/age extremes,
  deterministic adult portrait variations and immutable normal smoothing.
- The current body/clothes regression covers **62 body cases, 60 adult age/face
  cases and 36 clothing combinations** across both candidates. The persona
  regression covers **48 gaze cases, 10 expression cases, 16 hair cases and eight
  arm segment combinations**. Original restoration, skeletons and walking-frame
  GLB reload checks pass.
- `dev/model-details-check.cjs` checks **124 facial detail cases** across the two
  imported meshes. Region close-ups, atomic history, palette selection, keyboard
  lighting, portrait variation, v4 look export/import, v3 migration, reduced
  motion and a 390px layout pass with no browser or shader errors.
- Export pixel probes confirm retained skin and iris colors and roughness in
  the green channel on both candidates. Preview and export use the same color
  and roughness masks; the source atlas remains unchanged. Edited GLBs reload
  with matching bind bounds. Fine pore shading and studio lighting stay in the
  preview.
- Repeated face/material/model cycles retain **2 geometries / 5 textures** in
  the detail check, with no accumulation. Generated-hair and garment cycles are
  covered separately by the body and persona reports.
- Front, profile, full-body, makeup, skin, lighting and mobile reviews are
  retained below. The realistic starter uses the recolorable source hair sculpt;
  unsupported silhouette and physics controls are disabled. The lower face is
  protected from hair recoloring. Hime/Oval remains the default.
- Fused fringe, coarse facial topology and painted atlas seams remain visible.
  This is a working creator refinement, not Aion-quality production art. The
  [authored asset requirements](CHARACTER-CREATOR.md#quality-still-requiring-authored-assets)
  remain open. No paid model or image jobs were run in this pass.
- Reports: [face/surface/export checks](../assets/studies/model-details-check.json),
  [body/clothing checks](../assets/studies/model-studio-check.json),
  [hair/gaze checks](../assets/studies/model-persona-check.json).
  Previews: [portrait editor](../assets/studies/model-creator-preview.png),
  [profile](../assets/studies/model-creator-profile.png),
  [full body](../assets/studies/model-creator-body.png),
  [skin](../assets/studies/model-creator-skin.png),
  [makeup](../assets/studies/model-creator-makeup.png),
  [lighting](../assets/studies/model-creator-light.png),
  [mobile](../assets/studies/model-creator-mobile.png).

2026-10-05, figurine, hair, limb lengths and facial motion:

- **19 mathematical tests** cover arm segment lengths, rigid hand size, body/face
  locality, ordered eyelid deformation, gaze bounds, schema validation and closed
  hair-lock geometry with smooth normal seams.
- The body/clothes regression covers **62 body cases, 50 adult age/face cases and
  36 clothing combinations** on both candidates. Original restoration has zero
  error; dressed GLBs retain the skeleton and match three walking frames.
- `dev/model-persona-check.cjs` adds **40 gaze cases across both height extremes
  and all five faces, 10 expression cases, 16 hair style/length cases and eight
  arm segment combinations**. It checks automatic/manual blink, head limits and
  restoration, moving head attachments, source hair restoration and guide bounds.
- Version 3 look files and local drafts retain all four editors. Old recipes keep
  their original hair/gaze and receive neutral arm lengths. Global history,
  comparison, keyboard tabs, reduced motion and the 390px layout are covered.
- Hair geometry and source-fringe tint export without changing the original
  atlas. The reload check includes animated attachment transforms, which require
  consistent matrix and TRS representations. Automatic blink, head tracking and
  guide motion remain preview behaviors; the manual face/gaze pose is baked.
- Visual checks include Hime, rose Figurine, bob, gaze and wink close-ups. The
  source fringe is fused into the forehead; removing it opened the face, so the
  complete front shell is preserved and recolored. Texture flecks around lashes,
  temples and ears remain, especially on T2. This is not a production facial rig
  or final art acceptance. Full facial topology and independent bangs remain open.
- No paid Meshy or image-generation jobs. These refinements remain in the local
  modeling studio; the main companion and saved companion looks are unchanged.
- Reports: [body/clothing regression](../assets/studies/model-studio-check.json)
  and [hair/face/export checks](../assets/studies/model-persona-check.json).
  Preview evidence: [Figurine](../assets/studies/model-persona-preview.png),
  [wink and controls](../assets/studies/model-persona-eyes.png),
  [rounded bob](../assets/studies/model-persona-hair.png).

2026-10-05, adult appearances, broader sizes and study clothing:

- Added 18 body controls / eight presets, five adult age appearances, four face
  styles and six garment layers. Age and face edits preserve body geometry to
  floating-point tolerance. Flat chest reduction targets the ribcage; neck and
  crotch centerline fields stay continuous in the slim preset.
- Source shading normals follow the deformation derivative. Coincident UV-seam
  vertices share masks and weights; fitted layers use welded geometric normals
  for their offsets. Atlas material checks keep long hair out of clothing, and
  geometric cuff cuts avoid jagged skin-weight boundaries.
- **13 mathematical tests; 56 body cases, 40 age/face cases and 36 clothing
  combinations** across the two candidates. GLB reload compares the dressed
  bind pose and three animated frames, preserving all 24 bones and three textured
  meshes. Version 2 recipes, version 1 migration, per-model persistence, global
  history/comparison, keyboard tabs, reduced motion and 390px layout are covered
  by `node dev/model-studio-check.cjs`.
- The [retained report](../assets/studies/model-studio-check.json) records exact
  metrics and resource counts. Manual front/profile/back and close-up reviews
  cover Slender, Full, older appearance, Game heroine, tee/jeans and long sleeves.
  The lighter T2 source retains visible facial/atlas artifacts. Age treatments
  remain stylized; authored age textures and broader facial sculpting are open.
- No paid API or image-generation jobs in this pass. Main companion geometry and
  saved looks remain separate; these are study tools pending production adoption.

2026-10-05, initial editable studio (superseded by the checks above):

- Second T2 trial: 15,052 triangles, one material, 24 disconnected components
  after positional welding; only the main component reaches below the head.
  Body/clothing remain connected. Rigged for 20 credits including generation.
- Model studio: **6 math tests + 46 geometry/edit cases** pass across both assets,
  including both combined extremes, zero cumulative reset error and grounded
  height changes. GLB exports reload with textures/24 joints and match neutral
  and three animated bounds within 0.2 mm. JSON recipes, per-model persistence,
  undo/redo, original comparison, reduced motion and 390px layout pass.
- Two complete model/surface cycles keep GPU counts at **3 geometries / 4
  textures**. No browser/shader errors. Measured local edit times are recorded in
  the current report; they are machine-specific.
  `node dev/model-studio-check.cjs` reproduces the browser checks without API calls.
- The source inspector also passes **7 assets × 5 surfaces × 2 cycles**, with
  stable GPU counts and no browser errors. [Source report](../assets/studies/asset-study-check.json).
- Imported bind normalization fixes the metre/centimetre mismatch before editing.
  Linear texture sampling reduces pale atlas-edge flecks; padded UV islands and
  authored topology remain open. Walking is a rig preview, without the main
  companion's contact/collision solver. Studio drafts do not replace saved looks.

2026-10-05, Meshy study (separate from the production renderer):

- Generated, downloaded, remeshed and rigged one original-reference candidate for
  **40 credits**, with all artifacts retained locally before API expiry.
- Four GLBs × five surface modes × two inspection cycles pass, including walking
  scrubbing/playback, camera controls, reduced motion and 390px layout. No browser
  or shader errors; GPU counts stable at 3 geometries / 4 textures after fixing
  skeleton-texture disposal. Run `node dev/asset-study-check.cjs`.
- The 24-joint rig has valid normalized weights, maximum sum error below
  0.00000018. The original sculpt is one connected component at a 0.00001-unit
  weld tolerance. These findings explain why model/garment separation and a
  richer animation rig are still required. See the [full study](../assets/studies/meshy-hime-v1/README.md).
- The local API helper's dry-run, duplicate-submission and budget guards were
  exercised with a mocked API; no extra paid jobs were created by validation.

2026-10-04–05, current body, clothing and renderer implementation:

- All **16 mathematical tests** pass: arm lengths and clearance across presets
  and morph limits, pose transitions, roomy sleeves, morph bounds, spring
  stability, independent belly controls, local armpits, hair settling/contact and
  30/60/120 Hz agreement; also leg IK, clavicles, corrective symmetry/bounds,
  dual-quaternion probes, local cup volume, extra fullness and garment validation.
  Run `node --test dev/avatar-math.test.mjs dev/avatar-foundation.test.mjs`.
- Browser controls pass: Hime/oval and bikini defaults, all four archetypes,
  belly/nails, inspection and rendering quality, mouse/keyboard shaping, undo/redo,
  persistence, older saves, PNG snapshots, pop-out/return, touch pinch/cancellation,
  and 320/390px layouts.
- The revised renderer matrix passes **96 items over two wardrobe cycles,
  22 poses across five body presets, 40 hair/face combinations and eight skin
  tones**. No JavaScript or shader errors were reported. Geometry/texture counts
  stayed at 61/45 after each cycle. Rendered arm joints match solver joints to
  floating-point precision. Run `node dev/avatar-browser.cjs` with the server up.
- **96 support combinations** cover five presets, both height limits, a fuller
  body, three shoe configurations and standing/elegant/stretch/seated poses.
  Maximum floor error is below 0.000001 m, seat error below 0.000027 m and leg
  length error below 0.000001 m. These verify contact and length, not art quality.
- `node dev/avatar-customization.cjs` passes all ten new clothing patterns,
  independent cuts/palettes/fit, cup/fullness controls, all three persisted
  finishes and tailored saved looks. Mouse, touch and keyboard orbit/zoom work
  independently of sculpting; leaving the editor restores the normal camera.
- The same customization suite passes **60 skirt/dress fabric/finish cases**,
  checking that all regional fit controls change geometry. Two cycles with
  different colors retain 63 geometries / 43 textures. Basics lists all eleven
  templates; signature palette restoration preserves other tailored patterns.
- Body/hair off settings, dynamic reduced-motion changes and failed-model SVG
  fallback also pass. The long-hair default settles within the bounded guide
  displacement; this check does not prove collision-free hair in every pose.
- Visual inspection covers the default figure from front and side, hand detail,
  abdomen editing, overhead stretch, the three finishes, crop-top fit and a
  fuller body in an oversized sweater and jeans. This does not yet
  constitute complete art acceptance for every archetype and morph combination.
- The final loose-top envelope revision was checked in 30 combinations of five
  presets, two tops and three poses, without JavaScript or shader errors. Front
  and profile views confirm smoother under-chest shading; extreme underarm drape
  and authored fabric folds remain art work rather than solved cloth physics.
- Current screenshots are generated into the system temporary directory's
  `bijou-checks` and `bijou-customization` folders by the browser checks. They are
  review artifacts, not golden images or a claim of final anatomy/material quality.
