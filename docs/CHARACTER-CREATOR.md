# Character creator: Aion 2 quality direction

The 2026-10-05 request asks for the detail and realistic presentation of Aion 2's
creator. Hime/Oval remains the default, and the accepted Game heroine face stays
available. This refinement is in [Model Studio](../dev/model-studio.html), separate
from the live companion and its saved looks.

## References and research

The supplied thumbnail and `Character_creation_face_screen_aion_2_wiki.avif`
show a grounded fantasy face, fine skin highlights, natural hair silhouettes,
portrait choices, skin tone/gloss controls and an interactive lighting position.
The larger reference visibly separates Face, Hair, Style and Body Shape.
These observations guide the editor and art direction; they do not establish an
exhaustive list of every game control.

[NC's official creator announcement](https://about.ncsoft.com/en/news/article/aion2_update_251116)
confirms more than 200 options across body shape, skin tone, eye color and muscle
definition, plus appearance presets. It does not itemize all 200 options or say
that they are all independent sliders. Bijou does not claim that feature count,
asset quality or game parity. No NC model, texture or game asset was imported.

The rendering investigation uses the primary
[Three.js physical material documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)
and [filtered environment documentation](https://threejs.org/docs/pages/PMREMGenerator.html).
The implementation uses environment reflections, controlled roughness and a
subtle procedural pore response. It does not simulate volumetric skin scattering.
Export follows [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html):
color maps use sRGB; roughness maps use non-color data and their green channel.

[Epic's Digital Humans guide](https://dev.epicgames.com/documentation/unreal-engine/digital-humans?application_version=4.27)
describes coordinated skin maps, anisotropic hair shading, and eye geometry/UVs
designed with the eye shader. Application-specific conclusion: restored iris
paint and softer diffuse falloff can improve this sculpt, but cannot replace
authored eyes, a groom and clean facial geometry. Bijou's soft falloff is a bounded
diffuse-light approximation; it is not Epic's subsurface or eye-shading pipeline.

The follow-up source investigation uses
[MakeHuman's core asset license](https://static.makehumancommunity.org/about/license.html)
and pinned public base/target/rig data. Its authored body loops offer a cleaner
anatomical starting point than a generated remesh. The studio adapts that data
with its own preparer and builder; it does not copy MakeHuman application code.
Exact source URLs, hashes and reproduction steps are retained in
[the anatomy study](../assets/studies/human-adult-v1/README.md).

## Corrective Hime presentation

The latest review rejected the neutral anatomy presentation: “oh god it's awful.”
Technical validity did not establish the requested character quality. That study
is withdrawn from the picker and public query links; its assets and drafts remain.

Hime's public detailed/light bodies now use the project's existing CC0 anime face.
The adapter retains separate iris, white, lash and highlight surfaces, authored
left/right blink shapes, UV alpha edges and smooth source normals. Manual gaze
moves the iris/highlights; the skin and lashes close over them during a blink.
The earlier Game heroine head is retained as a separate original-face candidate.
Raw source files and the asset inspector remain unchanged.

The old head is clipped without cutting the shoulder caps; detached hair fragments
are removed and a fitted neck transition joins the new head. Hime hair has shallow
layered locks, tapered ends, roots inside the crown and a rest fit around the torso.
The resting arms are lower; the original walking animation is still diagnostic.
Fresh Hime/Oval drafts start with balanced Figurine proportions, a tee and jeans;
existing body and clothing settings remain. Clothing uses geometric cut lines,
shared base/layer colors, and hides fully covered original triangles. Fitting
normals use the complete source index even when those base triangles are hidden.
Export preserves transparent facial edges, textures, weights and the same rest pose.

These corrections do not provide a finished body sculpt, constructed garments,
strand groom or Aion-level realism. The neck proportion, collar contour, face/body
balance and hair silhouette still need visual acceptance against the references.

## Withdrawn anatomical study

The internal anatomy study contains a continuous 26,756-triangle body,
separate eye surfaces, mandatory opaque base clothing, Hime-like source hair and
a 163-joint hierarchy. Its full prepared scene has 68,144 triangles. The arms are
baked into a relaxed standing pose; helpers are not rendered. Its clean normals
bypass the remesh repair used on the two Meshy candidates.

Source metadata calibrates face/eye landmarks and iris size. Body/face fields,
all 31 facial details, regional cameras, wardrobe, history, drafts and exports
are shared. Eyes rotate independently on their joints, and curved skin-colored
lid covers close over the eye surface. They preserve the nose bridge and eye
volume. Selected winks can export; automatic blinking remains a preview effect.
Their color and roughness use the same atlas bake as body skin, including when
exporting while the diagnostic clay preview is selected.
Fitted tops use geometric collar cuts and a bounded outward fabric envelope over
small chest contours, with normals rebuilt after fitting. It starts clothed in a
tee and trousers; base coverage remains under shorter garments.

For development inspection, load the studio and call
`await modelStudio.selectCandidate('human')`; `?model=human` no longer selects it.
Older drafts remain unchanged. This source is internal anatomical data, not an
accepted character baseline or a finished realistic heroine.
Facial/finger joints do not imply a finished articulation editor. It has no
walking clip. Facial muscle rigging, corrective poses, detailed maps, grooming
and live-companion adoption remain open.

## Available controls

| Region | Detail |
|---|---|
| Face/jaw | Width, length, cheekbone width/fullness, jaw width, chin width/length/projection |
| Eyes/brows | Eye size/width/height/spacing/tilt/depth, upper/lower lid height, brow height/angle |
| Nose | Bridge projection, width, length, tip projection, nostril width |
| Mouth | Width, vertical position, upper/lower fullness, projection, corner lift |
| Ears | Size and angle |
| Skin | Tone and coverage, roughness, source normal detail, fine pores, freckles, soft light falloff |
| Makeup | Blush color/strength, lip color/coverage/gloss, lash definition |
| Iris | Color/coverage, surface clarity, radial pattern scale, pupil detail, edge definition, gloss |
| Source hair surface | Strand definition and matte finish, separately from hairstyle geometry |
| Light | Drag/keyboard position pad, azimuth, elevation, exposure, fill, rim; three backdrops |
| Portrait starts | Six adult face/palette recipes, repeatable bounded variations |

There are **31 geometric face controls** and **18 surface/detail controls**.
The existing 20 body controls, nine silhouettes, adult ages, fitted clothing,
gaze, expressions and hair editor remain. Every face control deforms the imported
surface, rather than changing a label. Details are symmetrical, local to the head,
bounded in metres and recalculated from immutable rest vertices. Eye/lash anchors
follow the same face and height fields. Region selection can move the camera
close to eyes, nose, mouth or ears; orbit and zoom remain available.

Six portrait starts—Nightbloom, Snowdrop, Amber, Jade, Lilac and Ember—combine
adult face details, skin/iris palettes and recolored source hair. Variations keep
the selected adult age, body and clothes. One undo restores the whole prior look.
The realistic starter uses each candidate's authored source hair. On corrected
Hime that is the retained CC0 scalp/fringe; the original Game heroine candidate
retains its Meshy hair. Color is editable; unsupported length, volume and
sway sliders are disabled. The three generated silhouettes remain alternatives.

## Surface and export

Skin coverage reduces painted contrast and repairs gray skin margins using the
mesh's semantic hints. Hair masks keep lateral locks out of the lower-face cleanup.
Eye surface clarity restores the sclera, radial iris and pupil while preserving
the captured lash outline and small catchlights. Zero retains the original eye
treatment. This restoration follows gaze and blinking through the same surface.

On the original generated head, angle-limited normal smoothing and a local quadratic fit soften cheek,
nose and chin creases without moving vertices. The fit fades at the face boundary,
rejects opposing directions and excludes hair neighbors. Source eyelid folds are
preserved. Tangents regenerate against the edited normals/UVs and follow gaze and
blink derivatives; stale tangents must not drive the normal maps after reshaping.
The physical mode has a filtered local
studio environment and key/fill/rim lights. Directional shadows fall on the
studio floor; low-resolution self-shadow bands are kept off the face. Fine
longitudinal color/normal/roughness maps add detail to generated hair locks.
Recolored source hair has antialiased strand variation and independently controlled
roughness. Unsupported source/generated hair finish controls and clay surface
controls are disabled. Older physical looks receive the new physical defaults;
explicit saved choices, including zero eye restoration, are retained.

The same shader color and roughness masks run in the preview and in a UV-space
export bake. This avoids approximating the color treatment twice. The bake writes
separate maps and retains the immutable source image. GLB downloads include the
edited geometry, manual gaze/expression, skin/iris/makeup colors, roughness,
hair textures, clothing, skeleton and walking clip. Pore shading, soft light falloff, cel lighting,
studio lights and automatic motion are preview treatments. Version 4 look files
retain every editor setting and lighting; versions 1–3 receive neutral new fields.

## Quality still requiring authored assets

The Meshy bodies are generated sculpts with joined body and source clothes. They
remain incomplete beneath that outfit; clipping and material fixes cannot invent
the missing surfaces. Hime's cleaner head removes the damaged painted eye/fringe
edges from the visible default, but is still a stylized prototype with a fitted
neck join. Hair roots and garment collars still need authored construction.
The original Game heroine face retains its generated topology and painted features.
The rejected anatomical study provides useful data for internal work, but its
neutral sculpt and broad hair masses must not be treated as accepted visual art.

The next asset stage needs:

1. Continuous adult body surfaces, including the anatomy currently missing under
   the Meshy tank and shorts; production fit cages and garment construction for
   the continuous source.
2. Authored facial loops around lids, lips, nostrils and ears, with independently
   rigged eyeballs, eyelid blend shapes and joint-corrective shapes.
3. Clean albedo without painted lighting, padded UV islands, and coordinated
   normal/roughness maps. Inspect front/profile/back at portrait distance.
4. A separate hair groom or authored strand cards, with roots, anisotropic detail,
   collisions and LODs; a richer face/finger/hair skeleton.
5. Companion IK/collision integration and expression/pose acceptance on every
   body extreme before adopting the asset into the live companion.

These are explicit adoption requirements, rather than a promise that additional
sliders alone will make the current source mesh match the reference.

## Verification

```sh
node --test dev/model-shape.test.mjs dev/model-persona.test.mjs dev/model-details.test.mjs
node dev/model-anime-check.cjs
node dev/model-studio-check.cjs
node dev/model-persona-check.cjs
node dev/model-details-check.cjs
node dev/model-human-check.cjs
```

The corrective anime check exercises both public bodies, all 62 facial-detail
extremes per body, manual iris movement, authored lid closure, body locality,
clothing/base visibility, reset, hair bounds, GLB reload and facial alpha edges.
It also checks independent drafts, the withdrawn study's public fallback, retained
Game heroine head, resource cycles and mobile/reduced motion. See
[the retained report](../assets/studies/model-anime-check.json) and
[corrected Hime preview](../assets/studies/model-anime-sculpt-face.png).

The detail regression checks every new face parameter on both imported meshes,
restoration and body locality, region focus, atomic history, portrait variation,
old recipes, reduced motion, mobile layout and repeated material/model cycles.
Export checks reload the GLB and sample skin, iris, hair and roughness pixels to verify
that the visible treatments were actually retained. Full results and preview
evidence are tracked in [the companion roadmap](COMPANION-ROADMAP.md).
The anatomy regression additionally checks all body presets, both ends of each
shape/face control, exact reset, body locality, preserved skin topology when
hairstyles change, normalized weights/tangents, independent eye rotation, curved
blinks, mandatory coverage, history/persistence, GLB reload and repeated resource
cycles. These verify implementation; reference-quality visual acceptance remains
a separate requirement.
