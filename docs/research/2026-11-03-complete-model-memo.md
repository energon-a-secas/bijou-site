# Bijou: complete model, motion, physics and dress-up (decision memo, 2026-11-03)

## 1. Recommendation

Make the model-agnostic VRM runtime that already exists locally (`js/vrm-runtime.js`, `vrm-motion.js`, `vrm-physics.js`, `vrm-accessory.js` and the Doll Lab `dev/lab.html`, commits 84e2d12 and 772b543, not yet pushed) the companion's renderer. Give it one verified CC0 character made in Blender: Shapell by lowteq, if the owner judges she reads as an adult. Test her first through sashii's ready CC0 VRM 1.0 conversion, then have the owner convert her properly, once, with Blender and the VRM Add-on. Wardrobe items are small Blender-made VRMs attached to her skeleton by bone name. Motion is CC0 or CC BY clips, converted offline to `.vrma` and played with @pixiv/three-vrm-animation (MIT), layered under the procedural idle, gaze, pats and dozing already in `vrm-motion.js`. Everything that swings runs on three-vrm's own spring bones through Bijou's fixed-step controller. Build nothing new on VRoid-made content, the current base included, until pixiv answers the Art. 13(3) question, because the verifiers could not confirm any VRoid-made model as bundle-safe for a dress-up app.

Viable paths, ranked:

1. **A verified CC0 model made in Blender (Shapell first, Mizunashi Hiyori second).**
   - Why: this is the only route whose licence a verifier confirmed for everything Bijou does. lowteq's page ([BOOTH 1349366](https://booth.pm/ja/items/1349366)) reads "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" and "著作者ろーてくは恒久的に著作権の放棄と著作人格権の不行使を宣言します". The text is the same in every archived copy since 2019-05-07. The package ships `.blend` sources and no VRoid content was reported, so the VRoid Studio terms should not reach it (inference). Shapell is the cutest candidate found:
     - nine authored faces, including wink, heart eyes, star eyes and blush;
     - cat ears and a tail;
     - about 27,902 polygons and a parts-separated FBX.
     sashii's CC0 VRM 1.0 build ([BOOTH 7421313](https://booth.pm/ja/items/7421313)) has separate Body, Fuku (clothes), Hair and Skirt meshes and can be dropped on the Doll Lab as it is.
   - Cost: $0 in licences. A pixiv account for BOOTH. Blender plus the free [VRM Add-on for Blender](https://github.com/saturday06/VRM-Addon-for-Blender) on the owner's Mac. Owner sessions to convert her, author springs and map expressions (time not estimated).
   - Gives up:
     - A character of the owner's own design. She is lowteq's design; give her Bijou's own name, since CC0 s.4(a) waives no trademark rights.
     - A stated age. None is given, her proportions are youthful VRChat and her source outfit is a school-style blazer, so she must be presented as an adult through proportions and wardrobe, or dropped.
     - Her existing physics. The DynamicBone and Unity setup does not carry over, so her springs are authored again.

2. **An owner-made VRoid Studio heroine, shipped as a fixed character until pixiv licenses more.**
   - Why: [VRoid Studio](https://vroid.com/en/studio) v2.16.0 is free on macOS (pixiv recommends "Apple M1 Series" and 16 GB RAM, [requirements](https://vroid.pixiv.help/hc/en-us/articles/900006049066-Operating-environment-requirements)). It is the only tool studied that outputs what the runtime already plays: VRM 1.0 with per-lock hair chains of 1 to 16 bones, body and clothing springs, capsule colliders, per-joint tuning, expressions and MToon. The owner controls the look and the adult presentation.
   - Cost: $0, about 10 GB of disk ([Steam](https://store.steampowered.com/app/1486350/VRoid_Studio/)), owner time, and one inquiry to pixiv.
   - Gives up: customization. VRoid Studio Terms Art. 13(3) ([policies.pixiv.net](https://policies.pixiv.net/en.html#vroidstudio); the Japanese text prevails) says: "Users are not licensed to use Provided Content, or 3D models or Output Items containing Provided Content, to create applications having functions that allow avatars, items, or other 3D models to be created by deforming meshes or combining meshes or textures."
     - Art. 7 adds apps with an output function. Only personal use is exempt, and pixiv says it may decline to grant the separate licence.
     - Without that licence she gets animation, physics, expressions and whole-outfit swaps between full exports. She gets no body sliders, no mix-and-match, no recolour and no GLB export.
     - It is undetermined whether an app that offers those functions for another model may ship her at all.
     - If pixiv says yes, this becomes the best path.

3. **Image-to-3D plus auto-rig, for single garments and props only.**
   - Why: paid Tripo output carries full rights ("Paid Users generally have all rights", [Tripo terms](https://developers.tripo3d.ai/en/terms)). It offers part generation and an auto-rig that can use VRM 1.0 bone names ([rig docs](https://developers.tripo3d.ai/en/docs/animations-rig)). That is useful for roughing out a hat or a bag to refit in Blender.
   - Cost: $0.01 per credit. Textured image-to-3D costs 30 credits, parts add 20 and the auto-rig costs 25 ([pricing](https://developers.tripo3d.ai/en/pricing)). Plus Blender refit time.
   - Gives up: what makes a character cute.
     - Bijou's own Meshy trials fused clothing to the body and produced a 24-joint rig with no fingers or facial morphs (`docs/MESHY-EVALUATION.md`).
     - Tripo documents no fingers, springs or expressions, and keeps all rights to free-tier output.
     - Hunyuan3D's licence forbids display in the EU, UK and South Korea ([LICENSE](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE)).
     - StdGEN's checkpoints are "for research purposes only" ([repo](https://github.com/hyz317/StdGEN)).
     - UniRig needs a CUDA GPU and vendors GPL-3.0 code ([repo](https://github.com/VAST-AI-Research/UniRig)). AccuRIG is reported to be Windows-only.
     - None of them yields a whole character on this Mac.

The current base, pixiv's β AvatarSample_4 "Victoria Rubin", stays as the stand-in for model-agnostic work. The verifier did not confirm it for Bijou's use (section 2), so add no new customization assets made from it. The models researcher suggested restoring its stripped CC0 outfit, ribbon and hair as wardrobe items; the verifiers' reading overrides that until pixiv answers.

## 2. Models

Bundle-safe: an independent verifier confirmed each licence below on the author's own page. None states an age, so each still needs the owner's adults-only judgment from the previews.

| Rank | Candidate | Verified licence (verbatim) | Format and weight | What Bijou gets | Before any commit |
|---|---|---|---|---|---|
| 1 | Shapell maid version, VRM 1.0, by sashii on lowteq's CC0 base body ([BOOTH 7421313](https://booth.pm/ja/items/7421313)) | Inherited CC0 1.0: "ライセンスは、元のライセンスのままとします。制限を追加しません。" | VRM 1.0, ShapellFuku5.1.zip, 11.8 MB; separate Body, Body.001, Fuku, Hair and Skirt meshes | The fastest test: drop it on `dev/lab.html` | Read `vrm.meta`. VRM 1.0 defaults are restrictive (allowRedistribution false, modification prohibited; [meta spec](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/meta.md)). If the file contradicts the page, keep a dated copy of the page and correct the fields. Check what is under the clothes, the springs and the expressions. The face is flagged "Third Person Only", which matters only if `firstPerson.setup()` is called (inference) |
| 2 | Shapell v1.0.3 by lowteq (ろーてく) ([BOOTH 1349366](https://booth.pm/ja/items/1349366)) | "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication"; carve-out: "シェーダーはarktoon shaderを使用しています。シェーダーのライセンスはそちらに従ってください。" | .blend, .fbx, parts-separated .blend/.fbx, a Unity package, 6 PNG textures; Shapell_v1_0_3.zip, 30.3 MB; about 27,902 polygons | Best fidelity: nine faces (wink, heart eyes, star eyes, blush), cat ears, tail | Ship only derivatives of the .blend, .fbx and .png files, never the Unity package. Read the LICENSE.txt in the zip. Record the URL, author, CC0 and the zip's SHA-256 in `assets/ATTRIBUTION.md` |
| 3 | Mizunashi Hiyori (水無ひより) by ひみこ/HENGE ([BOOTH 6120660](https://booth.pm/ja/items/6120660)) | "この作品「水無ひより」の3Dモデル(CC0_FBX フォルダ内)と付随するテクスチャ(CC0_Texture フォルダ内)について、権利を法令上求められる最大限の範囲で放棄して、パブリック・ドメインに提供します。" | FBX and textures, Henge_MizunashiHiyori_20240922.zip, 67.2 MB; her expressions and PhysBone live in the Unity prefab, which is not CC0 | The author says a taller setting "よりお姉さんらしく見えるようになります" (looks more grown-up) | Take only the two CC0 folders. Never use the paid 2020 predecessor 「水無」 ([BOOTH 2019700](https://booth.pm/ja/items/2019700), UV licence). The verifier returned confirmed=false only because the researcher spelled her name "Minashi"; every licence field was confirmed |
| 4 | Himiko 2022 by ひみこ/HENGE ([BOOTH 4023978](https://booth.pm/ja/items/4023978)) | "この作品「Himiko 2022」の3Dモデル(FBX フォルダ内)と付随するテクスチャ(Texture フォルダ内)について、権利を法令上求められる最大限の範囲で放棄して、パブリック・ドメインに提供します。" | FBX and textures, Himiko2022_plus_20230819b.zip, 141 MB; her 2022 VRoid Hub VRM is 8,791 triangles with one material | Light and simple, which is modest for a physics-heavy hero | Only the FBX and Texture folders. Her VRoid Hub copy is under Hub conditions, not CC0 |
| 5 | Shapell VRM 0.0 conversion by ウンフェルス on VRoid Hub ([model page](https://hub.vroid.com/characters/2659905496918897597/models/406149290929678011)) | CC0 source plus Hub conditions "再配布 : OK", "改変 : OK", "クレジット表記 : 不要" | VRM 0.0, 30.0 MB, 27,873 triangles, 47 morph targets, MToon | A quick look only; the uploader says expressions and shaders are rough | Needs a pixiv login and acceptance of the VRoid Hub Terms. The uploader may change the conditions and the download-day conditions apply, so save them with the date |

Not bundle-safe (a verifier did not confirm the licence, or the content rule fails):
- pixiv's CC0 β AvatarSample_2 "Vivi", _3 "Vita", _4 "Victoria Rubin" (Bijou's base) and HairSample_Female. CC0 holds for copyright, but two things block bundling:
  - pixiv's Japanese source pages add "※.vroidファイルの利用にはVRoid Studioの利用規約、VRMファイルの利用にはVRoid Hubの利用規約に同意いただく必要があります。" ([360014900233](https://vroid.pixiv.help/hc/ja/articles/360014900233)), a sentence the English pages drop;
  - Art. 13(3) applies "notwithstanding" per-item licences.
  Vivi also reads young: she is the youngest of five, and a school-uniform variant exists.
- Haku by MITUBASINA ([BOOTH 8214054](https://booth.pm/ja/items/8214054)). The 2026-05-31 and 2026-07-26 snapshots show VN3 terms; the page says CC0 now, for the same zip. The creator's own VRoid Hub listing says 再配布 NG and 法人利用 NG.
- Rejected outright:
  - VRoidPreset A to Z and AvatarSample_A/B/C: their conditions ban "Development of a character creation service using data contained in the sample model".
  - Any third-party VRoid Studio export, even one tagged CC0.
  - Unity-chan: officially 17.
  - Alicia Solid: reads as a child, and Dwango may end the licence at any time.
  - β AvatarSample_1 and Sendagaya Shino: pixiv's profiles make them high-school students.
  - Girl A: CC0 is confirmed, but she is a sailor-uniform schoolgirl about 1.17 m tall.
  - Akane: marketed on a sexual premise.
  - The Shapell base body ([BOOTH 1819556](https://booth.pm/ja/items/1819556), shapell_naked__3_.zip): CC0 is confirmed, but it is a nude base. Keep the bare mesh out of the repo.
  - Open Source Avatars entries without a licence from the creator.
  - Sketchfab fan uploads.

Visitor-loaded (the visitor's own file, held in memory, never stored or committed):
- Any VRM through the Lab's file picker. Show its meta, and allow edits only where `modification` permits. Offer no GLB re-export of a modified VRoid-made model (inference from Art. 7's output clause).
- Copies of VRoidPreset or AvatarSample_A to C. Loading one is the visitor's act, but their conditions forbid diverting their data into a character creation service, so never suggest it.
- BOOTH VN3 avatars and Haku. Their terms sit in PDFs inside each download.
- VRoid Hub through the official SDK. pixiv reviews every app and forbids storing model data ([SDK guidelines](https://vroid.pixiv.help/hc/en-us/articles/900000213643-VRoid-SDK-Guidelines)), so it is out of scope for a site with no server.
- Seed-san and VRM1_Constraint_Twist_Sample. They are under the VRM Public License 1.0 with permissions stored inside each file; test them only from the owner's disk.

## 3. Animation

Bundle-safe now (verified):

| Source | Verified licence (verbatim) | What it is | Notes |
|---|---|---|---|
| [CC0] Sachi VRMA 1 by sashii ([BOOTH 6412084](https://booth.pm/ja/items/6412084)) | "CC0ライセンスにします。自己責任でご利用ください。" | SachiVRMA1.zip, 56.1 MB; VRMA keyed in Blender plus TDPT captures; clip list not published | Commit only `.vrma` files, after checking that each file's glTF JSON has no meshes. Treat any capture clip that is a recognisable dance as unverified: TDPT warns that source footage, music and choreography keep their rights |
| 使いどころに困るモーションセット by rerofumi ([BOOTH 5527394](https://booth.pm/ja/items/5527394)) | "CC0 (creative commons 0) パブリックドメインです 任意の用途にご利用できます。改変、再配布も可。制作者のクレジットも不要です。" | fm_vrma_motion_pack_01.zip, 4.42 MB; 8 short VRMA gag clips | Plays as it is. Useful: 004_hello_1 (waits, then greets), 007_gekirei (cheering), 008_gatan (startled jolt), 001_motion_pose |
| KayKit Character Animations 1.1 by Kay Lousberg ([itch.io](https://kaylousberg.itch.io/kaykit-character-animations)) | "Asset license: Creative Commons Zero v1.0 Universal"; "Free for personal and commercial use, no attribution required." | 161 humanoid clips for Rig_Medium and Rig_Large; free tier 14 MB, FBX and GLTF | Use the itch.io copy only (the Unity Asset Store copy is under the Unity EULA), and not the older "Legacy" pack. The rig is chunky and stylised, so expect arm and leg offsets. Honour the request not to resell unmodified copies |
| Mesh2Motion human clips without the `quaternius` tag, 135 of 222 ([repo](https://github.com/Mesh2Motion/mesh2motion-app)) | LICENSE-CC0.MD: "All 3d models, blend files, rigs, animations CC0 1.0 Universal" | GLB, one skeleton plus one animation per file, meshopt-compressed, 24 fps, rotation keys only except on the hips | Both verifiers returned confirmed=false for the library as claimed, and both read these 135 clips as plain CC0. Pin one app commit (the verifiers read 1784fa0b and b6dc8faa). Never vendor `human/variations/{sophia,jay,sintel,bunny}.glb` (CC-BY, CC-SA) or `static/test-files/` (Mixamo) |
| 100STYLE ([dataset page](https://www.ianxmason.com/100style/), [Zenodo 8127870](https://zenodo.org/records/8127870)) | "This work is licensed under a Creative Commons Attribution 4.0 International License." | BVH, 60 fps, 28 bones, no fingers; 100 locomotion styles | Credit Ian Mason, Sebastian Starke and Taku Komura, link CC BY 4.0 and state the changes. Never bundle the Geno mesh from the retarget repo (its README limits it to non-commercial research) |

Code:
- @pixiv/three-vrm-animation 3.5.5 is MIT ("Copyright (c) 2019-2026 pixiv Inc.") and is already vendored in the local commits.
- three-vrm's MIT Mixamo example ([loadMixamoAnimation.js](https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/humanoidAnimation/loadMixamoAnimation.js) and mixamoVRMRigMap.js) is cleared as code only. Running it needs FBXLoader and fflate (both MIT) added to the bundle.

Hold until a check passes:
- Mesh2Motion's 87 Quaternius-tagged clips, and Quaternius UAL1/UAL2 ([UAL1](https://quaternius.itch.io/universal-animation-library), [UAL2](https://quaternius.itch.io/universal-animation-library-2)). The listings say "(CC0 License)". But [quaternius.com/license.html](https://quaternius.com/license.html) now publishes the Quaternius Asset License v1.0 ("Last updated: 8/28/2026"), which bars redistributing assets "as a standalone asset, asset pack, stock file, template, or similar product, whether for free or for payment". The two verifiers split, so bundle these only after the download-day checks in section 7.
- sashii's Josie run/walk retarget ([BOOTH 7861818](https://booth.pm/ja/items/7861818)). The upstream CC0 sentence covers "3d model and textures" only, and the clips' origin is unknown. Visitor-loaded until the origin is shown.
- CMU ([mocap.cs.cmu.edu](http://mocap.cs.cmu.edu/)): "you may not resell this data directly, even in converted form". Bundle it only in its own folder, outside the MIT grant, with a NOTICE. The motion is realistic and noisy; low priority.
- Bandai Namco Research motion datasets: CC BY-NC 4.0, confirmed. Visitor-loaded unless the owner accepts a non-commercial carve-out.

Visitor-loaded only:
- pixiv's VRMA 7-pack ([BOOTH 5512385](https://booth.pm/ja/items/5512385)). Its terms forbid "許可なく取り出せる状態で二次配布すること".
- Mixamo. A 2022 community copy of its FAQ says "the only thing you can't do is distribute the raw character and animation files"; the official FAQ returned 403.
- ChatVRM's `idle_loop.vrma`: no asset terms are stated.
- BOOTH packs whose terms forbid standalone redistribution, such as 8815790 and 9089908.

Ready Player Me's library cannot be used at all, not even visitor-loaded: its licence limits it to Ready Player Me avatars.

Runtime technique:
1. Ship only `.vrma`.
   - Playback: GLTFLoader with VRMAnimationLoaderPlugin, then `createVRMAnimationClip(vrmAnimation, vrm)`, then an AnimationMixer on `vrm.scene`.
   - Each frame, in order: `mixer.update`, the procedural layers, `vrm.humanoid.update`, lookAt and expressions, then springs.
   - `stepVRM` in `js/vrm-physics.js` already follows this order, and `vrm-motion.js` already cross-fades clips.
2. Convert offline.
   - BVH (100STYLE, CMU): [bvh2vrma](https://vrm-c.github.io/bvh2vrma/) in the browser. It maps bones heuristically, and its README says results are not guaranteed.
   - GLB and FBX (Mesh2Motion, KayKit): a dev page in bijou-site that retargets and writes VRMA, or Blender with the VRM Add-on, which imports and exports VRMA.
   - Mesh2Motion files need three's MeshoptDecoder (MIT).
3. Retarget with three-vrm's formula.
   - Rotations: for each mapped bone, normalized = parentRestWorld(src) x key x inverse(restWorld(src)), using the nearest mapped ancestor as the parent. Fold any animated unmapped bone into its child.
   - Rest pose: the source must rest in a VRM T-pose, so pose A-pose sources into a T-pose before sampling.
   - Translation: move the hips only, scaled by `vrm.humanoid.normalizedRestPose.hips.position[1]` divided by the source's rest hips height. Keep hips Y and drop XZ drift for a companion who stays in place.
   - VRM 0.x targets: negate quaternion x and z, and hips x and z. `createVRMAnimationClip` already does this for VRMA.
   - Rebuild clips after a height or leg morph, because the hips scale is fixed when a clip is created.
4. Mesh2Motion bone map. This is the researcher's composition from two verified maps; check it against a GLB.
   - Spine and head: pelvis to hips, spine_01 to spine, spine_02 to chest, spine_03 to upperChest, neck_01 to neck, head to head.
   - Arms: clavicle_l to leftShoulder, upperarm_l to leftUpperArm, lowerarm_l to leftLowerArm, hand_l to leftHand.
   - Legs: thigh_l to leftUpperLeg, calf_l to leftLowerLeg, foot_l to leftFoot, ball_l to leftToes.
   - Fingers: thumb_01/02/03_l to leftThumbMetacarpal/Proximal/Distal; index, middle and ring _01/02/03_l to Proximal/Intermediate/Distal; pinky to Little.
   - Mirror all of this for _r, and drop `*_leaf` and root.

Motions to take first. These come from the verified sets only; the Mesh2Motion names come from its [manifest.json](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/static/assets/manifest.json) (generated 2026-10-31) and are all untagged clips:
- Idle pool: Idle_Subtle, Idle_Listening, Sit_Ground_Idle; Sleeping for the doze.
- Hello and reactions: Greeting, Head Nod, Clapping, Victory, Victory Fist Pump, Confused, Shivering, Dizzy, Reject; rerofumi's 004_hello_1, 007_gekirei and 008_gatan (a startle on pickup).
- Toss and landing: Freefall, Fall_Tumbling, Land_Three_Point, Jump_2.
- Moving: Walk_Happy, Walk_Female, Walk_Relaxed, Run_Anime. 100STYLE styled walks come in a second wave (the researcher suggests FairySteps, Skip, Tiptoe, Elated and Bouncy).
- Play: Dance_Arm_Pump, Dance Body Roll, Dance Charleston, Dance Reach Hip.
- Only after the Quaternius checks pass: Sitting_Enter, Sitting_Idle, Sitting_Exit, Idle_FoldArms, Idle_A, Idle_Talking, Yes, Jump_Start, Jump_Land.

None of these is cute anime acting as shipped. Retime them and layer them under the procedural idle, gaze and springs. Plan a few signature clips that the owner records or keys by hand and releases as CC0:
- Recorded with [XR Animator](https://github.com/ButzYung/SystemAnimatorOnline), which captures webcam motion to VRMA. Its code is CC BY-NC-SA 4.0, and whether that licence reaches exported motion is unverified.
- Keyed by hand in Blender.

## 4. Physics and jiggle

Approach: one spring engine, three-vrm's `VRMSpringBoneManager` (MIT, already in `js/vendor/avatar-engine.js`), driven by Bijou's controller in `js/vrm-physics.js`. No second physics library.

Already in the Lab (read in `js/vrm-physics.js`):
- Fixed 1/60 s steps, at most 5 per frame, with the root interpolated across the substeps.
- A proxy center. Through it the springs feel `inertia` (default 0.4) of carrying and tossing, and none of any jump over 0.45 m.
- Recovery when dt exceeds 0.25 s.
- Body regions held at stiffness 1.0 or more and drag 0.35 or more, whatever the file authored. Bounce can only lower that motion.
- Wind through gravityDir and gravityPower.
- NaN recovery.
- Reduced motion resets once and stops stepping.
- Squash clamped to 0.92 to 1.07.

The Lab check measured the same hop swinging hair 0.093 at 30 fps and 0.090 at 120 fps (`docs/MODELS-AND-MOTION.md`).

To add, in order:
1. A drag floor of about 0.12 on non-body joints. Today Bouncy multiplies authored drag by 0.6 with no floor, so pixiv's skirt drag of 0.05 becomes 0.03.
2. Stiffness and gravity per metre (stiffness = k x segment length). Rebuild collider radii whenever the body shape changes: three-vrm moves collider centres but never scales radii ([issue 1112](https://github.com/pixiv/three-vrm/issues/1112)).
3. After any collider change, `deleteJoint` then `addJoint` (or rebuild the manager). Otherwise a collider assigned after the first update is ignored. Call `setInitState` only at rest.
4. Exact damped springs for lean, squash and spin, ported from [Spring-It-On](https://github.com/orangeduck/Spring-It-On) (MIT, "Copyright (c) 2021 Daniel Holden"). They replace the current integration, which drifts with frame rate.
5. Skirts, in three steps:
   - 8 to 16 radial chains of 3 to 4 joints, with thigh capsules (pixiv's file uses radius 0.081), a hip capsule and a plane collider for seat and floor.
   - Cone limits of about 35 to 60 degrees, ported from three-vrm's `springbone-limit` branch at commit 4f61363 with pixiv's MIT notice. Port from the branch rather than use the v3.6.0-beta.0 tag: the tag is not on npm, it accepts only specVersion "1.0-draft" while the ratified [VRMC_springBone_limit](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_springBone_limit-1.0/README.md) requires "1.0", and it predates a limit-rotation fix.
   - A post-pass that keeps neighbouring skirt tails near their rest spacing (an idea from [KawaiiPhysics](https://github.com/pafuhana1213/KawaiiPhysics)).
6. Long dresses only: an in-house XPBD tube based on [Ten Minute Physics](https://github.com/matthias-research/pages/blob/master/tenMinutePhysics/14-cloth.html) (MIT in the file header, "Copyright 2022 Matthias Müller - Ten Minute Physics"). Rapier 0.21 cloth (Apache-2.0, a 4,340,292-byte compat build) is worth a lab spike at most. Not MMDPhysics, ammo.js or cannon-es.

Starting values at a fixed 60 Hz. These are the physics researcher's synthesis of pixiv's CC0 values and a measured sweep; cuteness is judged by eye in `dev/lab.html`.

| Part | Segment | Stiffness: k per metre (value) | dragForce | gravityPower | hitRadius | Expect |
|---|---|---|---|---|---|---|
| Bangs, side locks | 3 to 6 cm | 10 to 15 (0.3 to 0.9) | 0.2 to 0.35 | 0 to 0.05 | 0.01 to 0.02 | 2 to 4 swings, settling in 0.4 to 0.6 s |
| Long hair, twin tails, ponytail | 8 to 12 cm | 8 to 12 (0.6 to 1.4); root about 1.5 times stiffer than the tip | 0.15 to 0.3 | 0.05 to 0.15 | 0.02 to 0.04 | Vary each chain by 10 to 15 percent so strands overlap |
| Ahoge, bows, ribbon tails | 2 to 5 cm | 15 to 20 | 0.1 to 0.2 | not given | not given | A quick boing |
| Skirt | 5 to 8 cm | 10 to 15 (0.6 to 1.0) | 0.2 to 0.35 | 0.02 to 0.05 | 0.02 to 0.03 | pixiv's 0.05 drag gave 10 to 12 swings over about 2.2 s, which reads as jelly |
| Sleeves | not given | about 15 | 0.3 to 0.4 | not given | not given | |
| Body regions | | 1.0 or more | 0.35 or more | | | Small amplitude, no exaggeration control |

Cat ears and a tail were not in the study; start them from the ribbon and long-hair rows (inference).

Whole body:
- Squash at 2 to 3 Hz with damping ratio 0.35 to 0.5; lean at 1 to 1.5 Hz with damping ratio 0.5 to 0.7.
- Landing squash of 3 to 8 percent. A 6 percent squash about the feet already whipped a lock to about 88 degrees.
- A moving hold (breathing, sway), so the springs never freeze.
- Let 20 to 40 percent of carry and toss reach the springs (KawaiiPhysics passes 20 percent, [docs](https://pafuhana1213.github.io/KawaiiPhysics-Portal/en/docs/parameters/physics)).
- Budget 150 to 350 joints, about 0.2 to 0.6 ms per step (measured in Node on the M4 under heavy load). Each chain should see only the colliders near it.

The content rule keeps body motion small: hair, skirts, ribbons and tails carry the jiggle.

Failure modes and guards. The physics researcher measured these against the vendored code unless noted.
- Frame-rate dependence. Stepped once per frame, the same hair settled in 0.70 s at 30 Hz and 0.34 s at 120 Hz; a fixed 60 Hz step gave 0.43 to 0.45 s at every rate. Chrome's Energy Saver about halves rAF on battery ([Chrome](https://developer.chrome.com/blog/memory-and-energy-saver-mode)). Guard: the fixed step (done).
- Doubled kick at 30 Hz. Putting a frame's root motion in the first substep took a skirt to 142 degrees, against 73 at 60 Hz; spreading it across the substeps gave 71 (done).
- Teleports, re-centring and pop-out. A 2 m jump flipped hair 174 to 179 degrees, and stale world matrices gave 180. Guards:
  - the proxy ignores big jumps (done);
  - refresh world matrices before each step;
  - treat the Picture-in-Picture host switch as a discontinuity. The Lab clamps dt to 0.1, so its dt > 0.25 reset never fires there.
- Tunnelling. Collision is a discrete push-out of each tail sphere; at 30 Hz a 5 cm sphere missed a tip entirely at 8 m/s. Guards: the fixed step, thigh capsules, a real hitRadius, cone limits.
- NaN. A tail landing exactly on a sphere centre or capsule axis gives NaN that survives `reset()` plus `update()`. Guard: recover (done), or subclass the collider shapes.
- Lifecycle. Colliders added late are ignored. Calling `setInitState` mid-swing left hair 19.8 degrees off its rest for good. A spring joint overwrites any animation written to its bone.
- Jelly, from pixiv's bust values (stiffness 0.75, drag 0.05) and skirt drag 0.05. Guards: the body cap (done) and the drag floor (to do).
- Lockstep strands look fake. Guard: vary each chain.
- Reduced motion. Guard: reset once, then skip updates (done).

## 5. Dress-up and customization

Architecture. This is the dress-up researcher's design, built on the new runtime, because the old `avatar-model.js` path switches springs off.
1. One base body, loaded through `js/vrm-runtime.js` with springs on.
2. Every garment, hairstyle and accessory is its own small VRM, made in Blender with the VRM Add-on against the base in its T-pose. Each item has:
   - the same bone names, VRM version and coordinate frame as the base;
   - any bones only the item has (such as skirt chains) prefixed with the item id;
   - its own spring chains;
   - MToon materials with white or greyscale albedo;
   - a JSON sidecar giving its slot, conflicts, tint channels and the body triangles it hides.
3. Attach. Map item bones to base bones by name, and graft extra bones under the matching parent. Rebind each mesh with a new Skeleton made of the base bones in the item's own order plus cloned item inverse binds, bound with the mesh's existing bind matrix. Never call `bind()` without a matrix, never recalculate inverses while she is posed, and never assign another mesh's skeleton ([three.js SkinnedMesh r180](https://github.com/mrdoob/three.js/blob/r180/src/objects/SkinnedMesh.js)). Optionally, bake each item into the base's bind space at rest so it shares her skeleton.
4. Springs. Create the item's joints on the base manager, with colliders matched by bone name. After any attach, removal or reshape: return to rest, call `setInitState`, call `reset`, and rebuild `createSprings`.
5. Hidden skin.
   - Filter the body index with the union of the worn items' triangle sets (VRoid's skin-mask idea, [help](https://vroid.pixiv.help/hc/en-us/articles/4405516267033-How-to-use-Skin-Masks)), and keep the full index for normals.
   - Shrink the body slightly under tight garments.
   - Paint underwear, tights and socks into the body texture, so removing items can never show a bare body. This carries Bijou's "the base slip is not optional" rule into 3D.
6. Fit. Run attached meshes through the existing body field before rebinding, so body sliders refit them.
7. Colour. Use MToon `color` and `shadeColorFactor` on each material and its outline clone. Leave expression-bound materials alone, or update their binds.
8. Hair swaps use the garment path. Accessories are rigid meshes parented to a bone, plus the spring strips in `js/vrm-accessory.js` (call it at rest, because it takes its rest from the current pose).
9. Fallback, if runtime attach proves fragile: one file per look, with pieces toggled by visibility (the VSeeFace and Warudo approach). It costs download size and free mix-and-match.

Reusable code: CharacterStudio's [cull-mesh.js](https://raw.githubusercontent.com/M3-org/CharacterStudio/main/src/library/cull-mesh.js) (MIT, "Copyright (c) 2022 Atlas Foundation", verified), together with three-mesh-bvh (MIT, verified), can precompute hidden faces in a dev script. Rewrite its culling-layer precedence rather than copying `characterManager.js`.

Integration debt to clear first: the two pipelines disagree about springs, and the morph rig rebinds every skeleton when the body is reshaped.

What each model path allows:

| Path | Body sliders | Mix and match | Recolour | GLB export | Whole-outfit swaps |
|---|---|---|---|---|---|
| Blender-made CC0 model (Shapell, Hiyori, Himiko 2022) | yes | yes | yes | yes | yes |
| Owner-made VRoid heroine without a pixiv licence | no | no | no | no | yes, as separate full exports of one .vroid with identical options (inference; confirm with pixiv) |
| Owner-made VRoid heroine with a pixiv licence | as licensed | as licensed | as licensed | as licensed | yes |
| Current β AvatarSample_4 | existing features only | nothing new | nothing new | nothing new | nothing new |
| Visitor's own VRM | only if its meta allows modification | only if allowed; Bijou items are not promised to fit | only if allowed | not for a modified VRoid-made model | n/a |

## 6. Learn from

Copy the ideas, and where marked MIT, the code with its notice. Bundle no asset from any companion. MIT's one condition is: "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software." Keep each notice in the ported file's header or in a `js/vendor/*-LICENSE.txt`, and list it in `assets/ATTRIBUTION.md`.

- **Project AIRI** ([repo](https://github.com/moeru-ai/airi); MIT, "Copyright (c) 2024-PRESENT Neko Ayaka", verified).
  - Port the tap and pat recogniser ([touch.ts](https://github.com/moeru-ai/airi/blob/main/packages/stage-ui-live2d/src/composables/live2d/touch.ts)). A tap moves at most 8 px within 450 ms. A pat is a stroke over the head that turns back, and each further 70 px counts as another pat.
  - Port the touch reaction. A head pat rises in 0.15 s and fades over 0.7 s, tilting the head 9 degrees, dipping it 5 and narrowing the eyes. Up to 8 impulses can overlap.
  - Port the saccade gap table, in 400 ms steps starting at 800 ms ([eye-motions.ts](https://github.com/moeru-ai/airi/blob/main/packages/stage-ui-three/src/composables/vrm/utils/eye-motions.ts)).
  - Port the VRM hit boxes on bones, scaled by height over 1.6 m and kept within 0.65 to 1.5 ([interaction.ts](https://github.com/moeru-ai/airi/blob/main/packages/stage-ui-three/src/composables/vrm/interaction.ts)).
  - The touch code serves Live2D only, so region detection and the reaction output must be rewritten for bones and VRM expressions, and its TypeScript with Vue refs ported by hand.
  - Leave its `idle_loop.vrma`, which has no stated source or licence.
- **pixiv ChatVRM** ([repo](https://github.com/pixiv/ChatVRM), archived; MIT, "Copyright (c) 2023 pixiv Inc.", verified). Take two ideas, not files: the eyes yield to a clip's own gaze by 1 - smoothstep(30, 90 degrees), and an emotion is applied only after a blink reopens. Skip its AutoBlink (a fixed 5 s, weaker than Bijou's) and its head follow (it would turn the head twice).
- **TalkingHead** ([repo](https://github.com/met4citizen/TalkingHead); MIT, "Copyright (c) 2023-2024 Mika Suominen"; `dynamicbones.mjs` carries its own MIT header; verified).
  - Use `dynamicbones.mjs` only for extras that have no VRM springs.
  - Copy the mood scheduler's pattern, not its ARKit values. In the neutral mood, breathing is 1.2 s in, 0.5 s hold, 1.0 s out and 1.5 s pause, and the weight shifts every 5 to 30 s.
  - Leave `brunette.glb` (CC BY-NC 4.0), its Mixamo FBX files and its example avatars.
- **Mate Engine** ([repo](https://github.com/shinyflvre/Mate-Engine)). Licence: MateEngine Pro License v2.1, under which derivatives take the same licence and commercial use is banned; its assets are "copyright Shiny". Take numbers only, and write Bijou's own code:
  - a new idle every 12 s with 3 s blends;
  - sleep after 60 s without attention, woken by a drag;
  - drag sway on a 2.6 Hz spring with damping 0.35, capped at 25 degrees of roll and 12 of pitch;
  - cursor following with the head up to 45 degrees across and 30 up and down, the spine up to 15 degrees split 1.0, 0.8 and 0.6 over spine, chest and upper chest, and the eyes up to 12;
  - hover pats by circling the head 540 degrees, or by wiggling 180 px with 3 reversals.
  Its 128 clips (35 idle, 26 sitting, 17 dance, 9 reactions) are the bar a lively companion is judged against.
- **VPet** ([repo](https://github.com/LorisYounger/VPet); Apache-2.0 code, art under separate terms, per the researcher's reading). Every reaction has a start, a loop and an end, with states for being lifted, head touch and body touch.
- **Shimeji-ee** ([behaviors.xml](https://github.com/gil/shimeji-ee/blob/master/conf/behaviors.xml); BSD-style). Behaviours are picked at random by weight, and some fire only on events (dragged, thrown, fall, land).
- **Live2D Cubism samples** ([lappmodel.ts](https://github.com/Live2D/CubismWebSamples/blob/develop/Samples/TypeScript/Demo/src/lappmodel.ts); licence not read, so numbers only). Breathing uses sine waves with cycles from 3.23 to 15.53 s that never line up. A blink comes about every 4 s: 0.1 s to close, 0.05 s shut, 0.15 s to open.
- **VTube Studio** ([wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/Interaction-between-Animations,-Tracking,-Physics,-etc.)). Per-bone priority, from lowest to highest: default, idle, tracking, one-shot, expression, physics. Every handoff is faded.
- **Desktop Mate** ([Steam](https://store.steampowered.com/app/3301060/Desktop_Mate/); proprietary). Use it as the interaction checklist: sitting on a window, playing with the cursor, head pats with voice, an alarm, and several characters with pair actions. Its developer has ruled out VRM loading.
- **wlipsync** ([repo](https://github.com/mrxz/wLipSync); MIT, hecomi 2021 and Noeri Huisman 2024, verified). Only relevant if she ever speaks: it maps vowels A, E, I, O, U to the VRM mouth shapes aa, ee, ih, oh, ou. Vendor its LICENSE yourself, because the dist carries no notice. Skip its example `sample-avatar.vrm` (VRM Public License 1.0).
- **Amica** ([repo](https://github.com/semperai/amica); MIT code, while "Assets such as 3D models and images are released under their authors respective licenses"). It offers nothing new: its look-at, blink and lip-sync are byte copies of ChatVRM. Leave its nine VRMA files, seven of which match pixiv's pack by name.

## 7. What needs the owner

Decisions
- [ ] Look at the previews of Shapell ([1349366](https://booth.pm/ja/items/1349366), [7421313](https://booth.pm/ja/items/7421313)), Mizunashi Hiyori ([6120660](https://booth.pm/ja/items/6120660)) and Himiko 2022 ([4023978](https://booth.pm/ja/items/4023978)). Say which, if any, reads as an adult, and drop the rest.
- [ ] Pick the path: path 1 now (recommended), or wait for pixiv and take path 2.
- [ ] Confirm "no" to non-commercial sources such as Bandai Namco (recommended).
- [ ] Decide whether `dev/` stays public on Pages. `_config.yml` excludes only Markdown, so `dev/model-studio.html` is served publicly. It exports GLB files containing the β sample's face, and its "Game heroine" face is a geometric interpretation of a Tifa Lockhart reference (per `assets/ATTRIBUTION.md`).
- [ ] Decide when to push. bijou-site `main` is 3 commits ahead of origin: 84e2d12 (runtime and Doll Lab), 772b543 (physics) and 6678ed2 (research doc). The live site has neither the Lab nor three-vrm-animation.

Accounts and terms
- [ ] A pixiv account for BOOTH (BOOTH download links redirect to booth.pm/users/sign_in). BOOTH's own platform terms were not read, because robots.txt disallows /terms.
- [ ] Only if the VRoid Hub conversion is wanted: a VRoid Hub login, which means accepting the VRoid Hub Terms.

Downloads: models (keep a dated copy of each listing page, and record each file's SHA-256)
- [ ] Shapell maid VRM 1.0, sashii: https://booth.pm/ja/items/7421313, ShapellFuku5.1.zip, 11.8 MB, CC0 1.0 (inherited).
- [ ] Shapell v1.0.3, lowteq: https://booth.pm/ja/items/1349366, Shapell_v1_0_3.zip, 30.3 MB, CC0 1.0 (the arktoon shader is excluded).
- [ ] Optional: Mizunashi Hiyori: https://booth.pm/ja/items/6120660, Henge_MizunashiHiyori_20240922.zip, 67.2 MB, CC0 for the CC0_FBX and CC0_Texture folders only.
- [ ] Optional: Himiko 2022: https://booth.pm/ja/items/4023978, Himiko2022_plus_20230819b.zip, 141 MB, CC0 for the FBX and Texture folders only.
- [ ] Optional, low value: Shapell VRM 0.0 on VRoid Hub: https://hub.vroid.com/characters/2659905496918897597/models/406149290929678011, 30.0 MB, CC0 source plus Hub conditions.

Downloads: motion
- [ ] Sachi VRMA 1: https://booth.pm/ja/items/6412084, SachiVRMA1.zip, 56.1 MB, CC0.
- [ ] rerofumi motion set: https://booth.pm/ja/items/5527394, fm_vrma_motion_pack_01.zip, 4.42 MB, CC0.
- [ ] KayKit Character Animations 1.1, free tier: https://kaylousberg.itch.io/kaykit-character-animations, 14 MB, CC0. Use the itch.io copy only; whether itch.io needs an account was not determined.
- [ ] Mesh2Motion: the 135 untagged human clips plus `human/skeleton.glb`, from https://github.com/Mesh2Motion/mesh2motion-app at one pinned commit. Size not determined. CC0 1.0 for the art, MIT for the code.
- [ ] Second wave: 100STYLE BVH from https://zenodo.org/records/8127870 (100STYLE.zip; the record's two files total 15.11 GB), CC BY 4.0.
- [ ] Hold: Quaternius UAL1 Standard (15 MB) and UAL2 Standard (size not determined). Before bundling:
  - read any licence file inside the zips;
  - save dated Wayback captures of the four listing pages;
  - give the folder its own CC0 notice, outside the MIT grant;
  - optionally, ask the creator to confirm the packs remain CC0, through the contact in the quaternius.com footer.

Installs
- [ ] Blender, which is free. Its version, size and Apple Silicon build were not checked, because blender.org disallows our crawler.
- [ ] The VRM Add-on for Blender (https://github.com/saturday06/VRM-Addon-for-Blender), which supports Blender 2.93 to 5.2. It is MIT per the GitHub API; one researcher read it as MIT or GPL-3.0-or-later. Blender and the add-on are needed for path 1.
- [ ] Only for path 2: VRoid Studio v2.16.0 (.dmg at https://vroid.com/en/studio, or Steam app 1486350). Free, about 10 GB, and installing it means accepting the VRoid Studio Terms.
- [ ] Nothing to install: bvh2vrma (https://vrm-c.github.io/bvh2vrma/) and the Mesh2Motion web app (https://app.mesh2motion.org/) run in the browser.

Purchases
- [ ] None required. Optional later: Tripo API credits at $0.01 each, for single garments or props (free-tier output stays Tripo's).

Messages to send
- [ ] pixiv, through the inquiry form that pixiv's pages link to (https://www.pixiv.net/support?type=45&mode=inquiry&service=vroid-feedback; not fetched, because pixiv.net disallows our crawler). Ask:
  - (a) does Art. 13(3) apply to the CC0 β samples in a free public dress-up app with body editing and GLB export?
  - (b) may an owner-made VRoid model ship in such an app, either fixed or customizable?
  - (c) may Bijou bundle the VRMA 7-pack and ChatVRM's `idle_loop.vrma`?
  Describe the app honestly, including its swimwear and underwear items, because the 7-pack's terms bar sexual use.
- [ ] Optional:
  - ask MITUBASINA whether CC0 covers Haku_v1.51.zip;
  - ask Jen Jell where Josie's Run, SlowRun and Walk came from;
  - ask the authors of BOOTH 8815790 and 9089908 whether Bijou may bundle their packs.

## 8. Phased build plan

Every phase ends with a check the owner judges by eye in `dev/lab.html` or in the companion, alongside the scripted checks (`node dev/lab-check.cjs`, `node --test dev/avatar-math.test.mjs`).

Phase 0, start today with no new assets (on `bijou.vrm` and the runtime ribbons):
- 0a Physics: the drag floor, per-metre stiffness with rebuilt collider radii, joint re-add on collider change, exact damped body springs, per-chain variation, and the cone-limit port tried on ribbons and hair.
  Check: carry, toss, twirl and land her at 30 Hz (Energy Saver on, on battery) and at 120 Hz. Hair and ribbons settle in 2 to 4 swings and look the same at both rates, nothing passes through the face, and Bouncy never reads as jelly.
- 0b Behaviour:
  - an idle scheduler: clips with start, loop and end parts; a new idle about every 12 s with blends of about 3 s; weighted choice; event-only drag, toss, fall and land;
  - per-bone priority with faded handoffs;
  - AIRI-style pat counting and reaction impulses;
  - breathing cycles that never repeat.
  Check: left untouched for 5 minutes, she shows no visible loop and dozes off near the 60 s mark. Out of 10 head strokes and 10 drags, every stroke reads as a pat and every hold-and-drag as a pickup.
- 0c Companion adapter: drive `index.html` from `js/vrm-runtime.js` behind the `doll` interface and a query flag, keeping the SVG fallback.
  Check: pop her out, drag the Picture-in-Picture window, switch tabs and come back. There is no hair flip and no explosion, and reduced motion stills the springs.
- 0d Tooling and hygiene:
  - the retargeter dev page, with unit tests of the formula on synthetic A-pose and T-pose skeletons;
  - a licence notice in each asset folder, outside the MIT grant;
  - an `ATTRIBUTION.md` entry template (source URL, author, licence, date, SHA-256).
  Licence-restricted test files (the pixiv pack, Mixamo) stay local, because `dev/` and `assets/` are public.
  Check: the owner reads the attribution layout and agrees it says where every file came from.

Phase 1, after the motion downloads are approved:
- Convert Sachi, rerofumi, KayKit and the 135 Mesh2Motion clips to `.vrma`. Audition each in the Lab, retime the keepers, commit only the `.vrma` files with their notices, and feed them to the scheduler.
  Check: the owner watches every clip from the front and the side and marks it keep, retime or drop. Feet stay planted in idles, the hips do not drift, and hands never pass through her body or skirt. The scheduler ends up with at least 6 idles and 6 reactions the owner calls cute.

Phase 2, after the model is approved:
- 2a Drop the sashii VRM 1.0 on `dev/lab.html` from the owner's disk (not committed). Read `vrm.meta`, the expressions, the springs and what is under the clothes.
- 2b The owner, following the builder's step list, converts `shapell_parts.fbx` (or the maid VRM) in Blender:
  - map the humanoid bones;
  - add springs for the bangs, long hair, ears, tail and radial skirt chains, using the table in section 4;
  - add colliders, including thigh capsules;
  - map her nine faces to VRM expressions;
  - use MToon with greyscale albedo on the parts that can be tinted;
  - paint a base layer into the body texture;
  - set the VRM 1.0 meta to allow everything, with CC0 in `otherLicenseUrl`;
  - give her Bijou's own name;
  - commit her with the source zip's SHA-256.
  Check: in the Lab, at rest and while carried, tossed and twirled, the owner judges that she reads as an adult and as cute. Every expression is clean with no eye clipping, the skirt never passes through her legs, and no bare skin shows with every removable item off.

Phase 3, dress-up on the new base:
- Build the item pipeline: attach by bone name, merged springs, hidden-skin sets and tinting. Author the first items in Blender against her T-pose: one hair swap, one skirt, one top, a bow and glasses.
  Check: swapping each item while she swings causes no recoil or pop. A pose sheet with arms raised and sitting shows no poke-through. Tint moves the lit and shade colours together, and body sliders keep every item fitted.

Phase 4, the companion switch:
- `index.html` uses the VRM runtime by default, saved looks migrate, and the SVG fallback stays.
  Check: the owner keeps her popped out through a working day. She never freezes or explodes; pats, drags, dozing and waking all work; and the console stays clean.

Phase 5, conditional:
- If pixiv says yes: build the owner's VRoid heroine as path 2 and test her in the same Lab.
- If the Quaternius checks pass: add the sitting set, Idle_FoldArms and Yes.
- The owner records or keys signature clips (a greeting, a shy wave, a stretch) and releases them as CC0.
  Check: side by side with the earlier clips, the owner picks which read cuter.

## 9. Unverified and open

Licensing
- How pixiv reads Art. 13(3) and Art. 7 in four cases:
  - the CC0 β samples;
  - an owner-made VRoid model inside an app that offers dress-up and export for a different model;
  - whole-outfit swaps between full exports;
  - a visitor's own VRoid file.
  Also whether pixiv would grant the separate licence, and on what terms.
- Whether the VRoid Hub and Studio terms bind the copy of β4 taken from the madjin mirror (the source of `bijou.vrm`); that repo has no licence file. `assets/ATTRIBUTION.md` says that copy embeds CC0, while pixiv's Hub copy embeds licenseName "Other".
- Ages. None of Shapell, Hiyori, Himiko 2022, β2, β3, β4 or HairSample_Female states one. The verifiers viewed no product images, and two BOOTH previews (Hiyori, Himiko 2022) arrived truncated for the researcher.
- The contents of every zip: LICENSE.txt files, readmes, third-party parts, bare bodies, and the maid VRM's embedded meta. No binaries were downloaded.
- Quaternius: whether the QAL is meant to reach its CC0-labelled packs and the 87 Mesh2Motion clips taken from them, and which 45 UAL1 clips are in the free tier.
- Sachi VRMA 1: the clip list, and what footage the capture clips came from.
- XR Animator: whether its CC BY-NC-SA 4.0 licence reaches exported motion. Also bvh2vrma's output quality.
- Terms that were not read:
  - Mixamo's official FAQ (403);
  - Rokoko's terms (403);
  - the AIST++ data licence;
  - BOOTH's platform terms (robots.txt);
  - Meshy's plan prices (robots.txt);
  - Tripo's definition of "Paid User";
  - Rodin's terms, whose sections 2 and 5(b) conflict.
- Whether Bijou counts as non-commercial for CC BY-NC. This is moot while NC sources stay out.

Technical
- Spring bones, blendshape names and expression mapping inside the FBX candidates. Also whether the VRM Add-on authors and previews VRMC_springBone (its README is silent and its docs render client-side).
- The Mesh2Motion skeleton's rest pose and exact bone names; the map in section 3 is composed, not checked against a GLB. Also retarget quality on anime proportions, KayKit's chunky-rig offsets, and a Godot store review saying UAL over-bends the upper chest.
- Physics:
  - cost in Chrome on low-end phones (every number here is from Node on an M4 under heavy load);
  - whether Chrome throttles a Document Picture-in-Picture window's rAF;
  - whether the proxy center handles root rotation as cleanly as translation;
  - how runtime bone chains interact with the dual-quaternion skinning in `avatar-skinning.js`;
  - when three-vrm 3.6 with limits reaches npm, and whether it will accept the ratified "1.0".
- Whether VRoid Studio 2.16 exports still author bust springs, and whether two exports of one .vroid share identical rest transforms (test: export twice and diff).
- The cause of the old renderer's fringe recoil. The dress-up researcher's hypothesis is that springs were re-initialised away from rest.
- The owner's Blender learning time, and the cost of commissioning an artist under written CC0 terms instead (not studied).

Side findings
- The brief's three-vrm 3.4.2 is out of date. A verifier read the live bundle's legal comments as 3.5.5 (shipped in 10c83b1), while origin's build script and `ATTRIBUTION.md` still say 3.4.2. three-vrm-animation exists only in the unpushed commits; its licence file returns 404 on the live site.
- A verifier saw bijou.neorgon.com present GitHub's *.github.io certificate over HTTPS, with Pages reporting https_enforced false. Not rechecked.

Process
- The synthesis input was cut at 180,000 characters and held only the models report and part of its verdicts. The other five reports were read from the workflow's research files, and all 57 verdicts from the verifier transcripts on disk.
- One researcher requested blender.org/download once, in the same command as the robots.txt check, which disallows Claude's crawler. The page was discarded, and nothing here relies on it.
- Sites skipped because robots.txt disallows Claude's crawler include blender.org, www.pixiv.net, www.meshy.ai, reddit.com, opengameart.org, airi.moeru.ai, vroid-hub.pximg.net, booth.pm/terms and forum.reallusion.com.
- This is research, not legal advice.