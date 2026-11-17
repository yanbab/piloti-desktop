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

/**
 * Plays a short two-tone desktop alert chime via the Web Audio API,
 * respecting the current output volume (0-100) and mute state.
 */
export async function playAlertSound(
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
  const notes = [
    { freq: 587.33, start: 0, duration: 0.16 }, // D5
    { freq: 880, start: 0.09, duration: 0.28 }, // A5
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.freq, now + note.start);

    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + note.start + 0.015);
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

