/**
 * Where an app's new windows run: in the shell, or on their own, as a Domicile
 * app module on Linux and an iframe in the browser demo. Kept in the app's
 * settings (`~/.config/piloti/apps/<app-id>.ini`, key `run-in`) once chosen.
 */
import { getAppSetting, setAppSetting } from "@/core/config/app-settings";
import { formerAppId } from "@/core/config/renamed-apps";
import { getEngine } from "@/core/ports/engine";

export type RunIn = "shell" | "isolated";

/** Apps with both an app module (`src/ui/apps/<id>`) and an iframe entry. */
export const ISOLATABLE_APPS: readonly string[] = [
  "calculator",
  "files",
  "image-viewer",
  "selfies",
  "system-monitor",
  "terminal",
  "texts",
];
const ISOLATABLE = new Set(ISOLATABLE_APPS);

/** Apps heavy enough to run on their own unless chosen otherwise, on Linux. */
const SEPARATE_BY_DEFAULT = new Set(["image-viewer", "system-monitor", "terminal", "texts"]);

export const RUN_SEPARATELY_ACTION = "shell:run-separately";

/** Folders' windows are the app `nautilus`; its module and component are `files`. */
const runId = (appId: string) => (appId === "nautilus" ? "files" : appId);

export const canRunIsolated = (appId: string): boolean => ISOLATABLE.has(runId(appId));

export function getRunIn(windowAppId: string): RunIn {
  const appId = runId(windowAppId);
  const former = formerAppId(appId);
  const chosen =
    getAppSetting(appId, "run-in") ?? (former ? getAppSetting(former, "run-in") : undefined);
  if (!canRunIsolated(appId)) return "shell";
  if (chosen) return chosen === "isolated" ? "isolated" : "shell";
  // The demo's frames are not processes: nothing to gain there.
  return getEngine().capabilities.systemServices && SEPARATE_BY_DEFAULT.has(appId) ? "isolated" : "shell";
}

export const setRunIn = (appId: string, runIn: RunIn): void =>
  setAppSetting(runId(appId), "run-in", runIn);
