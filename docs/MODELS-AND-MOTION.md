# Complete models, motion and physics

Researched **2026-11-02/03** for request R-39..R-42 (see
[COMPANION-ROADMAP.md](COMPANION-ROADMAP.md)): retake the 3D model and
animation work, develop or source cute complete models and animations,
animate them, allow customization and tools, with lots of physics. Six
studies (models, creating our own, animation, physics, dress-up, desktop
companions) and one license verification per candidate. Sources are the
creators' own pages, terms and repositories, read on those dates. This is
research, not legal advice. The full record, with verbatim licence quotes, the
part-by-part physics table, bone maps and a phased build plan, is
[research/2026-11-03-complete-model-memo.md](research/2026-11-03-complete-model-memo.md).

## Summary

The runtime is no longer the gap. `js/vrm-*.js` and the Doll Lab play any
VRM with its authored springs, VRMA clips, gestures and touch physics. The
gap is a **complete, cute model and motion we may ship**, and the deciding
constraint is licensing, not code:

- pixiv's VRoid Studio Terms (Art. 7 and 13(3), Japanese text prevails)
  withhold the right to use VRoid's provided content, or any model containing
  it, in an app that creates avatars by deforming meshes or combining meshes
  or textures, without a separate pixiv licence; personal use is exempt and a
  public site is not. Bijou's body editor, clothing editor, mix-and-match and
  GLB export are that kind of function.
- So a model made in VRoid Studio (including one the owner makes) can ship
  only as a fixed character (animation, physics, expressions, whole-outfit
  swaps) unless pixiv grants that licence.
- Even the current base, pixiv's CC0 β AvatarSample_4 (Victoria Rubin), is
  open on this point. CC0 settles copyright, but pixiv's Japanese article adds
  that using the VRM requires agreeing to the VRoid Hub Terms, and Art. 13(3)
  applies "notwithstanding" per-item licences. Whether those terms bind a copy
  taken from a third-party mirror is a legal question.
- CC0 models **made in Blender** carry no VRoid content and allow everything
  Bijou does: lowteq's Shapell family and HENGE's Mizunashi Hiyori and
  Himiko 2022 verified as CC0 on their authors' pages. None states an age, so
  each needs the owner's adults-only judgment from the previews.

## What is built

| Piece | Where | Evidence |
| --- | --- | --- |
| Model-agnostic loader (VRM 0.x and 1.0, licence metadata) | `js/vrm-runtime.js` | Lab shows embedded licence fields |
| Motion layers: clips, idle, gestures, gaze with saccades, petting, dozing, case-insensitive expressions | `js/vrm-motion.js` | `node dev/lab-check.cjs`; `node --test dev/vrm-motion.test.mjs`: held keys, pauses, loop restarts and fades show on every bone, every frame |
| Behaviour (Phase 0b): per-bone priority with faded handoffs, idle scheduler and event hooks, AIRI pats, clips evaluated from their tracks | `js/vrm-motion.js`, `js/vrm-idle.js`, `js/vrm-touch.js`, `js/vrm-eyes.js`, `js/vrm-clips.js` | `node dev/behaviour-check.cjs`: dozes 61.2 s after the last attention, 10 of 10 strokes pat (3 to 5 pats each), 10 of 10 drags carry, the head yields to a tilt (33.4 to 19.6 degrees and back) |
| Clip retargeter (Mesh2Motion/UE4 and Mixamo bone maps, A-pose into T-pose, hips scale, VRM 0.x) and a VRMA writer, with a page for files from disk | `js/vrm-retarget.js`, `js/vrma-writer.js`, `dev/retarget.html` | `node --test dev/retarget.test.mjs`: bones point within 0.0001 degrees of synthetic sources; written VRMA reloads key for key |
| Spring controller on three-vrm's own manager: presets, wind, fixed 60 Hz substeps with the rig (root, lean, squash) interpolated across them, proxy center (Carry swing), body cap and Bounce, touch impulses, NaN recovery, a drag floor of 0.12, per-chain variation, cone limits on hair | `js/vrm-physics.js`, `js/vrm-limits.js` | `node dev/physics-check.cjs`: after a hop the longest hair chain swings 3 times after landing at 30, 60 and 120 fps and settles in 0.47 to 0.49 s (was 2 to 3 swings, 0.50 to 0.59 s); body moves 0.2 mm under a touch that moves hair 2 cm |
| Whole-body rig: carry, toss, landing bounce, squash, lean, twirl, as exact damped springs with closed-form flight | `js/vrm-body.js`, `js/spring-damper.js` | squash and lean curves identical at 30, 60 and 120 fps (drift was 0.048 in scale, 0.027 rad in lean); a 2.4 m/s hop lands with 6.2 percent squash at every rate (was 6 to 8, clamped); twirl settles facing front |
| Runtime accessories with physics (ribbons), each link held within 60 degrees of the link above it | `js/vrm-accessory.js` | tails swing from 0.05 to 0.25 m in a twirl; the ribbon cones rarely engage, so a strip still trails out to 123 degrees from rest in a 6 m/s toss, as it does without them |
| Doll Lab: drop a `.vrm`/`.vrma`, sliders, moods, gestures, spring and collider overlay | `dev/lab.html` | no console errors |
| Companion adapter (Phase 0c): `index.html?renderer=vrm` on the runtime, behind the `doll` interface, local hosts only | `js/avatar-vrm.js` | `node dev/companion-vrm-check.cjs`: pats, carries, twirl, pop-out, reduced motion, SVG fallback |

Not yet done: the companion's default is still the earlier renderer. The
adapter becomes the default with the model decision (Phase 4); until then the
flag stays on local hosts, because the stand-in has no clothing layer.

## Model candidates

| Candidate | Licence (verified) | Format and physics | Content check | Verdict |
| --- | --- | --- | --- | --- |
| Shapell, lowteq ([BOOTH 1349366](https://booth.pm/ja/items/1349366)) | CC0 1.0 for .blend/.fbx/textures; the bundled arktoon shader is MIT and unneeded | FBX, about 27.9k polygons, cat ears and tail, 9 faces incl. wink, heart and star eyes, blush; DynamicBone setup does not carry over | Age unstated, youthful VRChat proportions, blazer outfit | Best cute CC0 option if the owner judges she reads as an adult; Blender conversion and springs needed |
| Shapell maid VRM 1.0, sashii ([BOOTH 7421313](https://booth.pm/ja/items/7421313)) | CC0 inherited, no added restrictions | Ready VRM 1.0 (11.8 MB zip), separate body, clothes, hair, skirt meshes | Same as Shapell | Fastest test: drop it in the Lab; check `vrm.meta` matches CC0 before any commit |
| Shapell VRM 0.0 conversion on VRoid Hub | CC0 source, Hub conditions all allow | 30 MB, rough expressions per uploader | Same as Shapell | Lower fidelity than the two above |
| Mizunashi Hiyori, HENGE ([BOOTH 6120660](https://booth.pm/ja/items/6120660)) | CC0 for `CC0_FBX` and `CC0_Texture` only | FBX (67 MB zip); PhysBone and expressions are VRChat-only, outside CC0 | Author: a taller setting looks more grown-up | Visual check, then Blender conversion |
| Himiko 2022, HENGE ([BOOTH 4023978](https://booth.pm/ja/items/4023978)) | CC0 for `FBX` and `Texture` folders | Light mesh (about 8.8k triangles, one material) | Age unstated | Modest for a physics-heavy hero |
| pixiv CC0 β samples 2 to 4 (Vivi, Vita, Victoria Rubin) | CC0 from pixiv, plus the open VRoid terms question above; no verifier confirmed them for Bijou's use | VRM 0.0 with authored hair, outfit and springs | No age stated | Stand-in for model-agnostic work only; build nothing new on them, including restoring the stripped outfit, until pixiv answers |
| Owner-made VRoid Studio heroine | Owner sets the meta | VRM 1.0 with hair, skirt, sleeve springs, expressions | Owner controls proportions | Cutest route, but fixed character only until pixiv licenses customization |

Rejected: β AvatarSample_1 and Sendagaya Shino (pixiv's profiles make them
high-school students); VRoidPreset A to Z and AvatarSample_A/B/C (their
conditions forbid character-creation services); any third-party VRoid Studio
model, even tagged CC0; Unity-chan (age 17, Unity-only reuse clause); Alicia
Solid (child-like, terminable licence); Haku (licence changed from VN3 to CC0
this year, file unchanged); Akane and "Girl A" (sexual premise; school-uniform
girl); Sketchfab fan uploads.

## Animation

Playback is solved: `createVRMAnimationClip`, evaluated straight from its
tracks by `js/vrm-clips.js` before the humanoid and springs update. An
`AnimationMixer` writes a value only when it changed since the last frame, and
`vrm-motion.js` resets every bone each frame, so under the mixer a clip that
held a pose (or a play-once clip at its end) fell back to the rest pose.
Every source below was checked by a separate verifier on the creator's own page.

- **Bundle (verified):**
  - rerofumi's 8 VRMA gestures, CC0 ([BOOTH 5527394](https://booth.pm/ja/items/5527394), 4.42 MB): a greeting, cheering, a startled jolt.
  - Sachi VRMA 1 by sashii, CC0 ([BOOTH 6412084](https://booth.pm/ja/items/6412084), 56.1 MB): commit only `.vrma` files with no meshes; treat capture clips of a recognisable dance as unverified.
  - KayKit Character Animations, CC0 (itch.io copy only, not the Unity Asset Store copy): 161 clips on a chunky rig, expect offsets.
  - Mesh2Motion's human clips **without** the `quaternius` tag in its `manifest.json`, 135 of 222, CC0 (pin one app commit; never vendor `human/variations/` or `static/test-files/`): idles, greeting, head nod, clapping, victory, dances, walks, freefall and landing. Needs retargeting from UE4-style bones and meshopt decoding.
  - 100STYLE locomotion, CC BY 4.0: credit the authors and state the changes.
- **Hold:**
  - Quaternius UAL 1 and 2, and Mesh2Motion's 87 Quaternius-tagged clips (including the sitting set): the packs still say CC0, but quaternius.com published a proprietary Quaternius Asset License on 2026-08-28 that bars standalone redistribution, and the verifiers split. Bundle only after reading the licence file inside the zips and saving dated captures, or after the creator confirms.
  - sashii's Josie run/walk VRMA: the upstream CC0 covers the model and textures only and the clips' origin is unknown.
  - CMU mocap: no resale "even in converted form"; own folder with a notice if ever used.
- **Visitor-loaded only:** pixiv's official 7-motion VRMA pack (its terms
  forbid extractable redistribution; a static site is extractable), Mixamo
  (raw files may not be distributed), ChatVRM's `idle_loop.vrma` (no stated
  terms), BOOTH packs that forbid standalone redistribution, Bandai Namco
  (CC BY-NC). Ready Player Me's library is limited to its own avatars.
- None of the bundleable libraries is cute anime acting as shipped. Expect to
  retime them, layer them under the procedural idle, gaze and springs, and
  record or hand-key a few signature clips (XR Animator records VRMA from a
  webcam in the browser).
- `dev/` and `assets/` are served publicly by Pages, so a licence-restricted
  test clip committed anywhere is redistributed. Test those from local files.

## Physics decisions

One spring engine: three-vrm's `VRMSpringBoneManager`, driven by our
controller. No second physics library (Rapier cloth is a 4.3 MB spike at
most; MMD physics, ammo.js and cannon-es do not fit). Applied in the Lab:

- Fixed 60 Hz substeps with the root, and the lean and squash groups under
  it, interpolated across them.
- A proxy center following the root's travel: Carry swing sets the share of
  carrying and tossing the springs feel; twirls are always felt in full. A
  jump of more than 0.45 m since the last step is a teleport the springs
  never feel, at any frame rate (at 30 fps the substeps used to split a
  0.8 m re-centre into two moves small enough to feel, swinging hair 14 cm).
- Body springs capped at stiffness 1.0 and drag 0.35 or stiffer, whatever the
  file authored (pixiv's bust is 0.75/0.05, very bouncy); Bounce scales from
  still to that cap; presets, variation and touch never loosen the body.
  Hair, skirts, ribbons, ears and tails carry the jiggle.
- A drag floor of 0.12 on every other joint, after presets and sliders,
  with the variation riding on it (a floored chain rises from it by up to
  12 percent). Bouncy used to turn pixiv's 0.05 skirt drag into 0.03, which
  swung 8 times over 2.2 s after a hop; now 4 times over 0.8 s.
- Per-chain variation: each chain's stiffness and drag move by up to 12
  percent either way, the same on every load, refresh and preset. Chains
  the file authored alike (the six skirt panels, the four sleeves, the two
  ribbons, hair groups) are spread evenly across that range, so the closest
  two differ by 4.8 percent (shares drawn from their names came within 0.8,
  and the floored ones shared one drag); any other chain takes its share
  from its root bone's name. Chains of three joints or more are 1.5 times
  stiffer at the root than at the tip, keeping their mean, unless the file
  graded them already.
- Cone limits, ported from three-vrm's `springbone-limit` branch (commit
  4f61363, MIT) without editing the bundle: each hair link stays within 50
  degrees (`hairCone`) of the link above it, each ribbon link within 60.
  That stops a lock kinking at one joint, not curling as a whole: in a 6 m/s
  toss a hair lock still swings 136 degrees from rest (170 without cones)
  and a ribbon 123 (the same without). Upstream's hard clamp made hair pop
  and clip in hard tosses (a tip jumping 22 cm in one frame against 6 cm
  free, a tail 51 mm inside a body collider against 9 mm), so the port lets
  colliders act last, in two passes, eases a tail a collider held past its
  rim back over about 0.15 s instead of snapping it, and halves the speed
  of a tail the rim stops. Over sixteen moves at 60 fps, coned hair now
  sits 3 mm less deep in colliders than free hair on average (4.4 mm more
  at worst, in the 6 m/s toss), and its biggest single-frame jump is at
  most 2.7 cm larger; at 30 fps one move, the same toss, clips 8.5 mm
  deeper.
- Lean, tilt, squash and the twirl are exact damped springs (Spring-It-On's
  closed form, MIT): squash 2.5 Hz at damping ratio 0.4, lean 1.3 Hz at 0.6,
  the twirl critically damped into a whole turn. Flight is solved in closed
  form and each landing and wall bounce happens at its own time inside the
  frame. Landing squash is 2.7 percent per m/s of impact, capped at 8: the
  head's travel is what whips the hair.
- Measured by `node dev/physics-check.cjs` (in the browser, on the default
  model) and `node --test dev/vrm-physics.test.mjs` (the math, in Node).

Next: skirts as 8 to 16 radial chains with thigh capsules and their own cones
(`opts.cones` takes a pattern and an angle), stiffness expressed per metre so
body-height changes keep the feel. Starting values per part are in the
physics study: bangs k 10 to 15 per m with drag 0.2 to 0.35; long hair
k 8 to 12 with drag 0.15 to 0.3; ribbon tails k 15 to 20 with drag 0.1 to 0.2;
skirt k 10 to 15 with drag 0.2 to 0.35.

## Dress-up architecture

One skeleton, items attached by bone name, on the new runtime (the old
`avatar-model.js` path disables springs). Each garment, hairstyle or
accessory is a small VRM authored in Blender against the base in its T-pose
(same bone names and VRM version, extra bones prefixed with the item id, its
own spring chains, a sidecar listing the body triangles it hides). At runtime:
graft unmatched bones, rebind each mesh to the base bones with its own inverse
binds, add its spring joints to the base manager with colliders matched by
bone name, re-init springs at rest, hide covered skin from the union of worn
items, refit to the body field, tint through MToon colour and shade colour.
Never build items in VRoid Studio.

## Companion behaviour

What makes Desktop Mate, Mate Engine, Amica and AIRI feel alive: an authored
model, a pool of hand-made clips rotated with long crossfades (Mate Engine
ships 128; a single idle loop reads as dead), and reactions. In the Lab now
(Phase 0b):

- Per-bone priority, lowest first: default, idle, tracking, one-shot,
  expression, physics (VTube Studio's order). A higher layer takes a bone over
  with a faded weight, so the gaze on head and neck yields to gestures and
  clips instead of fighting them, and the dangle while held wins over all.
- An idle scheduler (`js/vrm-idle.js`): a weighted pool, never the same twice
  in a row, a new idle about every 12 s with jitter and about 3 s blends, start,
  loop and end parts, procedural today (weight shifts, sway, hands, glances,
  stretch, think) and VRMA clips later through `addIdle`. Drag, toss, fall and
  land are event-only behaviours the caller fires. After 60 s alone she dozes
  and a slower pool of sleepy poses rotates; a drag or a look wakes her.
  Attention lapses to 35 percent after 6 s without a look, so her idles show.
- Pats (`js/vrm-touch.js`, ported from Project AIRI with its MIT notice): a
  tap moves at most 8 px within 450 ms; a pat is a stroke over the head that
  turns back, and each further 70 px is another pat. Each pat is an impulse
  (rises in 0.15 s, fades over 0.7 s, up to 8 overlap): the head dips 5
  degrees and leans 9 into the hand, the eyes go soft and smiling. Press and
  hold on the head, or any press below the neck, still picks her up.
- Eyes (`js/vrm-eyes.js`): AIRI's saccade gaps (400 ms steps from 800 ms),
  about one hop in five back to eye contact; a new emotion waits for a blink
  in progress to reopen and auto-blinks pause while an emotion shows; the eyes
  yield to a clip's own gaze by 1 - smoothstep(30, 90 degrees) (ChatVRM's two
  ideas, no code taken).
- Breathing and drift from summed sines whose periods were searched so that
  no 6 s stretch comes within 6 percent of repeating in five minutes; the
  cursor gaze turns the spine up to 15 degrees, split 1.0, 0.8 and 0.6 over
  spine, chest and upper chest (Mate Engine's numbers, our code).

Next: feed approved VRMA idles and reactions to `addIdle`, and judge the
procedural repertoire by eye in the Lab. Bundle nothing from any companion app.

## Waiting on the owner

1. Look at the Shapell, Hiyori and Himiko 2022 previews and say which, if
   any, reads as an adult. Drop out any that does not.
2. Download a candidate yourself (BOOTH needs a pixiv login) and drop it on
   `dev/lab.html`; nothing is committed until it is judged.
3. Send pixiv one inquiry (the form is on pixiv.net): does Art. 13(3) apply to
   the CC0 β samples in a free public dress-up app with body editing and GLB
   export; may an owner-made VRoid model be used in such an app; may Bijou
   bundle the official VRMA 7-pack. A yes on the second makes VRoid Studio the
   whole answer.
4. Approve the verified motion downloads: rerofumi's set and Sachi VRMA 1
   (BOOTH, your login), KayKit (itch.io) and the 135 untagged Mesh2Motion
   clips (GitHub, pinned commit).
5. Decide whether `dev/` should stay public on Pages (the model studio there
   exports GLB containing the β sample's face).

Process note: one researcher fetched `blender.org/download` once in the same
command as its robots check before reading the result (blender.org disallows
Claude's crawler); it discarded the page unread and nothing here relies on it.
