"use client";

import { useRef } from "react";
import type { SlideElementOverride } from "@/app/slides";

// Wraps a slide element so the player's adjust mode can move and scale it.
// The stored override ({dx,dy,scale}) is applied as a CSS transform at all
// times; in edit mode the wrapper adds an outline, drag-to-move, and a resize
// handle. transformOrigin is top-left so scaling doesn't drift the anchor.

export function Adjustable({
  elKey,
  override,
  editMode,
  selected,
  onSelect,
  onChange,
  className,
  children,
}: {
  elKey: string;
  override?: SlideElementOverride;
  editMode: boolean;
  selected: boolean;
  onSelect: (key: string) => void;
  onChange: (key: string, patch: SlideElementOverride) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const dx = override?.dx ?? 0;
  const dy = override?.dy ?? 0;
  const scale = override?.scale ?? 1;
  const dragRef = useRef<{ startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);
  const resizeRef = useRef<{ startX: number; baseScale: number } | null>(null);

  function startMove(e: React.PointerEvent) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(elKey);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseDx: dx, baseDy: dy };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      onChange(elKey, { dx: d.baseDx + (ev.clientX - d.startX), dy: d.baseDy + (ev.clientY - d.startY) });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect(elKey);
    resizeRef.current = { startX: e.clientX, baseScale: scale };
    const move = (ev: PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const next = Math.max(0.3, Math.min(3, r.baseScale + (ev.clientX - r.startX) / 200));
      onChange(elKey, { scale: Math.round(next * 100) / 100 });
    };
    const up = () => {
      resizeRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className={className}
      style={{
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        transformOrigin: "top left",
        position: "relative",
        cursor: editMode ? "move" : undefined,
        outline: editMode ? (selected ? "2px solid #14b8a6" : "1px dashed rgba(20,184,166,0.5)") : undefined,
        outlineOffset: 4,
        borderRadius: editMode ? 4 : undefined,
      }}
      onPointerDown={startMove}
    >
      {children}
      {editMode && (
        <div
          onPointerDown={startResize}
          className="absolute -bottom-2 -right-2 z-50 h-4 w-4 rounded-full border-2 border-white bg-teal-500 shadow cursor-nwse-resize"
          title="Drag to resize"
        />
      )}
    </div>
  );
}
