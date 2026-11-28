/**
 * The system commands the shell runs. UI code asks here; it never builds a
 * command line or calls `piloti.processes` itself
 * (`tests/unit/engine-boundary.test.ts` checks it).
 */
import type { Piloti } from "@/platform/shared/piloti";

export { launchDesktopCommand, runText } from "@/platform/native/exec";
import { commandExists } from "@/platform/native/exec";
export { runPortalRequest } from "@/platform/native/portal-request";
export { readSystemSample } from "@/platform/native/system-stats";
export { listInstalledFontFamilies } from "@/platform/native/gsettings";

type Host = Pick<Piloti, "processes">;

/** Whether `bsdtar` is there: Compress and Extract need it. */
export async function hasArchiver(piloti: Piloti): Promise<boolean> {
  return commandExists(piloti, "bsdtar").catch(() => false);
}

/** Starts the first of these programs that is installed; `false` if none is. */
async function launchFirst(piloti: Piloti, commands: readonly string[][]): Promise<boolean> {
  for (const argv of commands) {
    if (await commandExists(piloti, argv[0])) {
      piloti.processes.launch(argv);
      return true;
    }
  }
  return false;
}

/** The viewer GNOME Settings uses, or its older one. */
export function showKeyboardLayout(piloti: Piloti, layout: string): Promise<boolean> {
  return launchFirst(piloti, [["tecla", layout], ["gkbd-keyboard-display", "-l", layout]]);
}

export function showOnScreenKeyboard(piloti: Piloti): Promise<boolean> {
  return launchFirst(piloti, [["wvkbd-mobintl"], ["squeekboard"], ["onboard"]]);
}

/** Ends the session, restarts or powers off. */
export function runPowerAction(piloti: Host, action: "logout" | "restart" | "poweroff") {
  return piloti.processes.run(
    action === "logout"
      ? [
          "sh",
          "-c",
          'if [ -n "$XDG_SESSION_ID" ]; then loginctl terminate-session "$XDG_SESSION_ID"; else loginctl terminate-user "$USER"; fi',
        ]
      : ["systemctl", action === "restart" ? "reboot" : "poweroff"],
  );
}

/** What may name a running app's processes. */
export interface AppProcess {
  pid?: number | null;
  flatpakId?: string;
  execName?: string;
  processName?: string;
  appId?: string;
}

/** Force Quit: kills by every name known; the ones that match nothing are ignored. */
export function killAppProcesses(piloti: Host, app: AppProcess): void {
  const run = (argv: string[]) => void piloti.processes.run(argv).catch(() => {});
  if (typeof app.pid === "number" && app.pid > 0) run(["kill", "-9", String(app.pid)]);
  if (app.flatpakId?.includes(".")) run(["flatpak", "kill", app.flatpakId]);
  if (app.execName && app.execName !== "flatpak") run(["pkill", "-9", "-x", app.execName]);
  if (app.processName) run(["pkill", "-9", "-i", app.processName]);
  if (app.appId) run(["pkill", "-9", "-f", app.appId]);
}

/** Starts a plugin command's program, without waiting for it. */
export function spawnProgram(piloti: Host, argv: readonly string[]): void {
  void piloti.processes.spawn(argv).catch(() => undefined);
}

/** A line of `sh`, as typed in Piloti Shell. */
export function runShellLine(piloti: Host, line: string) {
  return piloti.processes.run(["sh", "-c", line]);
}

const LIST_PROGRAMS = 'IFS=:; for dir in $PATH; do [ -d "$dir" ] && ls -1 "$dir"; done';

/** The names of the programs of `$PATH`. */
export async function listPathPrograms(piloti: Host): Promise<string[]> {
  const result = await piloti.processes.run(["sh", "-c", LIST_PROGRAMS]);
  return result
    .match({ Ok: (ran) => ran.stdout, Err: () => "" })
    .split("\n")
    .filter(Boolean);
}

/** Moves what is left of `~/.config/Piloti` (capital P) into `~/.config/piloti`. */
export async function mergeConfigDirs(piloti: Host, from: string, into: string): Promise<void> {
  await piloti.processes.run(["sh", "-c", 'mkdir -p "$2" && cp -rn "$1"/. "$2"/ && rm -rf "$1"', "sh", from, into]);
}

// Relative folders are in `$HOME`; theme folders that are links are followed too.
const FOLDERS_STAMP = `n=$#
while [ $n -gt 0 ]; do d=$1; shift; n=$((n-1)); case $d in /*) ;; *) d=$HOME/$d ;; esac; set -- "$@" "$d"; done
for r do for t in "$r"/*; do [ -L "$t" ] && [ -d "$t" ] && set -- "$@" "$t"; done; done
find -H "$@" \\( -type d -o -name index.theme \\) -printf '%p %T@\\n' 2>/dev/null | LC_ALL=C sort | cksum`;

/**
 * A checksum of the icon folders' modification times: it changes when icons are
 * added, removed or renamed. `null` when it can't be told.
 */
export async function readIconFoldersStamp(piloti: Host, dirs: readonly string[]): Promise<string | null> {
  const result = await piloti.processes.run(["sh", "-c", FOLDERS_STAMP, "sh", ...dirs]).catch(() => null);
  const out = result?.match({ Ok: (ran) => ran.stdout.trim(), Err: () => "" });
  // `cksum` of nothing ends in a size of 0.
  return out && !out.endsWith(" 0") ? out : null;
}

/** Broadcasts `message` on the session bus, as `org.piloti.Shell.Message`. */
export function emitShellSignal(piloti: Pick<Piloti, "processes">, message: string): void {
  void piloti.processes.run([
    "gdbus",
    "emit",
    "--session",
    "--object-path",
    "/org/piloti/Shell",
    "--signal",
    "org.piloti.Shell.Message",
    `'${message.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`,
  ]);
}

export interface RendererMemory {
  count: number;
  /** Resident memory of all of them. */
  totalKb: number;
}

/** Chromium's renderer processes: the shell, and one per app module or web page. */
export async function readRendererMemory(piloti: Pick<Piloti, "processes">): Promise<RendererMemory | null> {
  try {
    const out = (await piloti.processes.run(["ps", "-eo", "rss=,args="])).match({
      Ok: (r) => (r.code === 0 ? r.stdout : null),
      Err: () => null,
    });
    return out === null ? null : parseRendererMemory(out);
  } catch {
    return null;
  }
}

export function parseRendererMemory(ps: string): RendererMemory {
  const sizes = ps
    .split("\n")
    .filter((line) => line.includes("--type=renderer"))
    .map((line) => Number.parseInt(line.trim(), 10) || 0);
  return { count: sizes.length, totalKb: sizes.reduce((a, b) => a + b, 0) };
}

/** Resident memory of one process, in kB. */
export async function readProcessMemory(piloti: Pick<Piloti, "processes">, pid: number): Promise<number | null> {
  try {
    return (await piloti.processes.run(["ps", "-o", "rss=", "-p", String(pid)])).match({
      Ok: (r) => (r.code === 0 ? Number.parseInt(r.stdout.trim(), 10) || null : null),
      Err: () => null,
    });
  } catch {
    return null;
  }
}
