let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

export type SoundThemeEventId =
  | "alert"
  | "trash-empty"
  | "screenshot"
  | "volume-pop";

/**
 * Plays a synthesized FreeDesktop Sound Theme cue via the Web Audio API,
 * respecting the current output volume (0-100) and mute state.
 */
export async function playSoundThemeEvent(
  event: SoundThemeEventId,
  volumePct = 75,
  muted = false
): Promise<boolean> {
  if (muted || volumePct <= 0) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }

  const gainLevel = Math.min(1, Math.max(0, volumePct / 100)) * 0.22;
  if (gainLevel <= 0) return false;

  const now = ctx.currentTime;
  const presets: Record<
    SoundThemeEventId,
    Array<{ freq: number; start: number; duration: number; type?: OscillatorType }>
  > = {
    alert: [
      { freq: 587.33, start: 0, duration: 0.16, type: "sine" },
      { freq: 880, start: 0.09, duration: 0.28, type: "sine" },
    ],
    "trash-empty": [
      { freq: 440, start: 0, duration: 0.09, type: "triangle" },
      { freq: 330, start: 0.07, duration: 0.14, type: "triangle" },
    ],
    screenshot: [
      { freq: 1240, start: 0, duration: 0.045, type: "triangle" },
      { freq: 880, start: 0.04, duration: 0.06, type: "sine" },
    ],
    "volume-pop": [{ freq: 523.25, start: 0, duration: 0.06, type: "sine" }],
  };

  for (const note of presets[event]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.setValueAtTime(note.freq, now + note.start);

    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + note.start + 0.012);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + note.start + note.duration
    );

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.duration + 0.02);
  }

  return true;
}

/**
 * Plays a short two-tone desktop alert chime via the Web Audio API,
 * respecting the current output volume (0-100) and mute state.
 */
export async function playAlertSound(
  volumePct = 75,
  muted = false
): Promise<boolean> {
  return playSoundThemeEvent("alert", volumePct, muted);
}

