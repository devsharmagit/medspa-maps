"use client";

import { useRef } from "react";

/**
 * Click-and-hold drag-to-scroll for a horizontally-scrollable row (mouse/pen).
 *
 * Pass the row's ref; spread the returned handlers on that same element, and add
 * `cursor-grab active:cursor-grabbing select-none` to its className.
 *
 * - Touch is ignored — native touch scrolling already works.
 * - Pointer capture is deferred until the pointer actually moves past a small
 *   threshold, so a plain click passes straight through to any card/button
 *   inside the row (capturing on pointerdown would steal the click).
 * - After a real drag, the trailing `click` is cancelled in the capture phase so
 *   dragging never activates a card link, lightbox, or button.
 */
export function useDragScroll(ref: React.RefObject<HTMLElement | null>) {
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    // Capture is deferred to onPointerMove so clicks aren't stolen.
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = drag.current;
    const el = ref.current;
    if (!st.down || !el) return;
    const dx = e.clientX - st.startX;
    if (Math.abs(dx) > 4 && !st.moved) {
      st.moved = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* stale pointer id — safe to ignore */
      }
    }
    if (st.moved) el.scrollLeft = st.startScroll - dx;
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current.down) return;
    drag.current.down = false;
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* nothing captured — safe to ignore */
    }
  };

  // A drag that moved the pointer must not fire the trailing click.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onClickCapture,
  };
}
