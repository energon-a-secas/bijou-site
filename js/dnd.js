// ── Drag and drop ────────────────────────────────────────────
// Drag a wardrobe card onto the stage to dress her; drag a worn chip off the
// stage to take it off. Pointer events, so it works with a mouse, a pen and a
// finger. A press that never moves stays a click, which is the keyboard path.

const START = 6;

export function bindDnd({ panel, wearing, stage, hint, onDrop, onRemove, canDrag }) {
  let drag = null;
  let suppressUntil = 0;

  function overStage(x, y) {
    if (stage.ownerDocument !== document) return false; // she is in the pop-out window
    const r = stage.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function begin(e, src) {
    const id = src.getAttribute('data-drag-id');
    if (!id || (src.closest('.grid') && !canDrag(id))) return;
    drag = { id, src, fromWorn: !!src.closest('.wearing'), x0: e.clientX, y0: e.clientY, live: false, ghost: null, pid: e.pointerId };
    src.setPointerCapture(e.pointerId);
  }

  function lift() {
    drag.live = true;
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const art = drag.src.querySelector('svg');
    if (art) ghost.append(art.cloneNode(true));
    document.body.append(ghost);
    drag.ghost = ghost;
    document.body.classList.add('is-dragging');
  }

  function move(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.live) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < START) return;
      lift();
    }
    drag.ghost.style.transform = `translate(${e.clientX - 48}px, ${e.clientY - 48}px) rotate(-6deg)`;
    const over = overStage(e.clientX, e.clientY);
    stage.classList.toggle('is-drop-target', over && !drag.fromWorn);
    hint.hidden = !(over && !drag.fromWorn);
  }

  function end(e, cancelled = false) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    stage.classList.remove('is-drop-target');
    hint.hidden = true;
    document.body.classList.remove('is-dragging');
    d.ghost?.remove();
    if (!d.live) return;
    suppressUntil = performance.now() + 400;
    if (cancelled) return;
    const over = overStage(e.clientX, e.clientY);
    if (!d.fromWorn && over) onDrop(d.id);
    if (d.fromWorn && !over) onRemove(d.id);
  }

  for (const root of [panel, wearing]) {
    root.addEventListener('pointerdown', (e) => {
      const src = e.target.closest('[data-drag-id]');
      if (src && e.button === 0) begin(e, src);
    });
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', (e) => end(e));
    root.addEventListener('pointercancel', (e) => end(e, true));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drag) end({ pointerId: drag.pid }, true);
  });

  /** A click that ends a drag is not a click. */
  return { swallowClick: () => performance.now() < suppressUntil };
}
