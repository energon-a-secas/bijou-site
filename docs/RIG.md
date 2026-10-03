# The rig contract

Every subsystem in Bijou meets at one interface: the rig. The body, the face, the hair,
each garment generator and the behaviour engine all speak it, so it changes only by an
edit to this file first. Everything else in the project can be refactored cheaply; a
change here touches every drawing.

## 1. Space

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

`body` is `{ height: 0..1, build: 0..1, skin: id }`. There is deliberately no bust,
waist or chest control.

## 3. Bones

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
| 400 to 479 | head | skin 400, bang shadow 405, features 410, side locks 440, glasses 445, bangs 450, brows 452, hats 460, hair accessories 470 |
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

## 7. Garment items

An item is data in `js/catalog.js`; its drawing is a generator in `js/wear-*.js`.

```js
{ id, name, slot, kind, params, colors: { main, trim, accent }, pattern, tags, unlock }
```

`kind` names the generator. `unlock` is `{ hearts: n }`, `{ free: true }` or a milestone
`{ milestone: id }`. `tags` feed her style requests (`cozy`, `beach`, `party`, ...).
