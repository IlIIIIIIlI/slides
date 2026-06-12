"use client";

// Customizable combo-key bindings for the player.
//
// A binding is a modifier combo (Cmd/Ctrl + optional Shift/Alt) plus a single
// key. "mod" means Cmd on macOS and Ctrl elsewhere — matchesBinding accepts
// either so the same binding works cross-platform. Bindings persist in
// localStorage and broadcast a change event so every open consumer stays in
// sync.

import { useCallback, useEffect, useState } from "react";

export type ActionId = "regenerate-slide" | "adjust-layout";

export interface KeyBinding {
  /** Cmd on macOS / Ctrl elsewhere. */
  mod: boolean;
  shift: boolean;
  alt: boolean;
  /** Lowercased KeyboardEvent.key, e.g. "g". */
  key: string;
}

export interface ActionMeta {
  id: ActionId;
  label: string;
  description: string;
}

export const KEYBINDING_ACTIONS: ActionMeta[] = [
  {
    id: "regenerate-slide",
    label: "Regenerate current slide",
    description:
      "Open a dialog to re-generate just the current slide, reusing the original prompt plus any extra instructions you give.",
  },
  {
    id: "adjust-layout",
    label: "Adjust layout (move / resize)",
    description:
      "Enter edit mode to drag and scale the headline, supporting text, and image on the current slide.",
  },
];

export const DEFAULT_KEYBINDINGS: Record<ActionId, KeyBinding> = {
  "regenerate-slide": { mod: true, shift: true, alt: false, key: "g" },
  "adjust-layout": { mod: true, shift: true, alt: false, key: "e" },
};

const STORAGE_KEY = "k2s:keybindings";
const CHANGE_EVENT = "k2s:keybindings-changed";

const MODIFIER_KEYS = new Set(["control", "shift", "alt", "meta", "os"]);

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "");
}

function sanitizeBinding(raw: unknown, fallback: KeyBinding): KeyBinding {
  if (!raw || typeof raw !== "object") return fallback;
  const b = raw as Partial<KeyBinding>;
  if (typeof b.key !== "string" || !b.key) return fallback;
  return {
    mod: !!b.mod,
    shift: !!b.shift,
    alt: !!b.alt,
    key: b.key.toLowerCase(),
  };
}

export function loadKeybindings(): Record<ActionId, KeyBinding> {
  const result = { ...DEFAULT_KEYBINDINGS };
  if (typeof window === "undefined") return result;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    for (const action of KEYBINDING_ACTIONS) {
      result[action.id] = sanitizeBinding(stored[action.id], DEFAULT_KEYBINDINGS[action.id]);
    }
  } catch {
    /* fall back to defaults */
  }
  return result;
}

export function saveKeybindings(map: Record<ActionId, KeyBinding>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Does this keyboard event satisfy the binding (and no stray modifiers)? */
export function matchesBinding(e: KeyboardEvent, b: KeyBinding): boolean {
  if (!b.key) return false;
  if (e.key.toLowerCase() !== b.key) return false;
  const modActive = e.metaKey || e.ctrlKey;
  if (b.mod !== modActive) return false;
  if (b.shift !== e.shiftKey) return false;
  if (b.alt !== e.altKey) return false;
  return true;
}

/** Build a binding from a key-down event, or null if only modifiers were pressed. */
export function bindingFromEvent(e: KeyboardEvent): KeyBinding | null {
  const key = e.key.toLowerCase();
  if (MODIFIER_KEYS.has(key)) return null;
  return {
    mod: e.metaKey || e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: key === " " ? "space" : key,
  };
}

export function formatBinding(b: KeyBinding, mac = isMacPlatform()): string {
  const parts: string[] = [];
  if (b.mod) parts.push(mac ? "⌘" : "Ctrl");
  if (b.shift) parts.push(mac ? "⇧" : "Shift");
  if (b.alt) parts.push(mac ? "⌥" : "Alt");
  const key = b.key === "space" ? "Space" : b.key.length === 1 ? b.key.toUpperCase() : b.key;
  parts.push(key);
  return parts.join(mac ? "" : "+");
}

/** Reactive access to the current bindings, synced across the app. */
export function useKeybindings() {
  const [bindings, setBindings] = useState<Record<ActionId, KeyBinding>>(DEFAULT_KEYBINDINGS);

  useEffect(() => {
    setBindings(loadKeybindings());
    const onChange = () => setBindings(loadKeybindings());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setBinding = useCallback((id: ActionId, binding: KeyBinding) => {
    setBindings((prev) => {
      const next = { ...prev, [id]: binding };
      saveKeybindings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setBindings(DEFAULT_KEYBINDINGS);
    saveKeybindings(DEFAULT_KEYBINDINGS);
  }, []);

  return { bindings, setBinding, reset };
}
