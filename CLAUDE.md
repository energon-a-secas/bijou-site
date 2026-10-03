# CLAUDE.md: Bijou

An animated 2D anime dress-up doll and desktop companion: drag clothes onto her, restyle her, keep her company, and pop her out into an always-on-top window. **Read [`docs/RIG.md`](docs/RIG.md) before touching any drawing**: it is the contract every body, face, hair and garment function speaks.

**Live:** bijou.neorgon.com · **Port:** 8897

## Run

```bash
make serve
```

Then open http://localhost:8897. It must be served over HTTP: the app is ES modules, and `file://` blocks them.

## Architecture

| Module | Lines | Owns |
|---|---:|---|
| `js/neorgon-beacon.js` | 379 | none |
| `js/wear-kit.js` | 312 | `paintOf`, `cloth`, `limb`, `hemY`, `isStrapNeck` |
| `js/behavior.js` | 282 | `createBehavior` |
| `js/wear.js` | 270 | `itemPieces`, `outfitPieces` |
| `js/motion.js` | 243 | `createMotion` |
| `js/events.js` | 238 | `makeHooks`, `renderAll`, `bindEvents` |
| `js/face.js` | 230 | `EXPR`, `browsPiece`, `facePieces`, `featuresPiece`, `exprOf` |
| `js/wear-acc.js` | 219 | `accessoryPieces` |
| `js/rig.js` | 214 | `VIEW`, `HEAD_CHIN`, `HEAD_SCALE`, `measure`, `BONES` |
| `js/doll.js` | 193 | `createDoll` |
| `js/paint.js` | 187 | `f1`, `mix`, `darken`, `lighten`, `inkOf` |
| `js/hair.js` | 179 | `hairPieces`, `hasTails` |
| `js/body.js` | 172 | `handPiece`, `bodyPieces` |
| `js/neorgon-dom.js` | 157 | `escHtml`, `debounce`, `throttle`, `clamp`, `uid` |
| `js/neorgon-persist.js` | 152 | `safeGet`, `safeSet`, `safeRemove`, `safeGetJSON`, `safeSetJSON` |
| `js/catalog.js` | 149 | `SLOTS`, `CONFLICTS`, `CATEGORIES`, `MILESTONES`, `CATALOG` |
| `js/poses.js` | 145 | `POSES`, `PICKABLE`, `resolvePose` |
| `js/wardrobe.js` | 128 | `earn`, `isWorn`, `equip`, `unequip`, `costOf` |
| `js/state.js` | 119 | `today`, `state`, `cleanBody`, `cleanHead`, `cleanOutfit` |
| `js/wear-legs.js` | 116 | `legwearPieces`, `shoePieces` |
| `js/looks.js` | 115 | `SKIN`, `HAIR`, `EYES`, `EYE_STYLES`, `FRONT_STYLES` |
| `js/companion.js` | 98 | `canPopOut`, `popOut`, `inPip`, `setCompanionView`, `snapshot` |
| `js/render.js` | 92 | `renderHearts`, `renderCategories`, `renderItems`, `renderWearing`, `renderWish` |
| `js/panels.js` | 88 | `renderStyle`, `renderPoses`, `renderLooks`, `renderStats` |
| `js/fx.js` | 81 | `createFx` |
| `js/dnd.js` | 80 | `bindDnd` |
| `js/interact.js` | 80 | `bindDoll` |
| `js/lines.js` | 66 | `LINES`, `WISHES`, `pick` |
| `js/thumbs.js` | 65 | `itemThumb`, `miniDoll` |
| `js/stage.js` | 62 | `BACKDROPS`, `drawBackdrop` |
| `js/app.js` | 43 | none |
| `js/dialogs.js` | 26 | `openDialog`, `bindDialog` |
| `js/utils.js` | 6 | `$` |

Vendored from `packages/neorgon-ui/`, never edit in place; run the sync script instead: `js/neorgon-header.js`, `js/neorgon-footer.js`.

## Data

One Persist Kit store, `bijou-site:save` (version 1): name, body, head, outfit, unlocked and seen item ids, hearts, milestones, stats, the day's earnings per source, room, and up to eight saved looks. `state.js` validates every field against the data it names on load (an id that is gone, a colour that was renamed, a slot that no longer exists are all dropped), so a stale save cannot crash a build. The active style wish is runtime only, by design.

## Conventions

- Visual checks: `dev/sheet.html` renders a grid of static dolls from the real modules. `?m=poses`, `?m=items&slot=dress`, `?m=heads`, `?m=bodies`; `&c=6&h=290` sets columns and cell height; `&zoom=x,y,w,h` crops every doll to a viewBox. Check every new garment and pose there before the live page.
- Zero build step. Plain ES modules loaded by `js/app.js`.
- Header and footer come from the shared kits. Do not add site-local `.neo-footer` or `.header-bar` CSS.
- No single JS file over ~500 lines. It currently holds.

## Gotchas

- **No gradient fills on limb pieces.** A per-piece `objectBoundingBox` gradient ends dark at one piece's edge and starts light at the next, so every elbow and knee seams. Skin and multi-piece garments use `cel()` with `dy: 0` (a sideways-only shadow crescent); single-piece shapes may shift diagonally.
- **IK bend flips above the shoulder.** `bend: 'out'` adds the elbow angle to the target direction, which wraps past 180 degrees for a hand raised above the shoulder and swings the elbow across her face. The peace pose uses `'in'` for that reason; check any new raised-hand pose on the dev sheet.
- **Pieces are flat, not nested.** Each piece gets its bone's world matrix; depth is only `z`. An arm posed behind her (`band: 'back'`) or in front of her face (`'front'`) shifts all of that arm's pieces at once. `fixed: true` opts a piece out (the parasol canopy).
- **The head is drawn large and scaled.** Head art is canonical (chin at y 244) and scaled by `HEAD_SCALE` 0.9 about the chin. Head-bone coordinates in `wear-acc.js` are canonical, not body coordinates.
- **The base slip is not optional.** `outfitPieces` draws it whenever no dress or swimwear is on and the slot it would cover is empty. Never add a control that removes it.
- **Held items stay upright.** Pieces with `upright` are placed at the palm's world position with no rotation (and scaled 1.3), so a cup never tips when the arm moves.
- **The stage moves documents.** Pop out moves `#stage` into the Picture-in-Picture window and hands the animation loop that window's `requestAnimationFrame`. Listeners belong on the stage, never on `window` or `document`; `dnd.js` refuses drops while the stage is away.
- **Wishes must be grantable.** She only wishes for a theme the unlocked wardrobe can already satisfy; on day one every rain item is locked.
- **Clip ids are global.** `cel()` mints a fresh clip id per shape, so thumbnails and mini dolls never collide with the stage doll; cached thumbnail strings may repeat an id, which is harmless because the geometry is identical.

## Do not touch

- `js/neorgon-*.js` and `css/neorgon-*.css`: vendored kits, regenerated by `packages/neorgon-ui/sync-*.sh`.
