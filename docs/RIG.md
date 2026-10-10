# The rig contract

Every subsystem in Bijou meets at one interface: the rig. The body, the face, the hair,
each garment generator and the behaviour engine all speak it, so it changes only by an
edit to this file first. Everything else in the project can be refactored cheaply; a
change here touches every drawing.

## 1. Space

- The live character uses a skinned 3D model through `avatar.js`. Its default
  `anime3d` finish uses softly grouped shadows across skin, hair and fabric;
  `anime2d` uses crisp cel bands and `realistic` uses physical surface shading.
  The finish is a saved look property, independent of rendering resolution.
  The logical 400 × 820 coordinate space below remains the shared contract for
  poses, pointer gestures, effects and the SVG fallback. An orthographic camera
  maps that space onto the model; model units are metres, with +Y up and +Z front.
- The 3D adapter maps outward-positive pose angles onto humanoid bones, uses
  morph targets for facial expressions, and keeps garments on the same skeleton.
  A real Y-axis turn replaces the SVG's horizontal squash during a twirl.
- `createAvatar(svg)` preserves the doll interface and exposes `ready`,
  `hitTest(clientX, clientY)` and `capture()` for the canvas renderer. The SVG
  stays available if WebGL or model loading fails. Its screen transform remains
  the coordinate bridge used by interactions and speech, including in pop-out.
- All outfit slots remain editable. The base garment must cover the torso and
  pelvis even when every wearable slot is empty. Model assets and rendering
  dependencies are served locally with provenance in `assets/ATTRIBUTION.md`.

### Imported asset studies

`dev/asset-study.html` is an isolated GLB inspection scene. It preserves imported
topology, materials and skeletons; display normalization changes only an outer
group. Generated candidates in `assets/studies/` do not replace the VRM adapter,
body morphs, garment system or saved looks. The study can compare lighting,
wireframes, skeletons and source animations before any integration is accepted.
API keys and raw task responses live outside the served project.

`dev/model-studio.html` edits copies of the two imported Meshy candidates. Its
adapter has an explicit **+Z-front, +Y-up, metre** space, normalized to 1.68 m
before edits. This differs from the VRM's raw -Z-front space. Bounded, smooth
regional fields deform the original rest vertices, never the previous edit.
The adapter first resolves imported skin/bind transforms into mesh-local rest
vertices, including Meshy's centimetre Armature with metre vertex coordinates.
Bone transforms are restored before reshaping and rebinding. Head, hands and
feet retain their local proportions; limb volume edits taper before joints.
Imported weights mask torso edits away from the arms and head. Hair and the
opaque outfit remain part of the candidate, with the same shaping field.

The public Hime studio presentation replaces the fused, damaged generated head
with the existing CC0 anime face asset. A head adapter compacts its material
primitives, resolves the source skin into rest metres, turns -Z front to +Z,
and binds those surfaces to the study's Head joint. Its eye/mouth/chin landmarks
calibrate the same face fields and gaze controls; UVs, alpha edges and authored
normals remain intact. The original study files and raw inspector are unchanged.
The adapter removes only the old head/outer hair; the body and its covered base
remain the source model. A short fitted neck transition joins the two surfaces.
Studio comparison shows base proportions and palette on this same clean head.
The earlier Game heroine head remains available as a separate original-face
candidate, with its own draft; replacing Hime's head must not delete that option.
Sculpted hair uses overlapping shallow locks with root coverage and fine tips;
the crown follows the head rather than adding a second oversized helmet.
Lock roots sit inside the crown, with narrower closed ends to avoid floating caps.
Rest guides clear the forehead and the fitted torso before secondary motion;
body changes refit that rest silhouette. The studio's Hime idle presentation
lowers the upper arms slightly using the existing bind pose. Walking retains its
source tracks, and export retains the same skeleton/bind relationship.
The clean anime head uses its authored left/right blink deltas, transformed by
the same face/height fields. Its skin and lash lines close together. Manual gaze
moves its iris/highlight surfaces; automatic blinking remains a preview effect.
The old head is clipped at a central neck plane that rises outside the neck
to preserve the shoulder caps, interpolating UVs, normals and normalized skin
weights at cut edges. Fitted tops use smooth geometric
necklines and sleeves; atlas color noise must not cut holes into their edges.
The crew neckline rises toward the shoulders instead of truncating arm caps.
Its back is higher than its front, covering the old rear collar while keeping a
round front opening. Known body surfaces cannot receive the dark-pixel hair tint.
Fully covered triangles of the original fused outfit are hidden while fitted
layers are selected, so their inner surfaces cannot bleed through collars.
The complete base index remains immutable for fitting, normal repair and export
baking; restoring the source outfit restores its visibility. Hair toggles leave
this cleaned body's clothing visibility alone. Partial cut triangles retain base
coverage, and no skin beneath the original clothes is synthesized.
After clipping, disconnected old-hair components are discarded by welded
connectivity, location and their dominant material, preserving the main body
shell. Individual dark atlas-border triangles must not be cut from that shell.
This cleaned body no longer uses atlas hair masking for visibility or garment
coverage: unpadded UV borders must not remove body triangles or tear a shirt.
Fresh Hime drafts use the balanced Figurine body with Hime hair and Oval face;
existing drafts retain their body settings.
This does not invent missing skin under the covered source outfit.
Covered source fabric follows the selected top/bottom palette under fitted
layers. A shared rest-space cloth hint also repairs gray atlas margins, so seams
cannot expose a differently colored base. Preview and atlas export share it.
Atlas export preserves straight alpha from the face/lash/highlight maps; color
treatments must not turn transparent feature edges into opaque polygons.

Walking is a diagnostic preview: positional tracks are adjusted to the edited
rest translations and rotations are retained. It is not the companion's IK or
collision solver. Editing returns to the rest pose; playback is off initially
and respects reduced motion. Export includes the changed bind pose, weights,
textures, and adjusted clip. Preview-only shading is not baked into the GLB.
Studio drafts use a separate versioned local store per candidate; they never
overwrite companion looks. Missing face/finger rigs, underlying covered anatomy
and independently constructed garments remain adoption blockers, not features
supplied by these body fields.

Studio refinements keep body size, adult age appearance and face style separate.
The size field includes a shared build parameter and a ribcage envelope for a
flat chest; it preserves the back rather than subtracting a fixed front offset.
Adult appearance presets (20s through 60s) are stylized face treatments, not an
age prediction. Face proportions affect the face surface only, before the shared
body/height field; head bones and hair attachments retain their original shape.
The oval remains the default. A game-heroine option interprets the requested
Tifa Remake reference; it is not an imported Square Enix model.

Studio clothing is an opaque, fitted surface layer with independent top/bottom
settings, colors and ease. It inherits source skin weights and refits after shape
changes. Existing atlas clothing remains a covered base; there is no fabricated
skin surface beneath it. New pieces can extend coverage over exposed skin, but
cuts cannot uncover anatomy missing from the source. Clothing geometry and
materials are included in GLB exports; its preview finish is shared with the body.
Authored shading normals follow the deformation Jacobian. Clothing offsets use
welded geometric normals instead, so UV seams do not split when fabric moves
outward. Coincident source vertices share deformation masks and skin weights.
Garment classification samples inside UV triangles to avoid gray atlas borders;
material checks exclude long hair even when it inherits torso bone weights.
Sleeves and trouser hems follow geometric cut lines, not bone-weight thresholds.

Appearance and clothing settings join body parameters in versioned studio recipes
and history, with migration from older shape-only drafts.

The figurine refinement adds separate upper-arm and forearm lengths. These act
along the imported shoulder–elbow–wrist segments, move the bind joints and fitted
sleeves together, and translate the hands without enlarging them. Presets include
limb lengths; length must not be inferred from arm thickness. Height adjustment
follows the edited wrist anchor. Old recipes receive neutral length values.

Sculpted studio hair uses a smooth crown and tapered, rounded locks attached to
the head. A material/position mask omits outer original hair triangles. The fused
fringe and temple shell remain intact to protect the face; their dark hair pixels
follow the selected color. Switching back restores the captured source index.
Export bakes that tint to a separate atlas; the immutable source image is retained.
Generated hair has its own colors, silhouette controls and bounded secondary
motion. Hair rest geometry and materials export; runtime motion is a preview.
Eye controls deform the existing eye surfaces with bounded gaze, optional blinking
and head following. Curved lash lines complete the closed-eye silhouette. Anchors
follow the same face/height field. Comparison,
history, recipes, export and reduced motion must include these new settings.
The requested figurine direction is an original adult character interpretation;
the Game heroine treatment stays available separately.

The Aion-inspired studio refinement adds independent, bounded rest-space face
details for proportions, eyes/brows, nose, lips and ears. Neutral details preserve
the existing Oval and Game heroine treatments exactly. Details apply before body
height; eye and lash anchors use that same field. These are geometric edits to
the imported surface, not a replacement facial rig or independent eyeballs.
Skin, iris and makeup controls use rest-space feature masks, shared by preview
and an export-only atlas bake. Source atlases stay immutable. Physical rendering
uses a filtered studio environment, controlled roughness and subtle surface detail;
anime finishes remain available. Material microdetail, light direction, exposure
and background are preview settings; color treatments and edited geometry export.
Version 4 studio recipes/history retain details, surface settings and lighting;
versions 1–3 migrate to neutral details and the existing anime/ivory presentation.
The fantasy-realism starter is an original adult interpretation. Hime/Oval remains
the fresh-visit default. Studio rendering never changes companion look data.
Imported study shading normals receive a local, angle-limited smoothing pass in
rest space to reduce remesh facets. Topology and positions are unchanged. The
repaired normals still follow the edit Jacobian; the raw asset inspector retains
the untouched source. Shadow maps cast onto the floor rather than painting
low-resolution self-shadow bands over the small facial surface.
The recolorable source-hair option keeps the imported sculpt intact and applies
only atlas tint; its length/volume/sway controls are disabled. It is the realistic
portrait starter's hair, while sculpted Hime remains the normal default. Six
adult portrait starts and seeded variations edit only face, surface and hair;
they preserve the chosen body and clothes. Every generated value uses the same
validated schema and joins one undo transaction.
The atlas classifier also supplies a hair hint below the head, allowing source
hair tips to recolor without tinting the original outfit. Lip color/gloss use a
geometric lip mask, while eye gloss excludes dark lash pixels. Physical-only
finish controls are retained in recipes and disabled in cel/clay previews.
Atmospheric fog applies to the studio floor, not the character; zooming out must
not wash out the selected skin, hair or clothing colors.

The portrait cleanup refines shading normals over a wider, angle-limited face
neighborhood and a local quadratic surface fit, preserving fine eyelid folds and
opposing surfaces. The fit uses world-space rest points, excludes hair neighbors,
and fades into the authored normal at the face boundary. It does
not move rest vertices or alter the source GLB. Semantic skin/hair hints repair
gray atlas margins without recoloring clothing. A saved eye-surface restoration
amount blends a clean sclera, iris and pupil treatment into the existing opening;
the masks follow the same rest-space gaze/deformation contract and export bake.
This is a restored eye surface, not independent eyeballs or a cornea rig.
Hair surface detail and roughness are saved finish properties independent of
hairstyle geometry. Realistic lighting can soften diffuse falloff through a
bounded light-wrap approximation; this preview effect is not volumetric or
screen-space subsurface scattering. New v4 fields receive validated defaults in
older recipes. Color and roughness treatments export; diffuse light wrap does not.
Imported tangent directions must agree with the edited shading normals and UVs.
Body/face edits regenerate them from the full source index before any hair index
mask is restored. Gaze/blink derivatives transform the captured tangents and
orthogonalize them against the edited normal, retaining UV handedness. Preview
and exported tangent-space normal maps use these same updated directions.

The adult anatomy study uses pinned MakeHuman CC0 base topology and its default
weight data, with the adult female target. Helpers are omitted from rendering.
Its visual result was rejected by the user. It is withdrawn from the model
picker and public model links; the source and its separate saved drafts remain
available to development checks. Technical checks are not art approval.
A preparation tool aligns the spine/leg depth centers, adds separate eye surfaces,
hair and opaque base garments, and bakes a relaxed arm rest pose before export.
The 163-joint hierarchy retains face/finger joints but does not imply a completed
face/finger animation editor. Its clean source normals bypass remesh repair.
Source metadata calibrates face landmarks and eye radius in the same normalized
rest space; an eye-surface attribute keeps iris paint off the real eyelids.
The independent eyes rotate about their calibrated joints. This source uses
curved upper/lower lid covers for blinks, with a skin material and a closed lash
line, rather than flattening its globe or dragging neighboring nose vertices.
The covers follow the same face/height fields and source skin albedo; automatic
blinking stays a preview effect. A chosen wink exports as a static closed-eye
surface with its skin color and roughness baked by the shared atlas shader.
The original body is continuous beneath its separate garments. Base coverage
remains mandatory. Studio shape, face, clothes, history and export still use the
shared fields. No walking clip is invented for this new source. The existing
Meshy candidates, draft keys and Hime/Oval fresh-visit default remain available.
On this continuous source, upper clothing cuts use geometric neck/shoulder
boundaries. A bounded front envelope bridges small chest contours beneath
cotton/knit, without modifying skin; sleeve/hem geometry keeps the same skin
weights. Garment normals regenerate and weld after that fit adjustment.
Generated hair on the anatomical source sizes its approximate torso collider
from the edited body extents during fit; these bounded ellipsoid contacts still
require visual acceptance and do not constitute strand/body collision parity.

### Logical coordinates and SVG fallback

- One SVG, `viewBox="0 0 400 820"`, `preserveAspectRatio="xMidYMax meet"`.
- Front view only. `x = 200` is the body's centre line; the ground is `y = 790`.
- **Screen sides**, never the doll's own left and right: `L` is screen left, `R` is screen
  right. A drawing helper takes `s = -1` for `L` and `s = +1` for `R`, and writes
  `x = 200 + s * dx`, so one function draws both sides.

## 2. Measurements

`measure(body)` in `js/rig.js` turns the body choices into one frozen object `M`. Every
drawing reads landmarks from `M` and never hardcodes a body coordinate, which is what lets
a garment fit every height and build without a second drawing.

| Field | Meaning |
|---|---|
| `ground, ankleY, kneeY, hipY, pelvisY, waistY, chestY, shoulderY, chinY, headTop` | landmark heights, computed from the ground up so the feet never leave it |
| `w` | width factor from `build`, 0.9 to 1.1 |
| `torsoHW(y)` | the torso's half width at height `y` (piecewise, see `rig.js`) |
| `shoulder, elbow, wrist, hip, knee, ankle` | joint pivots per side, `{ L: {x,y}, R: {x,y} }` |
| `upperArm, foreArm, thigh, shin` | bone lengths |

`body` contains `height`, `build`, `skin`, and nine bounded regional morphs:
`shoulders`, `armpits`, `bust`, `torso`, `waist`, `belly`, `hips`, `arms`, `legs`. Each region has a width
value and a matching `*Depth` value, all 0..1 with 0.5 neutral. `bounce` (0..1)
and `damping` (0..1) control secondary motion. Missing fields in older saves
receive defaults. Presets only replace shape fields, preserving skin and height.
The belly additionally has `bellyUpper`, `bellyLower`, and `bellyHeight` (0..1,
neutral 0.5). Its front-only shape field blends the upper and lower abdomen,
preserves the spine and back, and moves the fitted clothing with the skin.
Armpit width and depth adjust a smooth local field below each shoulder socket.
Cup volume, spacing and lift are separate front-only controls (`bustVolume`,
`bustSpacing`, `bustLift`), preserving the ribcage, spine and upper chest.
Torso, waist, belly, hips, arms and legs also have independent `*Fullness` values
from 0..1 (zero neutral), extending the positive regional range. Garments and
collision envelopes use the same field at the extended sizes.
`nailLength` (0..1), `nailShape` (natural, round, almond, square), and `nailColor`
are independent details. Nail surfaces sample the fingertip surface and share
its bone weights, keeping the plates on the skin during finger articulation.
`archetype` selects an adult companion's starting proportions, posture and
mannerisms (elegant, bright, athletic, gentle). It never replaces the selected
face or outfit; every regional control remains editable after a quick start.
Hair motion has separate strength, stiffness and damping in the head config;
anchored strand chains constrain segment lengths and collide with head and torso.
The discarded source hairstyle's spring manager is disabled; retained bangs stay
attached to the head. Generated locks use the shared guide solver, including its
pause and reduced-motion rules, so rebuilding clothes cannot kick the bangs.
Displacement bounds can take precedence over contact at extreme intersections;
these are guide chains, not a full strand or cloth simulator.

The 3D morph field deforms the rest surface, garment envelopes, attachment
positions, and skeleton bind pose together. Face and feet retain their proportions.
Garment color masks continue to use the original `bjRest` coordinates. Colliders
are rebuilt from the same field, including an allowance for clothing and bounce.
The SVG fallback reads regional widths from `M`; depth is a 3D-only property.

The animation baseline refines the body surface once at load, carrying UVs and
bone weights onto the smoother topology. Body and fitted garments use blended
dual quaternions for joint rotation and translation, with shared shadow skinning.
The stage retains a fixed 1.14 X / 1.04 Z proportion adjustment, with height mapped
to 0.94..1.06 Y scale. Skinning strips that stage transform before decomposing
bone matrices, avoiding shear from world-space nonuniform scale. Editable regional
proportions live in the morph field. Face variants reshape the source face mesh;
the source expression blend shapes remain available without variant-specific
corrective expression targets.
Hime with the existing oval face is the default; the other faces remain available. Generated hair
has a closed crown, an overlapping back volume, and continuous sculpted locks.

The figure uses adult anime proportions, approximately seven heads tall. Canonical
head art is scaled by `HEAD_SCALE = 0.76` about the chin. The default thigh and shin
lengths are 180 and 177; shoulder pivots are 50 units from the centre, adjusted by
build. Garment shoulders must read `M.shoulder`, never an independent fixed width.
The chest, waist, hips and limb widths form one continuous, softly tapered silhouette.

## 3. Bones

The hierarchy below is the logical/SVG rig. The VRM adapter uses its humanoid
hierarchy, keeps spine scale rigid, and maps the logical pose onto that skeleton.
The shoulder girdle participates in reaching: clavicles lift and move forward
smoothly with arm elevation before the arm IK solve. Four relative corrective
targets (left/right underarm and hip crease) are rebuilt after regional shaping
and driven by actual joint angles. Body, fitted garments and shadow passes use
the same correction weights. These local corrections leave the head unchanged.

The logical root carries interpolated `plant` and `seat` weights. `root.airborne`
temporarily releases floor contact for dragging, falling and hopping. The 3D
adapter levels the feet and solves each leg to its floor target without changing
bone lengths. Seated support uses the displayed body's lower pelvis and the
pouf's top surface; the SVG fallback retains its logical seating coordinates.

A bone is `{ name, parent, pivot }`, with the pivot in rest coordinates. Rest pose is
straight limbs pointing down. `rig.js` exports the table; nothing else defines a bone.

```
root (pelvis)            translate, rotate, scaleX (the twirl), scaleY (the landing squash)
├─ spine (waist)         lean, breath scale
│  ├─ neck → head        roll; the head also carries yaw and pitch for parallax
│  │        ├─ hairBack  spring, keeps long hair hanging under a tilted head
│  │        ├─ tailL, tailR, tailC, ahoge   springs
│  ├─ upperArmL → foreArmL → handL
│  └─ upperArmR → foreArmR → handR
├─ skirt (waist)         scale for flare and for sitting
├─ thighL → shinL → footL
└─ thighR → shinR → footR
```

**Angles are outward-positive per side.** `0` points down, `90` points away from the
body, `180` points up, negatives cross the body. The rig converts to SVG rotation with
`actual = -s * angle`, so a pose is written once and is symmetric by default.

A child angle is relative to its parent. `scaleY` on a bone is foreshortening (a seated
thigh pointing at the viewer is `0.3`).

Forward kinematics runs once per frame and produces one matrix per bone. A drawn piece
gets its bone's matrix as a flat `transform="matrix(...)"`; pieces are **not** nested, so
any piece can sit at any depth.

## 4. Pieces

Every drawing function returns an array of pieces.

```js
{ bone: 'upperArmL', z: 310, svg: '<path .../>', depth: 0, item: 'top-stripe-tee', fixed: false }
```

- `svg` is markup in **rest coordinates**, drawn as if the limb hangs straight down.
- `depth` is head parallax, `-1..1`: features `1`, bangs `0.7`, back hair `-0.6`.
  Ignored on bones outside the head.
- `item` marks a garment piece so the doll can be inspected and the thumbnail can crop.
- `fixed: true` opts a piece out of the arm band shift (a parasol canopy stays behind the
  doll whatever the arm does).

### Depth bands

Paint order is `z`, ascending. Arm pieces are written in the 300 band; a pose moves each
arm's whole band with `band: { L, R }`.

| z | Region | Contents |
|---|---|---|
| 5 to 9 | behind all | prop backs, hat brims behind the head, parasol canopy |
| 10 to 19 | hair back | back hair 12, buns 13, tails 14, tail ties 15 |
| 20 to 29 | garment backs | the inside of a skirt 24, hoods 26 |
| 300 band − 270 | arms, `back` | an arm posed behind the body |
| 100 to 149 | legs | skin 100, legwear 110, shoes 120, trouser legs 130 |
| 150 to 249 | torso | skin 150, base slip 160, swim 170, bottoms 180, tops and dresses 200, neckwear 220, outerwear 230, bibs 235 |
| 300 to 349 | arms, `mid` | upper 300, fore 301, held item 302, hand 303, sleeves 310 to 312, outer sleeves 320 to 321, gloves 330, bracelets 332 |
| 395 to 479 | head | ears 399, skin 400, bang shadow 405, features 410, side locks 440, glasses 445, bangs 450, brows 452, hats 460, hair accessories 470 |
| 300 band + 200 | arms, `front` | a hand in front of the face |

## 5. Slots and conflicts

| Slot | Removes when equipped |
|---|---|
| `dress` | `top`, `bottom`, `swim` |
| `swim` | `top`, `bottom`, `dress` |
| `top`, `bottom` | `dress`, `swim` |
| `outer, legwear, shoes, hat, hairacc, neck, glasses, held` | nothing |

**The base slip is not a slot.** It is drawn whenever neither `dress` nor `swim` is
equipped and the slot it would show through is empty. There is no state of the doll with
less than the slip or swimwear on, and no control that produces one.

## 6. Poses

A pose is data in `js/poses.js`:

```js
{ id, label, arms: { L, R }, legs: { L, R }, spine, neck, head, root: { x, y, rot },
  hands: { L, R }, band: { L, R }, skirt: { sx, sy }, expr, prop, loop(t) }
```

- An arm is either angles `{ upper, fore }` or an IK target `{ to: [landmark, dx, dy],
  bend: 'out' | 'in' }`, solved against `M` so the hand lands on the face or the hip at any
  height.
- `loop(t)` returns additive angles for motion inside a held pose (waving, swinging feet).
- The motion layer blends toward the target pose and adds procedural layers on top
  (breath, sway, look-at, springs). Procedural layers never write into the pose.
- For 3D, each hand also carries a rest-space target (`tx, ty, tz`) and elbow
  pole (`px, py, pz`). These interpolate with the pose. Raw VRM0 rest coordinates
  face -Z; the model scene turns them toward +Z for rendering. A two-bone solver
  preserves arm lengths, limits folding, and checks arm capsules against torso,
  pelvis and head ellipsoids, plus the other arm. Rear targets are explicit.
  Capsule clearance uses the closest point along each scaled segment, so a
  collision cannot hide between sampled points during a pose transition.
- Secondary motion uses bounded, fixed-step damped springs. Skin and garments
  share the same displacement field, including shadow passes. It settles to zero,
  pauses in Shape mode, and is disabled when reduced motion is requested.
- Shape mode is separate from play gestures. Region selection, mouse dragging,
  touch pinching, and accessible sliders all change the same validated morph
  values. Front/profile/back views, per-region reset and transaction-based
  undo/redo belong to this mode. Pointer cancellation restores the prior shape.
  Selecting a region frames that zone. Orbit/zoom is an explicit camera tool with
  mouse, touch and keyboard controls. Leaving the body editor restores the normal
  camera and companion behavior; inspection never changes saved pose data.

## 7. Garment items

An item is data in `js/catalog.js`; its drawing is a generator in `js/wear-*.js`.

```js
{ id, name, slot, kind, params, colors: { main, trim, accent }, pattern, tags, unlock }
```

`kind` names the generator. `unlock` is `{ hearts: n }`, `{ free: true }` or a milestone
`{ milestone: id }`. `tags` feed her style requests (`cozy`, `beach`, `party`, ...).

Template items additionally name a `template`. The saved `garments` dictionary
holds validated per-item color, fabric, cut and fit settings. A resolved item
combines that template with its saved parameters; catalog prototypes are immutable.
Top length, sleeve length, neckline, trouser rise/length, skirt flare and regional
ease drive both the fitted envelope and the rest-space coverage mask. The shared
body field first shapes the skin. Garments are then fitted to that shaped surface,
including extended fullness; their allowance never changes which body region a
vertex belongs to. Front panels bridge the chest using the shaped torso envelope;
larger ease relaxes the under-chest contour toward the hem before adding allowance.
Stretch controls fabric tension detail; it is not a cloth simulation.
The permanent opaque base layer still covers an otherwise empty torso/pelvis.
SVG fallback honors template colors and approximate cuts; fine surface detail,
regional ease and finishes belong to the 3D renderer.
Coverage masks also drive the body/fabric shadow passes. The skin is retained
under garments so open cuffs and necklines have a continuous underlying surface.
