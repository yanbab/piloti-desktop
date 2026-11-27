/**
 * Which engine this page runs on. Each entry point picks one at startup
 * (`piloti-web.tsx` the browser demo, `piloti-desktop.tsx` the Linux session)
 * and the shared code asks here, instead of sniffing globals.
 *
 * Prefer a capability to the kind: a feature should ask what it needs
 * (`engine.capabilities.realFilesystem`), not which engine it is on.
 */
export type EngineKind = "web" | "native";

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
  kind: EngineKind;
  capabilities: EngineCapabilities;
}

export const webEngine: Engine = {
  kind: "web",
  capabilities: { realFilesystem: false, systemServices: false, simulatedHardware: true, compositor: false },
};

export const nativeEngine: Engine = {
  kind: "native",
  capabilities: { realFilesystem: true, systemServices: true, simulatedHardware: false, compositor: true },
};

let current: Engine | null = null;

/** Called once by an entry point before the desktop renders. */
export function setEngine(engine: Engine): void {
  current = engine;
}

/** Before an entry point has chosen (tests, tools), the in-page fake host marks the browser demo. */
function legacyKind(): EngineKind {
  return typeof window !== "undefined" &&
    Boolean((window as { __PILOTI_BROWSER_HOST__?: unknown }).__PILOTI_BROWSER_HOST__)
    ? "web"
    : "native";
}

export function getEngine(): Engine {
  return current ?? (legacyKind() === "web" ? webEngine : nativeEngine);
}

export const isWebEngine = (): boolean => getEngine().kind === "web";
