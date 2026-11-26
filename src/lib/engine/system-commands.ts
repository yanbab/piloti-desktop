/**
 * The system commands the shell runs. UI code asks here; it never builds a
 * command line or calls `piloti.processes` itself
 * (`tests/unit/engine-boundary.test.ts` checks it).
 */
import type { Piloti } from "@/lib/engine/piloti";

export { launchDesktopCommand, runText } from "@/lib/engine-native/exec";
export { listInstalledFontFamilies } from "@/lib/engine-native/gsettings";

type Host = Pick<Piloti, "processes">;

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
