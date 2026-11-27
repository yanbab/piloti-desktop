import type { AppMenuSection } from "@/data/catalog";
import type { RemoteMenuEntry, RemoteMenuSection } from "@/lib/xdg/xdg-app-menu";

export function formatMenuShortcut(shortcut: string, model: "mac" | "pc"): string {
  if (!shortcut) return shortcut;
  if (model === "pc") {
    const pc = shortcut
      .replace(/⌃/g, "Ctrl+")
      .replace(/⌥/g, "Alt+")
      .replace(/⇧/g, "Shift+")
      .replace(/⌘/g, "Super+")
      .replace(/\+\+/g, "+PLUS")
      .replace(/\+$/g, "")
      .split("+")
      .filter(Boolean)
      .map((p) => (p === "PLUS" ? "+" : p))
      .join(" + ");
    return pc;
  }
  // Mac style with Apple key symbols (no spaces)
  if (/[⌘⌥⇧⌃]/.test(shortcut)) {
    const match = shortcut.match(/^([⌃⌥⇧⌘]+)\s*(.+)$/);
    return match ? `${match[1]}${match[2].replace(/\s+/g, "")}` : shortcut.replace(/\s+/g, "");
  }
  const normalized = shortcut.replace(/\+\+/g, "+PLUS");
  const parts = normalized.split("+").filter(Boolean);
  let hasCtrl = false;
  let hasAlt = false;
  let hasShift = false;
  let hasCmd = false;
  const keys: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") hasCtrl = true;
    else if (lower === "alt" || lower === "option") hasAlt = true;
    else if (lower === "shift") hasShift = true;
    else if (lower === "cmd" || lower === "meta" || lower === "super") hasCmd = true;
    else if (lower === "plus") keys.push("+");
    else if (lower === "left") keys.push("←");
    else if (lower === "right") keys.push("→");
    else if (lower === "up") keys.push("↑");
    else if (lower === "down") keys.push("↓");
    else if (lower === "return" || lower === "enter") keys.push("↩");
    else if (lower === "esc" || lower === "escape") keys.push("⎋");
    else if (lower === "tab") keys.push("⇥");
    else keys.push(part);
  }
  if (hasCtrl && !hasCmd) {
    hasCmd = true;
    hasCtrl = false;
  }
  const mods = [
    hasCtrl ? "⌃" : "",
    hasAlt ? "⌥" : "",
    hasShift ? "⇧" : "",
    hasCmd ? "⌘" : "",
  ].join("");
  return mods ? `${mods}${keys.join("")}` : keys.join("");
}

export interface ShortcutEntry {
  label: string;
  /** Raw shortcut as declared by the menu (e.g. "Ctrl+S", "⌘1"). */
  shortcut: string;
}

export interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

function cleanLabel(label: string): string {
  // GTK/DBus menus use "_" as the mnemonic marker ("_Open" -> "Open", "__" -> "_").
  return label.replace(/__/g, "\u0000").replace(/_/g, "").replace(/\u0000/g, "_").trim();
}

function collectRemoteEntries(
  entries: readonly RemoteMenuEntry[],
  out: ShortcutEntry[],
): void {
  for (const entry of entries) {
    if (entry.kind !== "item") continue;
    if (entry.shortcut && entry.label) {
      out.push({ label: cleanLabel(entry.label), shortcut: entry.shortcut });
    }
    if (entry.submenu) collectRemoteEntries(entry.submenu, out);
  }
}

function dedupe(entries: ShortcutEntry[]): ShortcutEntry[] {
  const seen = new Set<string>();
  const result: ShortcutEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.label}\u0000${entry.shortcut}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

/**
 * Builds the keyboard-shortcut groups shown by Help > Shortcuts from the live menu
 * entries: built-in app menus (`AppMenuSection`), remote GTK/DBus menu sections and
 * any extra always-available groups (e.g. window management).
 */
export function collectMenuShortcuts({
  menus = [],
  remoteSections = [],
  remoteAppActions = [],
  extraGroups = [],
}: {
  menus?: readonly AppMenuSection[];
  remoteSections?: readonly RemoteMenuSection[];
  remoteAppActions?: readonly RemoteMenuEntry[];
  extraGroups?: readonly ShortcutGroup[];
}): ShortcutGroup[] {
  const groups: ShortcutGroup[] = [];
  const push = (title: string, entries: ShortcutEntry[]) => {
    const unique = dedupe(entries);
    if (unique.length > 0) groups.push({ title: cleanLabel(title), entries: unique });
  };

  for (const section of menus) {
    push(
      section.title,
      section.items
        .filter((item) => item.shortcut)
        .map((item) => ({ label: item.label, shortcut: item.shortcut as string })),
    );
  }

  const appActionEntries: ShortcutEntry[] = [];
  collectRemoteEntries(remoteAppActions, appActionEntries);
  push("Application", appActionEntries);

  for (const section of remoteSections) {
    const out: ShortcutEntry[] = [];
    collectRemoteEntries(section.items, out);
    push(section.title, out);
  }

  for (const group of extraGroups) push(group.title, [...group.entries]);
  return groups;
}
