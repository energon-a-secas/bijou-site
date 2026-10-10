# Clothing templates and fit

Implemented 2026-10-05. Open **Wardrobe → Clothing studio**, or choose a piece
from **Basics**. Selecting a pattern wears it; its cuts, colors, fabric and fit
can then be edited. Ten free patterns supplement the existing editable bikini.
The complete wardrobe now contains 96 items, including 36 free items.

**Latest visual review, 2026-10-05:** the user finds the clothes bulky and
underwear insufficiently fitted. Upper and lower tailoring need independent,
more detailed controls. Implementation and persistence checks below establish
functionality, not acceptance of the fit. Track the correction as R-30 in the
[roadmap](COMPANION-ROADMAP.md); the [Meshy investigation](MESHY-EVALUATION.md)
evaluates an alternative model source without treating generation as a fit fix.

## Initial templates

| Template | Editable pattern parameters | Attachments / fit |
| --- | --- | --- |
| Everyday underwear / bikini | Strap width, bottom rise, colors, fabric and fit | Opaque two-piece pattern; body skeleton and secondary motion |
| Jeans / leggings / jeggings | Leg length, waist rise, palette, fabric, stretch and fit | Fitted leg surfaces, waistband and procedural textile detail |
| Crop top / tee / camisole / sweater | Neckline, sleeve length, hem, palette, fabric and fit | Shaped torso envelope and sleeves; cami straps; fitted/relaxed/oversized quick starts |
| Skirt | Length, flare, palette, waist/hip allowance | Generated skirt surface, attached waist, procedural seated drape |
| Day dress | Neckline, sleeves, skirt length, flare, palette and fit | Fitted upper half and generated skirt |

Actual saved data lives in the validated `garments` dictionary, independently of
which patterns are currently worn. Saved looks snapshot it alongside `renderStyle`.
Every numeric setting is 0..1; unknown patterns, fabrics and invalid colors are
dropped or restored to defaults. Catalog prototypes are never edited by the UI.

```json
{
  "studio-crop": {
    "color": "#397f88", "trim": "#efe2c8", "fabric": "cotton",
    "neckline": "scoop", "length": 0.25, "sleeves": 0.32,
    "ease": 0.28, "stretch": 0.5,
    "chestEase": 0, "waistEase": 0.35, "hipEase": 0,
    "armEase": 0, "legEase": 0
  }
}
```

## What the research changes

Blender separates garment pinning from body collision. Its documentation also
distinguishes collision distance and solver quality. A template therefore needs
explicit attachment weights and fit allowance; body morphing alone cannot make
a freely moving skirt behave like fabric.
[Cloth shape and pinning](https://docs.blender.org/manual/en/latest/physics/cloth/settings/shape.html)
· [Cloth collision settings](https://docs.blender.org/manual/en/4.4/physics/cloth/settings/collisions.html)

The current browser implementation uses fitted skinning. `avatar-fit.js` fits
fabric after body shaping, with its own allowance and front envelope. This avoids
passing inflated garment vertices back through the anatomical region classifier.
Larger ease bridges the chest-to-hem contour; smoother panel normals keep that
loose surface from reproducing each crease in the underlying body.
Body regions and garments therefore remain independent. Clothing coverage also
drives its shadow pass; body, fitted clothes and shadows use the same skeleton
and joint-correction deltas.

`avatar-fabric.js` provides antialiased surface weave, denim stitches and wash,
knit detail, and bounded tension marks based on local surface-area change.
These are procedural texture cues, not measured material strain. Surface fabric
choice also sets physical roughness in the realistic finish. Generated skirts
use five reusable neutral weave maps and fabric-dependent physical roughness;
their treatment does not yet include the fitted surface's tension/stitch cues.

Loose-fabric simulation cages, self-collision, seam construction, layered garment
contact and exportable sewing patterns remain future work. Large allowances can
still produce stylized sleeve volume and underarm folds. Arm clearance protects
the body with a bounded garment allowance; it does not treat oversized sleeves
as rigid solids. The SVG fallback preserves colors and approximate cuts, with
fine fit and textile effects available in 3D.

## Regression and remaining visual acceptance

- New garments cover the intended regions across all body presets, belly and
  armpit extremes, and all archetype heights.
- Seams stay continuous through relaxed, seated, raised-arm and turning poses.
- Clothing, body and shadows use the same morph and skinning coordinates.
- Color, roughness and patterned UVs survive saving and restoring a look.
- Test a full wardrobe cycle for geometry and texture leaks.
- Keep original model provenance and distinguish procedural garments from
  imported, licensed clothing assets.

`dev/avatar-customization.cjs` checks all ten new patterns, tailoring controls,
camera gestures, mobile layout and saved-look roundtrips. The larger wardrobe
matrix remains in `dev/avatar-browser.cjs`. Numerical checks do not establish
artist-level cloth simulation or visual acceptance for every extreme combination.
