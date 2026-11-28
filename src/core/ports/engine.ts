/**
 * What the engine this page runs on can do. Each entry point picks one at
 * startup (`piloti-web.tsx` the browser demo, `piloti-desktop.tsx` the Linux
 * session). Shared code asks for what it needs
 * (`getEngine().capabilities.realFilesystem`), not which engine it is on.
 */
export interface EngineCapabilities {
  /** Files live on a real disk (the VFS is a cache of it). Otherwise the browser VFS is the only copy. */
  realFilesystem: boolean;
  /** Can run programs and talk to system services (D-Bus, UPower, NetworkManager...). */
  systemServices: boolean;
  /** Hardware is simulated for the demo (USB stick, battery, Wi-Fi list). */
  simulatedHardware: boolean;
  /**
   * A real compositor: Wayland windows, native web views and browser extensions,
   * and shortcuts reach the shell. The demo draws iframes inside a browser page.
   */
  compositor: boolean;
}

export interface Engine {
  capabilities: EngineCapabilities;
}

export const webEngine: Engine = {
  capabilities: { realFilesystem: false, systemServices: false, simulatedHardware: true, compositor: false },
};

export const nativeEngine: Engine = {
  capabilities: { realFilesystem: true, systemServices: true, simulatedHardware: false, compositor: true },
};

/** Linux until an entry point says otherwise: app modules never do. */
let current: Engine = nativeEngine;

/** Called once by an entry point before the desktop renders. */
export function setEngine(engine: Engine): void {
  current = engine;
}

export const getEngine = (): Engine => current;
