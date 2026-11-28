/**
 * `Apps` for an app in its own process. It may run programs but not launch
 * them, and a program it starts is its own: so it asks the shell, through the
 * `piloti` command, and launching stays in one place.
 */
import { createInstalledApps } from "@/lib/apps/installed-apps";
import type { Apps, AppsHost } from "@/lib/ports/apps";

export function createModuleApps(host: AppsHost): Apps {
  const installed = createInstalledApps(host);
  return {
    list: (options) => installed.list({ deferIconDataLoad: true, ...options }),
    launch(appId, { payload } = {}) {
      void host.processes
        .run(["piloti", "open", appId, ...(payload ? [payload] : [])])
        .then((ran) =>
          ran.match({
            Ok: (r) => {
              if (r.code !== 0) console.warn(`[piloti] could not open ${appId}: ${r.stderr}`);
            },
            Err: (e) => console.warn(`[piloti] could not open ${appId}: ${e.message}`),
          }),
        );
    },
  };
}
