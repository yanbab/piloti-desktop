/**
 * Where an app's new windows run: in the shell (the default), or on their own,
 * as a Domicile app module on Linux and an iframe in the browser demo. Kept in
 * the app's settings (`~/.config/piloti/apps/<app-id>.ini`, key `run-in`).
 */
import { getAppSetting, setAppSetting } from "@/core/config/app-settings";
import { formerAppId } from "@/core/config/renamed-apps";

export type RunIn = "shell" | "isolated";

/** Apps with both an app module (`src/ui/apps/<id>`) and an iframe entry. */
const ISOLATABLE = new Set(["texts", "calculator"]);

export const RUN_SEPARATELY_ACTION = "shell:run-separately";

export const canRunIsolated = (appId: string): boolean => ISOLATABLE.has(appId);

export function getRunIn(appId: string): RunIn {
  const former = formerAppId(appId);
  const chosen =
    getAppSetting(appId, "run-in") ?? (former ? getAppSetting(former, "run-in") : undefined);
  return canRunIsolated(appId) && chosen === "isolated" ? "isolated" : "shell";
}

export const setRunIn = (appId: string, runIn: RunIn): void =>
  setAppSetting(appId, "run-in", runIn === "isolated" ? runIn : null);
