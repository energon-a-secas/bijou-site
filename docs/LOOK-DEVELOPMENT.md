# Figurine and animation look development

Study and implementation: **2026-10-05**. Keep the user's Hime hairstyle and oval
face. The target is a coherent adult anime figure with editable proportions and
readable volume, including close-up inspection.

## Primary sources and practical decisions

**Intentional anime shading.** Junya Motomura's Guilty Gear Xrd presentation
describes controlling light direction, shading thresholds and vertex normals,
with particular attention to clean facial shading. It also explains why extra
texture detail alone does not produce the intended drawn appearance.
[Arc System Works / GDC presentation](https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf)

Application-specific inference: provide a shared art treatment for skin, hair
and cloth, then retain a separate physical-lighting option. The implemented
`anime3d` finish uses soft shadow groups; `anime2d` uses a crisp light threshold.
Both use the same lighting direction and coordinated shadow hues. Clothing front
panels have deliberately smoothed normals. This is an adaptation of the
principles, not a reproduction of Guilty Gear's asset pipeline or shaders.

**Figurine shape and paint belong together.** Good Smile's sculptor and paintwork
interview describes repeated sculpt revisions and consultation with illustration
references to preserve the intended visual qualities in the finished figure.
[Good Smile: sculptor and paintwork commentary](https://special.goodsmile.info/sakura_brandnewworld/en/)

Application-specific inference: inspect the silhouette and materials together
from front, side and three-quarter views. More specular detail can make the body
feel unrelated to the face; default anime shading therefore suppresses skin
microtexture and uses restrained highlights. Physical skin detail is reserved
for the realistic finish. The supplied figurine remains a design reference, not
a source of copied or redistributed model geometry.

**Articulation needs limits and changing shape.** The Nishimura drawing doll
describes linked shoulder movement, deliberate joint limits and deformable areas
that retain a natural appearance through articulation.
[Max Factory / Good Smile: Nishimura drawing doll](https://info.goodsmile.com/sp/nishimura_style_drawing_doll/en/)

Application-specific inference: add clavicle participation and actual support
contact before allowing arbitrary joint manipulation. Bijou now has grounded
two-bone leg IK, measured seat contact, shoulder motion and a forward knee pole.
The full pose authoring UI remains R-25 in the roadmap.

**Correct skinning at the poses where it fails.** Maya's pose-space deformation
guide calls out joint problem areas and associates corrective shapes with poses.
[Autodesk: pose-space deformations](https://help.autodesk.com/cloudhelp/2022/ENU/Maya-CharacterAnimation/files/GUID-00699C13-8CA1-450C-937D-57C7B3DFD8C6.htm)

Application-specific inference: the four current relative targets address left
and right underarms and hip creases. Rebuild their deltas after reshaping and use
the same deltas on fitted clothing. These bounded procedural corrections are a
foundation; they are not a complete artist-authored corrective library.

## Current finishes

| Finish | Skin and clothing | Hair and face |
| --- | --- | --- |
| 3D anime, default | Soft volume shading, coordinated warm shadows, restrained fabric detail | Shared lighting treatment; painted anime features retained |
| 2D animation | Crisp cel bands, restrained surface shading | Crisp bands, reduced strand texture; geometry stays three-dimensional |
| Realistic | Physical surface shading, skin bump, fabric roughness | Physical generated hair, softer face shading; anime face geometry retained |

Unlit accessories such as phone screens keep their intended unlit treatment.
Resolution/shadow quality is a separate setting. Finishes are stored per look.

## Review record and limits

- Inspected the default Hime/oval figure, side-view standing and sitting, regional
  body close-ups, cropped tops with increased cup volume, and fuller bodies in an
  oversized sweater and jeans.
- Fixed source hair springs snapping the bangs during wardrobe rebuilds. Only
  generated hair guides own secondary motion; the retained fringe follows the head.
- Corrected garment fit ordering and anatomical region transitions. Added torso
  envelopes and smoother panel normals; removed exaggerated waistband bulges.
  Loose tops bridge toward their hem rather than copying the under-chest crease;
  section smoothing removes rippled horizontal shading on those front panels.
- Inspected all three finishes and added a persisted, accessible selector.
- Further art work remains on extreme fit combinations, underarm drape, finger
  and nail silhouettes, richer hand-authored textures, and loose-cloth contact.
  Passing tests does not certify the model as a finished commissioned asset.
