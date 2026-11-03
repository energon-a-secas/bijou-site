// Doll Lab fine tuning: strand variation, the hair cone and the whole-body
// springs, for judging by eye. The first model sets the sliders from its own
// defaults; every later model takes the sliders' values.

const $ = (id) => document.getElementById(id);
const body = (k, f) => [(cur) => cur.body.state.springs[k][f], (cur, v) => { cur.body.state.springs[k][f] = v; }];

// [input id, read from the model, write to the model, how the value reads]
const CONTROLS = [
  ['vary', (cur) => cur.springs.state.vary, (cur, v) => cur.springs.set({ vary: v }), (v) => `±${Math.round(v * 100)}%`],
  ['hair-cone', (cur) => cur.springs.state.hairCone, (cur, v) => cur.springs.set({ hairCone: v }), (v) => (v >= 180 ? 'free' : `${v}°`)],
  ['squash-hz', ...body('squash', 'hz'), (v) => `${v.toFixed(1)} Hz`],
  ['squash-ratio', ...body('squash', 'ratio'), (v) => v.toFixed(2)],
  ['lean-hz', ...body('lean', 'hz'), (v) => `${v.toFixed(1)} Hz`],
  ['lean-ratio', ...body('lean', 'ratio'), (v) => v.toFixed(2)],
];

/** Wire the controls to whichever model is loaded; returns apply(cur), for a model that has just loaded. */
export function bindTuning(getCur) {
  let first = true;
  const show = (id, fmt) => { $(`o-${id}`).textContent = fmt(+$(id).value); };
  for (const [id, , write, fmt] of CONTROLS) {
    $(id).addEventListener('input', () => {
      show(id, fmt);
      const cur = getCur();
      if (cur) write(cur, +$(id).value);
    });
  }
  return function apply(cur) {
    for (const [id, read, write, fmt] of CONTROLS) {
      if (first) $(id).value = read(cur);
      else write(cur, +$(id).value);
      show(id, fmt);
    }
    first = false;
  };
}
