/**
 * What the Piloti shell adds to Domicile's desktop: the public API, described
 * in `docs/API.md`. A change here is an API change. The shell fills it in
 * (`engine/shell-api.ts`).
 */
import type { SettingValue } from "@/lib/ports/settings";
import type { WorkArea } from "@/lib/windows/window-presentation";

export type { WorkArea };

/** Calls `listener` when the live property next to it changes. Returns stop. */
export type OnChange = (type: "change", listener: () => void) => () => void;

/** A window of the shell (built-in apps, web windows and Linux clients). */
export interface PilotiWindow {
  readonly id: string;
  readonly appId: string;
  readonly title: string;
  readonly workspace: number;
  readonly position: { readonly x: number; readonly y: number };
  readonly size: { readonly width: number; readonly height: number };
  readonly minimized: boolean;
  readonly maximized: boolean;
}

export interface PilotiPlugin {
  readonly id: string;
  readonly name: string;
  readonly kind: "plugin" | "theme";
  readonly version?: string;
  readonly enabled: boolean;
  readonly error?: string;
}

export interface PilotiNotification {
  summary: string;
  body?: string;
  urgency?: "low" | "normal" | "critical";
  /** Who it is from; "Piloti" if left out. */
  appName?: string;
}

export interface LaunchOptions {
  /** What to open: a path, a pane. */
  payload?: string;
  /** A new window even if the app has one. */
  forceNew?: boolean;
}

export interface OpenUrlOptions {
  title?: string;
  /** Without browser controls. */
  asApp?: boolean;
}

/** The shell's own windows; `piloti.windows` stays Domicile's (Linux clients). */
export interface PilotiDesktopWindows {
  readonly list: readonly PilotiWindow[];
  get(id: string): PilotiWindow | undefined;
  focus(id: string): void;
  close(id: string): void;
  minimize(id: string): void;
  toggleMaximize(id: string): void;
  /** Usable area (what a maximized window fills). */
  readonly workArea: WorkArea;
  on: OnChange;
}

export interface PilotiDesktopApps {
  launch(appId: string, options?: LaunchOptions): void;
  /** A key the shell applies to an app, e.g. `color-scheme`. */
  getSetting(appId: string, key: string): string | undefined;
  setSetting(appId: string, key: string, value: string | null): void;
}

export interface PilotiDesktop {
  readonly windows: PilotiDesktopWindows;
  readonly apps: PilotiDesktopApps;
  openUrl(url: string, options?: OpenUrlOptions): void;
  notify(notification: PilotiNotification): void;
  toggleLauncher(): void;
  toggleOverview(): void;
}

/** Settings as schema + key, e.g. `get("org.piloti.desktop.dock", "icon-size")`. */
export interface PilotiSettings {
  get(schema: string, key: string): SettingValue | undefined;
  set(schema: string, key: string, value: SettingValue): void;
  reset(schema: string, key: string): void;
  /** Calls `onChange` with the new value when the key changes. Returns stop. */
  watch(schema: string, key: string, onChange: (value: SettingValue | undefined) => void): () => void;
  /** The schemas defined so far. */
  readonly schemas: readonly string[];
}

export interface PilotiPlugins {
  readonly list: readonly PilotiPlugin[];
  on: OnChange;
}

export interface PilotiShellApi {
  readonly desktop: PilotiDesktop;
  readonly settings: PilotiSettings;
  readonly plugins: PilotiPlugins;
}
