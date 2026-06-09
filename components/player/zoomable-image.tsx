"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  src: string;
  alt: string;
  /** Classes for the inline (in-slide) image. */
  className?: string;
  style?: React.CSSProperties;
  /** When false (e.g. adjust-layout mode), the image won't open the lightbox. */
  interactive?: boolean;
  /** Focal-zoom factor applied on double-click inside the lightbox. */
  zoomScale?: number;
}

// ZoomableImage — renders an in-slide image that, on click, opens a fullscreen
// lightbox with a "lean-in" scale animation. Inside the lightbox, double-click a
// spot to zoom into that region (the click point becomes the focal origin) and
// double-click again — or press Esc — to restore. While zoomed you can drag to
// pan. A second Esc closes the lightbox.
export default function ZoomableImage({ src, alt, className, style, interactive = true, zoomScale = 2.4 }: Props) {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false); // drives the enter/exit transition
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 }); // transform-origin in %
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // pan, in unscaled px
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const reset = useCallback(() => {
    setZoomed(false);
    setOrigin({ x: 50, y: 50 });
    setOffset({ x: 0, y: 0 });
  }, []);

  const close = useCallback(() => {
    setShow(false);
    // Let the exit transition play before unmounting the overlay.
    window.setTimeout(() => {
      setOpen(false);
      reset();
    }, 220);
  }, [reset]);

  const openLightbox = useCallback(() => {
    if (!interactive) return;
    setOpen(true);
  }, [interactive]);

  // Trigger the enter transition on the next frame after mount.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Lock body scroll + wire Esc while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (zoomed) reset();
      else close();
    };
    // Capture so the player's own key handlers don't also act on Esc.
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, zoomed, reset, close]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (zoomed) {
      reset();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    setOffset({ x: 0, y: 0 });
    setZoomed(true);
  }, [zoomed, reset]);

  // Drag-to-pan while zoomed.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    if (!zoomed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  }, [zoomed, offset]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.px) / zoomScale, y: d.oy + (e.clientY - d.py) / zoomScale });
  }, [zoomScale]);

  const endPointer = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  }, []);

  const scale = zoomed ? zoomScale : 1;
  const transform = show
    ? `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`
    : "scale(0.92)";

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, cursor: interactive ? "zoom-in" : undefined }}
        onClick={interactive ? openLightbox : undefined}
        draggable={false}
      />

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10"
          style={{
            background: `rgba(8,10,14,${show ? 0.86 : 0})`,
            transition: "background 220ms ease",
            backdropFilter: show ? "blur(6px)" : "blur(0px)",
            WebkitBackdropFilter: show ? "blur(6px)" : "blur(0px)",
          }}
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={handleDoubleClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
            style={{
              transform,
              transformOrigin: `${origin.x}% ${origin.y}%`,
              transition: dragging ? "none" : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
              opacity: show ? 1 : 0,
              cursor: zoomed ? (dragging ? "grabbing" : "grab") : "zoom-in",
              willChange: "transform",
            }}
          />

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {/* Hint */}
          <div
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur"
            style={{ opacity: show ? 1 : 0, transition: "opacity 220ms ease 120ms" }}
          >
            {zoomed ? "Drag to pan · double-click or Esc to reset" : "Double-click to zoom · Esc to close"}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
