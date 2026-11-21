import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { GNOME_ENV_PREFIX, GNOME_SESSION_ENV } from "./types";
import {
  ensureXwaylandSatellite,
  getCachedXwaylandDisplay,
} from "./xwayland";

export async function runText(
  domicile: Domicile,
  argv: readonly string[]
): Promise<string | null> {
  try {
    const res = await domicile.processes.run(argv);
    return res.match({
      Ok: (ran) => (ran.code === 0 ? ran.stdout : null),
      Err: () => null,
    });
  } catch {
    return null;
  }
}

export async function commandExists(
  domicile: Domicile,
  bin: string
): Promise<boolean> {
  const out = await runText(domicile, [
    "sh",
    "-c",
    'command -v "$1"',
    "sh",
    bin,
  ]);
  return Boolean(out && out.trim().length > 0);
}

export function hashPathKey(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Launches a Linux / XDG command using the compositor's native environment
 * (matching CLI launches), optionally overriding `cwd` or `extraEnv`.
 * Automatically provides `DISPLAY` via `xwayland-satellite` on Linux when needed.
 */
export function launchDesktopCommand(
  domicile: Domicile,
  argv: readonly string[],
  options?: { cwd?: string; extraEnv?: Record<string, string> }
): void {
  if (argv.length === 0) return;

  const isBrowserMock =
    typeof window !== "undefined" &&
    Boolean((window as { __PILOTI_BROWSER_HOST__?: boolean }).__PILOTI_BROWSER_HOST__);

  const spawnWithEnv = (resolvedEnv?: Record<string, string>) => {
    const mergedEnv =
      resolvedEnv || options?.extraEnv
        ? { ...resolvedEnv, ...options?.extraEnv }
        : undefined;

    if (options?.cwd || (mergedEnv && Object.keys(mergedEnv).length > 0)) {
      domicile.processes
        .spawn(argv, {
          cwd: options?.cwd,
          env: mergedEnv,
        })
        .then((res) => {
          res.match({
            Ok: (sub) => {
              void sub.stdout.cancel().catch(() => {});
              void sub.stderr.cancel().catch(() => {});
            },
            Err: () => {
              domicile.processes.launch(argv);
            },
          });
        })
        .catch(() => {
          domicile.processes.launch(argv);
        });
      return;
    }

    domicile.processes.launch(argv);
  };

  if (isBrowserMock || options?.extraEnv?.DISPLAY) {
    spawnWithEnv();
    return;
  }

  const cachedDisplay = getCachedXwaylandDisplay();
  if (cachedDisplay) {
    spawnWithEnv({ DISPLAY: cachedDisplay });
    return;
  }

  void ensureXwaylandSatellite(domicile)
    .then((display) => {
      spawnWithEnv(display ? { DISPLAY: display } : undefined);
    })
    .catch(() => {
      spawnWithEnv();
    });
}

/**
 * Launches a Linux / XDG command with `XDG_CURRENT_DESKTOP=GNOME` so GNOME apps
 * (especially `gnome-control-center`) enable full GNOME integration.
 */
export function launchWithGnomeEnv(
  domicile: Domicile,
  argv: readonly string[],
  options?: { cwd?: string; extraEnv?: Record<string, string> }
): void {
  if (argv.length === 0) return;

  if (!options?.cwd && !options?.extraEnv) {
    domicile.processes.launch([...GNOME_ENV_PREFIX, ...argv]);
    return;
  }

  launchDesktopCommand(domicile, argv, {
    cwd: options?.cwd,
    extraEnv: { ...GNOME_SESSION_ENV, ...options?.extraEnv },
  });
}

