import type { RemoteMenuEntry } from "@/lib/xdg/xdg-app-menu";

/** A runnable menu command, as listed by the Help ▸ search HUD (Cmd+K). */
export interface MenuCommand {
  id: string;
  label: string;
  /** Menu path above the item, e.g. ["File"] or ["View", "Zoom"]. */
  path: readonly string[];
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  run: () => void;
}

/** Window-level event that opens the Help menu with its search field focused. */
export const OPEN_COMMAND_HUD_EVENT = "piloti:open-command-hud";

export function cleanMenuLabel(label: string): string {
  // GTK/DBus mnemonic marker "_" ("_Open" -> "Open", "__" -> "_"), trailing ellipsis kept.
  return label.replace(/__/g, "\u0000").replace(/_/g, "").replace(/\u0000/g, "_").trim();
}

/** Flattens a remote (GTK / DBusMenu) entry tree into commands. */
export function collectRemoteMenuCommands(
  entries: readonly RemoteMenuEntry[],
  path: readonly string[],
  out: MenuCommand[] = [],
): MenuCommand[] {
  for (const entry of entries) {
    if (entry.kind !== "item" || !entry.label) continue;
    const label = cleanMenuLabel(entry.label);
    if (entry.submenu && entry.submenu.length > 0) {
      collectRemoteMenuCommands(entry.submenu, [...path, label], out);
      continue;
    }
    const activate = entry.activate;
    if (!activate) continue;
    out.push({
      id: `remote:${path.join("/")}:${entry.id}`,
      label,
      path,
      shortcut: entry.shortcut,
      checked: entry.checked,
      disabled: !entry.enabled,
      run: () => void activate(),
    });
  }
  return out;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[…\.]+$/g, "")
    .toLowerCase();
}

/** Scores a command against a query; -1 means no match. Higher is better. */
export function scoreMenuCommand(command: Pick<MenuCommand, "label" | "path">, query: string): number {
  const q = normalize(query.trim());
  if (!q) return -1;
  const label = normalize(command.label);
  const full = normalize([...command.path, command.label].join(" "));
  if (label === q) return 1000;
  if (label.startsWith(q)) return 800 - label.length;
  const wordIdx = label.split(/\s+/).findIndex((w) => w.startsWith(q));
  if (wordIdx >= 0) return 600 - wordIdx * 10 - label.length;
  if (label.includes(q)) return 400 - label.indexOf(q);
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length > 1 && terms.every((t) => full.includes(t))) return 300;
  if (full.includes(q)) return 200;
  // Subsequence match ("tln" -> "Toggle Line Numbers")
  let i = 0;
  for (const ch of label) if (ch === q[i]) i += 1;
  if (i === q.length && q.length >= 2) return 50;
  return -1;
}

/** Returns matching commands (deduplicated by path + label), best first. */
export function searchMenuCommands(
  commands: readonly MenuCommand[],
  query: string,
  limit = 12,
): MenuCommand[] {
  const seen = new Set<string>();
  return commands
    .map((command, index) => ({ command, index, score: scoreMenuCommand(command, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((r) => {
      const key = `${r.command.path.join("/")}\u0000${r.command.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((r) => r.command);
}
