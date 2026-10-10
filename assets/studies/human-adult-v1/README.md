# Adult anatomical source study

This internal study explores the fused clothing, incomplete covered anatomy and
noisy facial remesh in the two Meshy sources. **The user rejected its visual
result.** It is withdrawn from the model picker and public query links; its
files, provenance and existing drafts are preserved. It is not an accepted
character baseline or an Aion-quality asset. For internal inspection, load Model
Studio and call `await modelStudio.selectCandidate('human')` in its console.

The body uses MakeHuman Community's authored base topology, adult female target,
default rig and weights pinned to revision
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Core graphic assets are CC0;
MakeHuman's application code has a separate license and was not incorporated.
See the [official license explanation](https://static.makehumancommunity.org/about/license.html).
The original OBJ/target headers specify CC0, and the rig/weight JSON specifies
`license: CC0`. Exact upstream file links and SHA-256 hashes are in
[manifest.json](manifest.json).

The preparation scripts are Bijou code. They apply the adult target, omit helper
surfaces, normalize to a 168 cm body, align depth centers and weld shading normals
across UV seams. Separate eyes, hair and opaque top/shorts are added. Arms are
posed more closely to the body and baked into the rest surface before rebinding.
The body remains continuous beneath the mandatory base garments. A fitted tee
and trousers are the starting outfit. All source meshes have skin weights.

The 163-joint rig retains fingers and facial joints. Eyes rotate independently;
curved skin-colored covers supply prototype blinks. A chosen wink exports static
lid surfaces with baked skin color and roughness. Automatic blink motion stays
in the preview. Face muscle animation, fingers and a full-body pose editor remain
unfinished. There is no walking clip. The study
reuses joint positions, hierarchy and weights; animation retargeting still needs
authored local joint axes and corrective poses. The studio offers its shared
body/face fields, clothing layers, material presets, orbiting,
gaze/head following, generated hair guides, history, per-model drafts and GLB
export. Source hair is static; the generated alternatives have bounded sway.

`source.json` is the prepared data consumed by the builder, not a replacement for
the GLB. To reproduce locally, with the development server on port 8897:

```sh
python3 dev/prepare-human-study.py
node dev/build-human-study.cjs
node dev/model-human-check.cjs
```

The preparer caches pinned public source files outside the served repository,
checks their hashes and downloads only missing files. It requires no account,
API key, Blender installation or paid generation job. The builder uses the
vendored engine and glTF exporter in a headless local browser.

Remaining visual work includes a refined adult face sculpt, eyebrows/lashes,
authored skin maps, corneal/tear-line detail, a strand groom, clothes with real
construction and joint-corrective shapes. The depth alignment is a study
adaptation to Bijou's shared fields, not anatomical validation. Companion IK,
collision, animation and archetype acceptance are required before adoption into
the live companion. Existing Meshy drafts and the fresh Hime/Oval default are
preserved.
