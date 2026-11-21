import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";

/**
 * Debug and local fallback paths checked when `xwayland-satellite` is built
 * from source under `$HOME/Projets` or `$HOME/Projects` but not yet in `$PATH`.
 */
export const XWAYLAND_SATELLITE_FALLBACK_PATHS = [
  "$HOME/.local/bin/xwayland-satellite",
  "$HOME/Projets/xwayland-satellite/target/release/xwayland-satellite",
  "$HOME/Projets/xwayland-satellite/target/debug/xwayland-satellite",
  "$HOME/Projects/xwayland-satellite/target/release/xwayland-satellite",
  "$HOME/Projects/xwayland-satellite/target/debug/xwayland-satellite",
] as const;

let cachedDisplay: string | null = null;
let cachedBinaryPath: string | null | undefined = undefined;
let ensurePromise: Promise<string | null> | null = null;

/**
 * Parses `/tmp/.X11-unix` directory listing lines (e.g. `X0`, `X10`) into sorted display numbers.
 */
export function parseX11DisplaySockets(listing: string): number[] {
  const nums = new Set<number>();
  for (const token of listing.split(/\s+/)) {
    const trimmed = token.trim();
    const m = /^X(\d+)$/.exec(trimmed);
    if (m) {
      nums.add(Number.parseInt(m[1], 10));
    }
  }
  return Array.from(nums).sort((a, b) => a - b);
}

/**
 * Picks the lowest unused X11 display string (e.g. `:0`, `:1`) given occupied `/tmp/.X11-unix/X*` numbers.
 */
export function pickAvailableXDisplay(existingNumbers: readonly number[]): string {
  const used = new Set(existingNumbers);
  for (let n = 0; n < 64; n += 1) {
    if (!used.has(n)) return `:${n}`;
  }
  return ":0";
}

/**
 * Extracts an active `:<N>` display argument from a running `xwayland-satellite` process line.
 */
export function parseRunningSatelliteDisplay(psOutput: string): string | null {
  for (const line of psOutput.split(/\r?\n/)) {
    if (!line.includes("xwayland-satellite")) continue;
    const m = /(?:^|\s)(:\d+)(?:\s|$)/.exec(line);
    if (m) return m[1];
  }
  return null;
}

/**
 * Resolves `xwayland-satellite` from `$PATH` first, then standard debug/release build locations.
 */
export async function detectXwaylandSatelliteBinary(
  domicile: Domicile
): Promise<string | null> {
  if (cachedBinaryPath !== undefined) return cachedBinaryPath;
  const script = [
    'command -v xwayland-satellite 2>/dev/null || {',
    ...XWAYLAND_SATELLITE_FALLBACK_PATHS.map(
      (p) => `  [ -x "${p}" ] && echo "${p}" && exit 0`
    ),
    "  exit 1",
    "}",
  ].join("\n");
  try {
    const res = await domicile.processes.run(["sh", "-c", script]);
    const found = res.match({
      Ok: (r) => (r.code === 0 ? r.stdout.trim().split(/\r?\n/)[0] || null : null),
      Err: () => null,
    });
    cachedBinaryPath = found;
    return found;
  } catch {
    return null;
  }
}

export function getCachedXwaylandDisplay(): string | null {
  return cachedDisplay;
}

export function resetXwaylandCacheForTest(): void {
  cachedDisplay = null;
  cachedBinaryPath = undefined;
  ensurePromise = null;
}

/**
 * Detects an existing `xwayland-satellite` instance or starts one cleanly on a
 * free X11 display (`:0`, `:1`, ...) under the active Wayland session.
 */
export async function ensureXwaylandSatellite(
  domicile: Domicile
): Promise<string | null> {
  if (cachedDisplay) return cachedDisplay;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      const probeRes = await domicile.processes.run([
        "sh",
        "-c",
        'printf "ENV_DISPLAY=%s\\n" "$DISPLAY"; ls -1 /tmp/.X11-unix 2>/dev/null; echo "---"; ps -eo args 2>/dev/null | grep -i "[x]wayland-satellite" || true',
      ]);
      const probeOut = probeRes.match({
        Ok: (r) => (r.code === 0 ? r.stdout : ""),
        Err: () => "",
      });

      const [topPart = "", psPart = ""] = probeOut.split("---");
      const runningDisplay = parseRunningSatelliteDisplay(psPart);
      if (runningDisplay) {
        cachedDisplay = runningDisplay;
        return runningDisplay;
      }

      const envMatch = /^ENV_DISPLAY=(.*)$/m.exec(topPart);
      const existingEnvDisplay = envMatch?.[1]?.trim();
      const sockets = parseX11DisplaySockets(topPart);
      if (existingEnvDisplay && /^:\d+/.test(existingEnvDisplay)) {
        const num = Number.parseInt(existingEnvDisplay.slice(1), 10);
        if (sockets.includes(num)) {
          cachedDisplay = existingEnvDisplay;
          return existingEnvDisplay;
        }
      }

      const bin = await detectXwaylandSatelliteBinary(domicile);
      if (!bin) return null;

      const display = pickAvailableXDisplay(sockets);
      const sockPath = `/tmp/.X11-unix/X${display.slice(1)}`;
      domicile.processes.launch([bin, display]);

      // Wait briefly for Xwayland socket creation so first X11 app succeeds immediately
      await domicile.processes
        .run([
          "sh",
          "-c",
          `i=0; while [ ! -S "${sockPath}" ] && [ "$i" -lt 25 ]; do sleep 0.08; i=$((i+1)); done; [ -S "${sockPath}" ]`,
        ])
        .then((r) =>
          r.match({
            Ok: (ran) => {
              if (ran.code === 0) {
                cachedDisplay = display;
              }
            },
            Err: () => undefined,
          })
        )
        .catch(() => undefined);

      return cachedDisplay ?? display;
    } catch {
      return null;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}

