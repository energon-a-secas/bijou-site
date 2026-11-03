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
| Clip retargeter (Mesh2Motion/UE4 and Mixamo bone maps, A-pose into T-pose, hips scale, VRM 0.x) and a VRMA writer, with a page for files from disk | `js/vrm-retarget.js`, `js/vrma-writer.js`, `dev/retarget.html` | `node --test dev/retarget.test.mjs`: bones point within 0.0001 degrees of synthetic sources; written VRMA reloads key for key |
| Spring controller on three-vrm's own manager: presets, wind, fixed 60 Hz substeps with root interpolation, proxy center (Carry swing), body cap and Bounce, touch impulses, NaN recovery | `js/vrm-physics.js` | same hop swings hair 0.093 at 30 fps and 0.090 at 120 fps; body moves 0.2 mm under a touch that moves hair 2 cm |
| Whole-body rig: carry, toss, landing bounce, squash, lean, twirl | `js/vrm-physics.js` | twirl settles facing front |
| Runtime accessories with physics (ribbons) | `js/vrm-accessory.js` | tails swing from 0.06 to 0.25 m in a twirl |
| Doll Lab: drop a `.vrm`/`.vrma`, sliders, moods, gestures, spring and collider overlay | `dev/lab.html` | no console errors |

Not yet done: the companion (`index.html`) still uses the earlier renderer;
connecting the runtime is an adapter behind the `doll` interface, waiting on
the model decision.

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

Playback is solved: `createVRMAnimationClip` with an `AnimationMixer`, mixer
before humanoid and springs (already in `vrm-motion.js`). Every source below
was checked by a separate verifier on the creator's own page.

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

- Fixed 60 Hz substeps with the root interpolated across them.
- A proxy center following the root's travel: Carry swing sets the share of
  carrying and tossing the springs feel; twirls are always felt in full.
- Body springs capped at stiffness 1.0 and drag 0.35 or stiffer, whatever the
  file authored (pixiv's bust is 0.75/0.05, very bouncy); Bounce scales from
  still to that cap; presets and touch never loosen the body. Hair, skirts,
  ribbons, ears and tails carry the jiggle.
- Squash kept within 8 percent: the head's travel is what whips the hair.

Next: skirts as 8 to 16 radial chains with thigh capsules, cone limits
(VRMC_springBone_limit is final since 2026-10-02 but only in three-vrm
3.6.0-beta, not on npm, so port the cone limit or wait), stiffness expressed
per metre so body-height changes keep the feel. Starting values per part are
in the physics study: bangs k 10 to 15 per m with drag 0.2 to 0.35; long hair
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
ships 128; a single idle loop reads as dead), and reactions. In the Lab now:
drag sway, cursor gaze with saccades, pats distinct from pickups (a stroke on
the head pets; only press-and-hold there carries), dozing after a minute
alone, startle on pickup. Next: an idle scheduler (start, loop and end clips,
rotate about every 12 s with about 3 s blends), MIT code from Project AIRI and
pixiv ChatVRM where it helps (keep their notices). Bundle nothing from any
companion app.

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
