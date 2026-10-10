# Archetype investigation and animation baselines

Updated 2026-10-05. This is a working design and research record for the desktop
companion, linked from the [request ledger](COMPANION-ROADMAP.md). The four current
profiles are editable adult character starting points. They do not prescribe a
face, outfit, age, or personality based on body shape.

## Current quick starts

These values describe the implementation in `js/archetypes.js`. Height and other
body sliders are normalized 0..1, not measured centimetres. Tempo is a relative
animation multiplier, not a scientifically established personality trait.

| Profile | Starting body | Height | Rest posture | Motion direction | Current idle preferences |
| --- | --- | ---: | --- | --- | --- |
| Elegant | Slender, with moderately fuller hips and legs | 0.78 | Poised, relaxed asymmetric arms | 0.72 tempo; restrained head motion and finger curl | Thinking, humming, sitting, hands behind |
| Bright | Balanced and compact | 0.28 | Relaxed | 1.18 tempo; more expressive small movements | Waving, admiring, humming, stretching, occasional twirl |
| Athletic | Broader shoulders and stronger limbs | 0.62 | Balanced stance | 1.00 tempo; controlled head and hand motion | Stretching, hands at hips, thinking, humming |
| Gentle | Softer torso, abdomen and limbs | 0.42 | Composed, reserved stance | 0.78 tempo; quieter head/finger movement | Shy gesture, humming, sitting, thinking |

The user’s “onee-sama” reference informs Elegant’s composed movement direction.
The lively reference informs Bright’s animation energy. These are art-direction
interpretations, not researched categories of human anatomy. Each quick start
preserves the existing Hime/oval face or any other chosen head, nails and outfit.
Changing a regional slider remains possible after applying a profile.

## Findings that affect the design

**Save authored poses and blend them.** Blender’s pose-library workflow supports
reusable pose assets and blending. Our application should likewise retain a
small reviewed pose library, with restrained additive idle motion layered on top.
That is a design inference; random noise alone does not establish convincing
character acting. [Blender pose library](https://docs.blender.org/manual/en/4.4/animation/armatures/posing/editing/pose_library.html)

**Retarget for proportions.** Autodesk documents transferring animation between
different skeleton proportions and modifying it through animation layers.
Its retarget controls separately address scale, hip height, foot spacing,
floor contact, neck motion and elbow/knee extension. This supports testing each
pose against each body, rather than assuming a shared pose label guarantees the
same silhouette. Bijou now retargets the arms and legs, measures floor/seat
contact and moves the clavicles. Whole-body balance through arbitrary authored
poses still needs investigation.
[Maya retargeting](https://help.autodesk.com/cloudhelp/2023/ENU/Maya-CharacterAnimation/files/GUID-B2E9F8B9-F188-4E27-8820-BB0C8541701F.htm)
· [Retarget controls](https://help.autodesk.com/cloudhelp/2022/ENU/Maya-CharacterAnimation/files/GUID-EB2A8BB0-801E-4251-8C4C-09986049CCBB.htm)

**Separate form from performance.** The current quick-start button applies a body
and a mannerism profile together. A later profile editor should allow choosing
movement style independently, then previewing it before applying it. This is our
proposed product design, not a feature already exposed in the interface.

**Keep detail levels independent.** Light, Balanced and Detailed currently change
render resolution and shadow quality. They all use the same refined body mesh.
Additional anatomical detail, artist-authored corrective shapes, texture maps and mesh
levels of detail are separate investigations; changing a quality button does not
create them.

## Investigation queue and acceptance criteria

| ID | Investigation | Deliverable | How to assess it |
| --- | --- | --- | --- |
| A-01 | Natural support and silhouette | Front/side/back contact sheets for four resting profiles, at height and width limits | Feet grounded, pelvis supported, knees soft, shoulders relaxed, no forced arm spreading |
| A-02 | Joint deformation | Pose-dependent corrective shapes for shoulders/armpits, elbows, hips and knees | Raised-arm, reach-across and seated close-ups; inspect pinching and lost volume, not only collision numbers |
| A-03 | Proportion-aware pose library | Reviewed relax, greet, think, stretch, sit and turn poses per profile | Consistent intent across bodies; no foot sliding, wrist snapping or hidden rear-hand shortcuts |
| A-04 | Small acting gestures | Authored finger uncurl, head acknowledgement, glance-away, weight shift and hair settling | Preview over 60 seconds; avoid constant fidgeting, synchronized sine waves and repeated loops |
| A-05 | Personality controls | Independent tempo, expressiveness, activity and gesture preferences | Change mannerisms without changing anatomy, hairstyle or clothing; persist and undo settings |
| A-06 | Hair under motion | Turn, stretch and shoulder-contact study across ten styles | Designed rest silhouette retained; roots anchored; bounded settling; no persistent face/shoulder intersections |
| A-07 | Model and material detail | Compare neutral-light turntables with the supplied figurine reference | Continuous abdomen/hip contours, clean underarms, attached nails, smooth highlights and matching face/body skin |
| A-08 | Desktop runtime | Performance and power measurements on integrated graphics, multiple DPRs and pop-out | Establish a measured frame-time budget before adding denser geometry or simulation cages |

Do not declare these visual investigations complete because the solver tests pass.
Record the implementation revision, view, pose, body extremes and visible defects
alongside results. User feedback on each baseline remains part of refinement.

## Current implementation evidence

On 2026-10-05, A-01/A-03 gained length-preserving leg IK, measured floor and seat
support, forward knee poles and lower relaxed arm targets. The browser support
matrix passes 96 body/height/shoe/pose combinations; maximum seat error is below
0.000027 m. A-02 now has four bounded procedural underarm/hip targets and moving
clavicles, with pure tests for symmetry and bounds. Elbow/knee corrective sculpts
and the complete authored pose library remain open.

A-06 now uses one owner for hair motion: anchored generated guides. Retained
source bangs follow the head. Disabling the original source spring manager fixed
fringe recoil on outfit rebuilds and makes reduced-motion behavior consistent.

A-07 now has shared anime shadow treatment and three selectable finishes; see
[look development](LOOK-DEVELOPMENT.md). Current visual review covers Hime/oval,
front/profile standing, seated contact, crop-top fit and fuller proportions in
an oversized sweater and jeans. Remaining concerns include extreme underarm
drape, close-up fingers/nails and hand-authored surface detail. A-04/A-05/A-08
remain studies; the new solver checks do not close their acceptance criteria.
