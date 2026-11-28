/** What System Monitor needs from whoever runs it: the shell, or its own process. */
import type { ShellHost } from "@/core/ports/shell-host";
import type { SystemSample } from "@/core/system/system-stats";
import { defineSettings } from "@/core/state/settings";
import { parseIniText } from "@/core/config/ini";

export interface MonitorAppInfo {
  name?: string;
  iconUrl?: string;
}

export interface SystemMonitorHost {
  shell: ShellHost;
  /** CPU, memory and processes from `/proc`; `null` if it could not be read. */
  readSample(): Promise<SystemSample | null>;
  /** Names and icons of these apps, as far as known. */
  describeApps(appIds: readonly string[]): Promise<Record<string, MonitorAppInfo>>;
  /** For a host that learns names and icons as it goes: ask again then. */
  onAppsChanged?(listener: () => void): () => void;
  /** The demo has no processes: its apps are given made-up ones. */
  simulatedProcesses: boolean;
}

/** Widget places and the apps list sort (`~/.config/piloti/apps/system-monitor.ini`). */
export const monitorSettings = defineSettings("org.piloti.system-monitor", {
  "widget-cells": "",
  sort: "",
});

/** Where they were kept before (`~/.config/piloti/piloti-system-monitor.ini`). */
export const FORMER_SETTINGS = ".config/piloti/piloti-system-monitor.ini";

/** Takes the former file's values once, when the new ones were never set. */
export function carryOverSettings(former: string | null): void {
  if (!former) return;
  const general = parseIniText(former).General ?? {};
  for (const key of ["widget-cells", "sort"] as const) {
    const value = general[key];
    if (value && !monitorSettings.get(key)) monitorSettings.set(key, value);
  }
}
