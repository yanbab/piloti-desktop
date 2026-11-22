import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import {
  mergeAutostartEntries,
  parseAutostartDesktopFile,
  type XdgAutostartEntry,
} from "@/lib/xdg/xdg-autostart";
import { tokenizeExec } from "@/lib/xdg/xdg-desktop-entry";
import { commandExists, launchDesktopCommand, runText } from "./exec";

const SKIP_SYSTEM_AUTOSTART_PREFIXES = [
  "gnome-shell",
  "org.gnome.SettingsDaemon.",
  "gnome-initial-setup",
  "gnome-keyring-pkcs11",
  "xdg-user-dirs",
  "at-spi-dbus-bus",
  "localsearch-",
  "tracker-miner-",
  "org.gnome.Calls-daemon",
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
 * Parses a FreeDesktop/GNOME `AutostartCondition=` expression into a structured check.
 */
export type ParsedAutostartCondition =
  | { kind: "gsettings"; schema: string; key: string }
  | { kind: "if-exists"; relPath: string }
  | { kind: "unless-exists"; relPath: string }
  | { kind: "unknown"; raw: string };

export function parseAutostartCondition(
  raw: string | undefined
): ParsedAutostartCondition | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw.trim().split(/\s+/);
  const kind = parts[0];
  if (kind === "GSettings" && parts.length >= 3) {
    return { kind: "gsettings", schema: parts[1], key: parts[2] };
  }
  if ((kind === "if-exists" || kind === "unless-exists") && parts.length >= 2) {
    return { kind, relPath: parts.slice(1).join(" ") };
  }
  return { kind: "unknown", raw: raw.trim() };
}

/**
 * Returns true if a merged XDG autostart entry is safe and eligible to launch
 * automatically on Piloti/Domicile session startup (before async condition checks).
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

async function evaluateAutostartCondition(
  domicile: Domicile,
  rawCondition: string | undefined
): Promise<boolean> {
  const cond = parseAutostartCondition(rawCondition);
  if (!cond) return true;

  if (cond.kind === "gsettings") {
    const out = await runText(domicile, [
      "gsettings",
      "get",
      cond.schema,
      cond.key,
    ]);
    return out?.trim().toLowerCase() === "true";
  }

  if (cond.kind === "if-exists" || cond.kind === "unless-exists") {
    const check = await runText(domicile, [
      "sh",
      "-c",
      'p="$1"; case "$p" in /*) ;; *) p="${XDG_CONFIG_HOME:-$HOME/.config}/$p" ;; esac; [ -e "$p" ] && echo YES || echo NO',
      "sh",
      cond.relPath,
    ]);
    const exists = check?.trim() === "YES";
    return cond.kind === "if-exists" ? exists : !exists;
  }

  // Unknown condition types fail closed so conditional daemons (e.g. screen readers)
  // are never accidentally launched.
  return false;
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
      const parsed = parseAutostartDesktopFile(
        item.name,
        fullPath,
        text,
        source,
        ["Piloti", "GNOME"]
      );
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
 * and launches eligible entries once per Wayland session (honoring `NotShowIn`,
 * `OnlyShowIn`, `TryExec`, and `AutostartCondition`, and guarded by a runtime
 * marker under `$XDG_RUNTIME_DIR` so shell reloads do not duplicate processes).
 */
export async function runXdgAutostartOnce(domicile: Domicile): Promise<string[]> {
  if (autostartTriggeredInPage) return [];
  autostartTriggeredInPage = true;

  // Guard across shell hot-reloads in the same Wayland session, and never run in greeter mode.
  const markerCheck = await runText(domicile, [
    "sh",
    "-c",
    'if [ "${PILOTI_GREETER:-0}" = "1" ] || [ -n "${GREETD_SOCK:-}" ]; then echo SKIP; exit 0; fi; dir="${XDG_RUNTIME_DIR:-/tmp}"; disp="${WAYLAND_DISPLAY:-default}"; f="$dir/piloti-autostart.$disp.done"; if [ -f "$f" ]; then echo SKIP; else touch "$f" && echo RUN; fi',
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
    if (entry.tryExec && !(await commandExists(domicile, entry.tryExec))) {
      continue;
    }
    if (
      entry.autostartCondition &&
      !(await evaluateAutostartCondition(domicile, entry.autostartCondition))
    ) {
      continue;
    }
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
