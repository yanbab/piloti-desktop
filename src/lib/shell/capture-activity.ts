import * as React from "react";

/** Which capture devices apps currently hold open ("camera" includes any video input). */
export type CaptureActivity = "camera" | "mic" | null;

const owners = new Map<string, "camera" | "mic">();
const listeners = new Set<() => void>();
let snapshot: CaptureActivity = null;

function compute(): CaptureActivity {
  let mic = false;
  for (const kind of owners.values()) {
    if (kind === "camera") return "camera";
    mic = true;
  }
  return mic ? "mic" : null;
}

/** Declares (or clears, with `null`) that `owner` is capturing from a device. */
export function setCaptureActivity(owner: string, kind: "camera" | "mic" | null): void {
  if (kind) owners.set(owner, kind);
  else owners.delete(owner);
  const next = compute();
  if (next === snapshot) return;
  snapshot = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "camera" → red indicator, "mic" (microphone only) → orange indicator. */
export function useCaptureActivity(): CaptureActivity {
  return React.useSyncExternalStore(subscribe, () => snapshot, () => null);
}
