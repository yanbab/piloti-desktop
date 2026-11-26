import type { Piloti } from "@/lib/engine/piloti";
import { GNOME_ENV_PREFIX, GNOME_SESSION_ENV } from "./types";
import {
  ensureXwaylandSatellite,
  getCachedXwaylandDisplay,
} from "./xwayland";
import { isWebEngine } from "@/lib/engine/engine";

export async function runText(
  piloti: Pick<Piloti, "processes">,
  argv: readonly string[]
): Promise<string | null> {
  try {
    const res = await piloti.processes.run(argv);
    return res.match({
      Ok: (ran) => (ran.code === 0 ? ran.stdout : null),
      Err: () => null,
    });
  } catch {
    return null;
  }
}

export async function commandExists(
  piloti: Piloti,
  bin: string
): Promise<boolean> {
  const out = await runText(piloti, [
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
  piloti: Piloti,
  argv: readonly string[],
  options?: { cwd?: string; extraEnv?: Record<string, string> }
): void {
  if (argv.length === 0) return;

  const isBrowserMock = isWebEngine();

  const spawnWithEnv = (resolvedEnv?: Record<string, string>) => {
    const mergedEnv =
      resolvedEnv || options?.extraEnv
        ? { ...resolvedEnv, ...options?.extraEnv }
        : undefined;

    if (options?.cwd || (mergedEnv && Object.keys(mergedEnv).length > 0)) {
      piloti.processes
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
              piloti.processes.launch(argv);
            },
          });
        })
        .catch(() => {
          piloti.processes.launch(argv);
        });
      return;
    }

    piloti.processes.launch(argv);
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

  void ensureXwaylandSatellite(piloti)
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
  piloti: Piloti,
  argv: readonly string[],
  options?: { cwd?: string; extraEnv?: Record<string, string> }
): void {
  if (argv.length === 0) return;

  if (!options?.cwd && !options?.extraEnv) {
    piloti.processes.launch([...GNOME_ENV_PREFIX, ...argv]);
    return;
  }

  launchDesktopCommand(piloti, argv, {
    cwd: options?.cwd,
    extraEnv: { ...GNOME_SESSION_ENV, ...options?.extraEnv },
  });
}

