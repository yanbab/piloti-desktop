import * as React from "react";

/**
 * Hardware capture state, tracked at the lowest level: every MediaStream handed out by
 * `getUserMedia` / `getDisplayMedia` is registered, and a device counts as "on" only while
 * one of its tracks is actually live (`readyState === "live"`, not stopped or ended).
 * Apps don't report anything; they can't forget or lie.
 */
export type CaptureActivity = "camera" | "mic" | null;

const tracks = new Set<MediaStreamTrack>();
const listeners = new Set<() => void>();
let snapshot: CaptureActivity = null;
let installed = false;
let pollTimer: number | null = null;

function compute(): CaptureActivity {
  let mic = false;
  for (const t of tracks) {
    if (t.readyState !== "live") continue;
    if (t.kind === "video") return "camera";
    mic = true;
  }
  return mic ? "mic" : null;
}

function refresh(): void {
  for (const t of [...tracks]) if (t.readyState !== "live") tracks.delete(t);
  const next = compute();
  if (tracks.size === 0 && pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  if (next === snapshot) return;
  snapshot = next;
  for (const l of listeners) l();
}

function register(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    if (tracks.has(track)) continue;
    tracks.add(track);
    track.addEventListener("ended", refresh);
    // `stop()` does not fire "ended": wrap it so the state flips immediately.
    const stop = track.stop.bind(track);
    track.stop = () => {
      stop();
      refresh();
    };
  }
  // Backstop for devices unplugged / permission revoked without an event.
  if (pollTimer === null) pollTimer = window.setInterval(refresh, 1000);
  refresh();
}

/** Hooks the media APIs once (idempotent). Call at shell start-up. */
export function installCaptureTracking(): void {
  if (installed || typeof navigator === "undefined" || !navigator.mediaDevices) return;
  installed = true;
  const md = navigator.mediaDevices;
  for (const name of ["getUserMedia", "getDisplayMedia"] as const) {
    const original = md[name]?.bind(md);
    if (!original) continue;
    (md as unknown as Record<string, unknown>)[name] = async (c?: MediaStreamConstraints) => {
      const stream = await (original as (c?: MediaStreamConstraints) => Promise<MediaStream>)(c);
      register(stream);
      return stream;
    };
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "camera" → red indicator (any live video track), "mic" (audio only) → orange. */
export function useCaptureActivity(): CaptureActivity {
  installCaptureTracking();
  return React.useSyncExternalStore(subscribe, () => snapshot, () => null);
}
