"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ArrowRightLeft, Check, X } from "lucide-react";
import type { Slide } from "@/app/slides";

interface DeckMeta {
  id: string;
  title: string;
  slideCount: number;
  sourceType?: string;
}

// Copy or move this slide into another deck. Copy leaves the source untouched;
// move asks the parent to drop the slide (and persist the source).
export function SlideTransfer({
  sourceId,
  slide,
  onMoved,
}: {
  sourceId: string;
  slide: Slide;
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [decks, setDecks] = useState<DeckMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/presentations");
      const data = await res.json();
      const list: DeckMeta[] = Array.isArray(data) ? data : (data.presentations ?? []);
      setDecks(list.filter((d) => d.id !== sourceId));
    } catch {
      setError("Could not load decks");
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  function openDialog() {
    setOpen(true);
    setDoneId(null);
    setError("");
    loadDecks();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(targetId: string, mode: "copy" | "move") {
    setBusyId(targetId);
    setError("");
    try {
      const res = await fetch(`/api/presentations/${targetId}/copy-slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slide }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (mode === "move") {
        setOpen(false);
        onMoved();
      } else {
        setDoneId(targetId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
        Copy or move to another deck…
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-6 animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h3 className="text-sm font-semibold">Copy or move slide</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-3">
              <p className="text-xs text-muted-foreground">
                <strong className="font-medium text-foreground">Copy</strong> keeps the slide here too · <strong className="font-medium text-foreground">Move</strong> removes it from this deck.
              </p>
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-3 pb-3">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading decks…</p>
              ) : decks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No other decks available.</p>
              ) : (
                <ul className="space-y-1.5">
                  {decks.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-accent/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.title}</p>
                        <p className="text-[10px] text-muted-foreground">{d.slideCount} slides{d.sourceType ? ` · ${d.sourceType.toUpperCase()}` : ""}</p>
                      </div>
                      {doneId === d.id ? (
                        <span className="inline-flex items-center gap-1 px-2 text-xs font-medium text-teal-600"><Check className="h-3.5 w-3.5" /> Copied</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            disabled={busyId === d.id}
                            onClick={() => send(d.id, "copy")}
                            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                          <button
                            disabled={busyId === d.id}
                            onClick={() => send(d.id, "move")}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                          >
                            <ArrowRightLeft className="h-3 w-3" /> Move
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
