// Domicile app module: System Monitor in its own process. See docs/ARCHITECTURE.md.
import * as React from "react";
import { appIconThemes, createAppDescriber } from "@/core/apps/describe-apps";
import { readModuleText } from "@/platform/shared/app-module-host";
import { readSystemSample } from "@/platform/shared/system-commands";
import { mountModuleApp } from "@/ui/apps/module-app";
import { carryOverSettings, FORMER_SETTINGS, type SystemMonitorHost } from "@/ui/apps/system-monitor/host";
import { SystemMonitorApp } from "@/ui/apps/system-monitor/SystemMonitorApp";

// The shell draws this module's titlebar (`csd: false` in core/data/app-modules.ts).
export const main = mountModuleApp(
  { appId: "system-monitor", title: "System Monitor", decorations: "server" },
  async (module) => {
    carryOverSettings(await readModuleText(module.files, FORMER_SETTINGS));
    const describeApps = createAppDescriber(
      module,
      module.host.apps,
      appIconThemes(module.desktop.current()),
    );
    const host: SystemMonitorHost = {
      shell: module.shell,
      // One `sh` reads /proc, as in the shell.
      readSample: () => readSystemSample({ vfs: module.host.vfs, processes: module.processes }),
      describeApps,
      simulatedProcesses: false,
    };
    return () => <SystemMonitorApp host={host} />;
  },
);
