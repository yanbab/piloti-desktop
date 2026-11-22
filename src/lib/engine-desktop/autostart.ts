import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import {
  mergeAutostartEntries,
  parseAutostartDesktopFile,
  type XdgAutostartEntry,
} from "@/lib/xdg/xdg-autostart";
import { tokenizeExec } from "@/lib/xdg/xdg-desktop-entry";
import { launchDesktopCommand, runText } from "./exec";

const SKIP_SYSTEM_AUTOSTART_PREFIXES = [
  "gnome-shell",
  "org.gnome.SettingsDaemon.",
  "gnome-initial-setup",
  "gnome-keyring-pkcs11",
  "xdg-user-dirs",
];

/**
 * Strips FreeDesktop Exec field codes (`%f`, `%F`, `%u`, `%U`, `%i`, `%c`, `%k`)
 * and returns a clean argv array suitable for spawning an autostart entry.
 */
export function buildAutostartArgv(execLine: string | undefined): string[] {
  if (!execLine || !execLine.trim()) return [];
  const tokens = tokenizeExec(execLine);
  const out: string[] = [];
  for (const tok of tokens) {
    if (/^%[fFuUdDnNickvm]$/.test(tok)) continue;
    const cleaned = tok.replace(/%[fFuUdDnNickvm]/g, "").trim();
    if (cleaned) out.push(cleaned);
  }
  return out;
}

/**
 * Returns true if a merged XDG autostart entry is safe and eligible to launch
 * automatically on Piloti/Domicile session startup.
 */
export function shouldLaunchAutostartEntry(entry: XdgAutostartEntry): boolean {
  if (!entry.enabled || entry.hidden || !entry.exec) return false;
  if (entry.source === "system") {
    const lowerId = entry.id.toLowerCase();
    for (const prefix of SKIP_SYSTEM_AUTOSTART_PREFIXES) {
      if (lowerId.startsWith(prefix.toLowerCase())) {
        return false;
      }
    }
  }
  return buildAutostartArgv(entry.exec).length > 0;
}

async function readAutostartDir(
  domicile: Domicile,
  dirPath: string,
  source: "user" | "system"
): Promise<XdgAutostartEntry[]> {
  const entries: XdgAutostartEntry[] = [];
  try {
    const dirRes = await domicile.files.readDir(dirPath);
    const items = dirRes.match({
      Ok: (list) => list,
      Err: () => [],
    });
    for (const item of items) {
      if (!item.name.endsWith(".desktop")) continue;
      const fullPath = `${dirPath.replace(/\/$/, "")}/${item.name}`;
      const textRes = await domicile.files.readText(fullPath);
      const text = textRes.match({ Ok: (s) => s, Err: () => null });
      if (!text) continue;
      const parsed =
        parseAutostartDesktopFile(item.name, fullPath, text, source, "Piloti") ??
        parseAutostartDesktopFile(item.name, fullPath, text, source, "GNOME");
      if (parsed) entries.push(parsed);
    }
  } catch {
    // ignore missing autostart dirs
  }
  return entries;
}

let autostartTriggeredInPage = false;

/**
 * Discovers merged XDG Autostart entries (`/etc/xdg/autostart` + `~/.config/autostart`)
 * and launches eligible entries once per Wayland session (using a runtime marker under
 * `$XDG_RUNTIME_DIR` so shell hot-reloads do not duplicate autostart processes).
 */
export async function runXdgAutostartOnce(domicile: Domicile): Promise<string[]> {
  if (autostartTriggeredInPage) return [];
  autostartTriggeredInPage = true;

  // Guard across shell hot-reloads in the same Wayland session.
  const markerCheck = await runText(domicile, [
    "sh",
    "-c",
    'dir="${XDG_RUNTIME_DIR:-/tmp}"; disp="${WAYLAND_DISPLAY:-default}"; f="$dir/piloti-autostart.$disp.done"; if [ -f "$f" ]; then echo SKIP; else touch "$f" && echo RUN; fi',
  ]);
  if (markerCheck?.trim() !== "RUN") {
    return [];
  }

  const [systemEntries, userEntries] = await Promise.all([
    readAutostartDir(domicile, "/etc/xdg/autostart", "system"),
    readAutostartDir(domicile, ".config/autostart", "user"),
  ]);

  const merged = mergeAutostartEntries(systemEntries, userEntries);
  const launched: string[] = [];

  for (const entry of merged) {
    if (!shouldLaunchAutostartEntry(entry)) continue;
    const argv = buildAutostartArgv(entry.exec);
    if (argv.length === 0) continue;
    try {
      launchDesktopCommand(domicile, argv);
      launched.push(entry.id);
    } catch {
      // continue launching remaining entries
    }
  }

  if (launched.length > 0) {
    console.info("[Piloti] xdg-autostart launched:", launched.join(", "));
  }
  return launched;
}
