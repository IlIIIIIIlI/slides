"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  KEYBINDING_ACTIONS,
  bindingFromEvent,
  formatBinding,
  isMacPlatform,
  useKeybindings,
  type ActionId,
} from "@/lib/keybindings";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { bindings, setBinding, reset } = useKeybindings();
  const [recording, setRecording] = useState<ActionId | null>(null);
  const recordingRef = useRef<ActionId | null>(null);
  const mac = isMacPlatform();

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  // While recording, capture the next real key combo. Esc cancels.
  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(null);
        return;
      }
      const binding = bindingFromEvent(e);
      if (!binding) return; // modifier-only press; keep waiting
      setBinding(recordingRef.current!, binding);
      setRecording(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, setBinding]);

  // Reset recording state when the dialog closes.
  useEffect(() => {
    if (!open) setRecording(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {KEYBINDING_ACTIONS.map((action) => {
            const isRecording = recording === action.id;
            return (
              <div
                key={action.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecording(isRecording ? null : action.id)}
                  className={`flex-shrink-0 min-w-[84px] rounded-md border px-3 py-1.5 text-xs font-mono transition-colors ${
                    isRecording
                      ? "border-teal-500 bg-teal-500/10 text-teal-500 animate-pulse"
                      : "border-border bg-muted/40 hover:bg-accent"
                  }`}
                  title="Click, then press the key combo"
                >
                  {isRecording ? "Press keys…" : formatBinding(bindings[action.id], mac)}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Click a shortcut, then press your combination. Bindings are saved on this device.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset to defaults
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
