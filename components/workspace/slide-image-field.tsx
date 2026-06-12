"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import type { Slide } from "@/app/slides";

// Per-slide image control for the Slides editor: shows the current image,
// uploads a new one (persisted to the deck's image manifest server-side), and
// can flip a non-image slide into an image slide so the picture renders.

export function SlideImageField({
  presentationId,
  slide,
  onPatch,
}: {
  presentationId: string;
  slide: Slide;
  onPatch: (patch: Partial<Slide>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/presentations/${presentationId}/upload-image`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onPatch({ imageUrl: data.filepath });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {slide.imageUrl ? (
        <div className="flex items-center gap-3">
          <div className="relative w-24 h-16 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            <Image src={slide.imageUrl} alt="" fill className="object-contain" unoptimized />
          </div>
          <div className="min-w-0 flex flex-col gap-1.5">
            <p className="truncate font-mono text-[10px] text-muted-foreground">{slide.imageUrl}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="text-xs text-muted-foreground hover:text-foreground">
                {uploading ? "Uploading…" : "Replace"}
              </button>
              <button type="button" onClick={() => onPatch({ imageUrl: undefined })} className="text-xs text-red-500 hover:text-red-600">
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-border/80 hover:bg-accent/30 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Upload an image"}
        </button>
      )}

      {slide.imageUrl && slide.type !== "image" && (
        <button
          type="button"
          onClick={() => onPatch({ type: "image", imageLayout: slide.imageLayout ?? "side", variant: slide.variant ?? "side" })}
          className="text-[11px] text-teal-600 hover:underline"
        >
          Display this slide as an image slide →
        </button>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
