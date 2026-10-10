<div align="center">

# Bijou

Dress, pose and keep an anime doll on your desktop

[![Live][badge-site]][url-site]
[![HTML5][badge-html]][url-html]
[![CSS3][badge-css]][url-css]
[![JavaScript][badge-js]][url-js]
[![Claude Code][badge-claude]][url-claude]
[![License][badge-license]](LICENSE)

[badge-site]:    https://img.shields.io/badge/live_site-0063e5?style=for-the-badge&logo=googlechrome&logoColor=white
[badge-html]:    https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white
[badge-css]:     https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white
[badge-js]:      https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black
[badge-claude]:  https://img.shields.io/badge/Claude_Code-CC785C?style=for-the-badge&logo=anthropic&logoColor=white
[badge-license]: https://img.shields.io/badge/license-MIT-404040?style=for-the-badge

[url-site]:   https://bijou.neorgon.com/
[url-html]:   #
[url-css]:    #
[url-js]:     #
[url-claude]: https://claude.ai/code

</div>

---

## Overview

Bijou is a dress-up doll who lives on your screen. Drag clothes onto her, give her a new face and hairstyle, and keep her company: she blinks, breathes, follows your cursor, reacts when you pat her head or poke her cheek, dozes off when ignored, and asks for outfits she would like. Time spent together earns hearts, and hearts unlock more of her wardrobe. In Chrome or Edge she pops out into a small window that floats above your other apps.

**Live:** bijou.neorgon.com

---

## Features

- **Drag and drop dressing** -- 96 pieces (36 to start with) across dresses, tops, bottoms, swimwear, layers, socks, shoes, accessories and things to hold; slot rules swap a dress for a top and skirt the way you would expect
- **Clothing studio** -- adaptable underwear, jeans, leggings, jeggings, crop tops, tees, camisoles, sweaters, skirts, dresses and the bikini; colors, fabric, neckline, cut, stretch and regional fit, with fitted/relaxed/oversized quick starts
- **Signature looks** -- Sea-glass bikini, Rose captain and Midnight bunny apply a complete hairstyle and outfit, with every piece available to mix and match. An ivory atelier frames the figure, alongside the four original rooms.
- **Body studio** -- five starting shapes, nine regions with width and depth, independent cup volume/spacing/placement, detailed belly and armpit controls, regional extended fullness, mouse/touch sculpting, reset and undo/redo
- **Detail inspection** -- selecting a region frames it; orbit with mouse/touch, zoom, or inspect face and hands. Leaving shaping restores the normal camera and companion behavior
- **Art finishes** -- soft 3D anime by default, crisp 2D animation and physical shading; stored with each look
- **Archetype quick starts** -- Elegant, Bright, Athletic and Gentle set editable proportions, height, resting posture and mannerisms while preserving the selected face and outfit
- **Small details** -- nail shape, length and six polish colors, with a close-up hand view; Light, Balanced and Detailed rendering settings
- **Soft motion** -- adjustable bounce and damping, shared by the body and clothing, with an off setting and reduced-motion support
- **Hair motion** -- anchored guide chains with adjustable movement, stiffness and damping, body contact and reduced-motion support
- **Moves on her own** -- 16 selectable poses, subtle head and finger movement, archetype-specific idle preferences, a twirl, and she dangles when you pick her up and lands when you let go
- **Personality** -- greetings by time of day, reactions to pats and pokes, sleepiness when ignored, a daily present, and style wishes you can grant for bonus hearts
- **Make her yours** -- Hime with the oval face by default; nine ready-made heads, 14 hair colours, ten hairstyles, five bangs, four face shapes, 11 eye colours, four eye shapes, eight skin tones, height and build
- **Desktop companion** -- Pop out opens an always-on-top window (Document Picture-in-Picture); elsewhere, Companion view fits her to a small window you can park beside your work
- **Looks and snapshots** -- save up to eight full looks, and save a PNG of her in her room
- **Stays on this device** -- outfits, hearts and looks are kept in this browser; nothing is sent anywhere

---

## Running locally

ES modules require an HTTP server (not `file://`):

```bash
make serve
```

Then open http://localhost:8897.

The experimental [model studio](http://localhost:8897/dev/model-studio.html) lets
you reshape, dress and export the two Meshy body studies with a clean anime head.
The earlier Game heroine head remains a separate starting choice. Body, Face, Hair,
Style and Clothes tabs provide 20 shape controls, nine silhouettes (including a flat,
slender build), 150–195 cm height, adult appearances from the 20s through 60s,
and six face treatments. Oval stays the default; Game heroine interprets the
requested Tifa Remake reference. Three fitted tops and three bottoms have
independent colors and fit, plus five outfit starting points. Figurine, Hime and
Game heroine starters combine face and hair choices. Upper-arm and forearm length
move the joints and sleeves; body presets use different limb proportions.

Face controls include horizontal/vertical gaze, pointer following, optional head
tracking, automatic blinking and five expressions. Hair controls provide Hime,
side-swept and bob silhouettes, color, length, volume, sheen and bounded sway.
Hime uses the existing CC0 anime face with separate iris/lash surfaces and authored
blink shapes. Its layered hair has tapered ends and refits around the torso;
the arms rest closer to the body. Original hair remains selectable. Reduced motion stops automatic
movement while keeping explicit gaze and expression settings.

The Aion-inspired refinement adds 31 geometric face details, skin/iris/makeup
finishes, a physical studio surface, editable lighting and six adult portrait
starts with bounded variations. The realistic starter recolors the original hair
sculpt. Fine features can be framed individually for close-up orbiting.
Face normals fit the local surface and edited tangents follow gaze/blinking.
Eye clarity restores the sclera/iris/pupil; source hair has strand definition
and independent roughness. Soft diffuse falloff remains a preview treatment.
Base comparison, shared undo/redo and per-model drafts cover the whole look.
Version 4 look files retain every editor plus the studio lighting and accept older
files. GLB downloads include fitted clothing, hair, manual gaze/expression, baked
skin/iris/makeup color and roughness maps, the edited skeleton and source clips.
Automatic blinking, tracking, pore shading and hair motion remain preview behaviors.
See [creator research and remaining art requirements](docs/CHARACTER-CREATOR.md).
The main Body tab
links to the studio.
The user rejected the MakeHuman anatomy study's visual result. It is withdrawn
from the picker and public links; its files and drafts remain available for
internal development. Source provenance and reproduction are in
[the study notes](assets/studies/human-adult-v1/README.md). Fresh Hime/Oval drafts
use balanced Figurine proportions with a tee and jeans; existing settings remain.
The corrective integration is checked by `node dev/model-anime-check.cjs`.
The Meshy candidates still need body surfaces beneath the original outfit.
Every source needs refined facial art, a groom, detailed maps, finger articulation
and collision integration before replacing the companion model;
[findings and costs](assets/studies/meshy-hime-t2/README.md).

---

## Architecture

The live doll is a skinned 3D avatar with a local Three.js/VRM renderer, physical
coordinated anime shading and an optional physical finish. Its body is refined across source
mesh seams and uses dual-quaternion skinning shared by fitted clothing and shadows.
Arm targets interpolate in 3D and a two-bone solver checks body and arm clearance.
Body morphs update the mesh and skeleton bind pose; clothing fits the resulting
surface with independent allowance. Shoulder and hip corrective targets preserve
joint contours. Leg IK plants feet and measures contact against the seat. Bounded
springs add secondary motion; skirts use a procedural seated drape. This is a
character constraint system, not a general rigid-body or cloth simulation.

The original SVG renderer remains the fallback and supplies wardrobe thumbnails.
The logical rig space still drives interactions, effects and pose animation.
The contract is [`docs/RIG.md`](docs/RIG.md); model provenance and dependency
licenses are in [`assets/ATTRIBUTION.md`](assets/ATTRIBUTION.md).

Requests, implementation status, open visual issues and investigations live in
[`docs/COMPANION-ROADMAP.md`](docs/COMPANION-ROADMAP.md). The
[archetype study](docs/ARCHETYPES.md) and
[clothing-template implementation](docs/CLOTHING-TEMPLATES.md) distinguish current
features from planned work. [Look-development research](docs/LOOK-DEVELOPMENT.md)
records primary animation/figurine sources and visual limitations. The full custom
pose editor and loose-cloth simulation remain on the roadmap.

```
bijou-site/
├── index.html          # Page shell: stage, wardrobe panel, dialogs
├── css/style.css       # All styles; the stage art keeps its own colours
├── docs/RIG.md         # The rig contract every drawing speaks
├── js/
│   ├── app.js          # Entry point, wires the pieces together
│   ├── avatar.js       # 3D stage, snapshots, picking, SVG fallback
│   ├── avatar-model.js # Model, hair, face and wardrobe preparation
│   ├── avatar-surface.js # Continuous body refinement and normal smoothing
│   ├── avatar-skinning.js # Shared dual-quaternion skinning
│   ├── avatar-morph.js # Shared surface / bind-pose deformation
│   ├── avatar-arms.js  # Retargets the collision-constrained arm solutions
│   ├── avatar-collision.js # Analytic IK and collision volumes
│   ├── avatar-dynamics.js # Body/garment spring and seated-drape shaders
│   ├── avatar-hair-motion.js # Strand shaders and head/body contact
│   ├── avatar-nails.js # Fitted, skinned nail surfaces
│   ├── hair-chain.js   # Fixed-step constrained hair guides
│   ├── archetypes.js   # Starting bodies, postures and mannerisms
│   ├── body-shape.js   # Regional fields and body presets
│   ├── body-editor.js  # Shape controls, gestures, undo/redo
│   ├── clothing-editor.js # Pattern, fabric and fit controls
│   ├── garment-templates.js # Validated clothing parameters
│   ├── avatar-fit.js   # Clothing envelopes fitted after body shaping
│   ├── avatar-finish.js # Shared anime lighting treatment
│   ├── avatar-support.js # Ground and seated support
│   ├── avatar-correctives.js # Joint-driven relative shape corrections
│   ├── pose-reaches.js # 3D hand targets and elbow directions
│   ├── soft-spring.js  # Bounded fixed-step integration
│   ├── rig.js          # Measurements, bones, forward kinematics, IK
│   ├── poses.js        # Pose data and the pose solver
│   ├── motion.js       # Animation loop: blending, breath, springs, drag, twirl
│   ├── doll.js         # Composes pieces into the SVG and applies frames
│   ├── body.js         # Skin pieces and hands
│   ├── face.js         # Face, eyes, expressions
│   ├── hair.js         # Hairstyles on spring bones
│   ├── paint.js        # Colour, outlines, cel shading, fabric patterns
│   ├── wear-kit.js     # Garment shape builders (bodice, sleeves, skirts, trousers)
│   ├── wear.js         # Clothes generators, the base slip, the outfit compositor
│   ├── wear-legs.js    # Socks, tights, shoes
│   ├── wear-acc.js     # Hats, hair pieces, neckwear, glasses, held items
│   ├── wear-costume.js # Captain uniform and tuxedo suit on the shared rig
│   ├── catalog.js      # Every item, its slot, tags and unlock
│   ├── collections.js  # Complete signature looks assembled from catalog items
│   ├── looks.js        # Skin, hair and eye palettes, styles, ready-made heads
│   ├── behavior.js     # Her mind: idles, reactions, sleep, wishes
│   ├── lines.js        # What she says
│   ├── wardrobe.js     # Equipping, unlocking, hearts, streaks, milestones
│   ├── interact.js     # Pat, poke and pick up gestures
│   ├── dnd.js          # Dragging clothes on and off
│   ├── fx.js           # Particles and the speech bubble
│   ├── stage.js        # The atelier and four rooms
│   ├── companion.js    # Pop-out window, Companion view, snapshots
│   ├── thumbs.js       # Wardrobe thumbnails and mini dolls
│   ├── render.js       # Wardrobe, worn strip, hearts, wish
│   ├── panels.js       # Style, poses, looks, progress
│   ├── events.js       # Every listener
│   └── state.js        # Saved state, validated on load
├── robots.txt
├── sitemap.xml
├── CNAME
├── Makefile
└── README.md
```

For visual checks, `dev/model.html?look=captain&pose=stretch` uses the live 3D
renderer without behavior timers. Its `window.study` interface supports changing
the config and pose, stepping a frame, and reading solver diagnostics.
Use `?archetype=elegant&view=profile&finish=anime3d` to study a quick start from the side.
`dev/sheet.html` remains the SVG fallback study.

Run `node --test dev/avatar-math.test.mjs dev/avatar-foundation.test.mjs` for arm lengths, collider clearance
through poses/transitions, local abdomen/armpit morphs, and body/hair spring
stability at different frame rates. `node dev/avatar-browser.cjs` exercises the live renderer and controls
with Playwright installed and `make serve` running. `node dev/avatar-customization.cjs`
checks tailoring, finishes, camera gestures, saved looks and the support matrix.

---

<div align="center">
<sub>Part of <a href="https://neorgon.com/">Neorgon</a></sub>
</div>
