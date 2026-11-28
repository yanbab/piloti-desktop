import type { Piloti } from "@/core/ports/piloti";
import {
  MenuEntryKind,
  ToggleKind,
  watchMenu,
  type MenuEntry as DbusMenuEntry,
  type WatchedMenu,
} from "@domicile-desktop/sdk/dbusmenu";
import { Bus } from "@domicile-desktop/sdk/system";
import type { XdgDesktopEntry } from "./xdg-desktop-entry";

export interface RemoteMenuItemEntry {
  kind: "item";
  id: string;
  label: string;
  enabled: boolean;
  shortcut?: string;
  checked?: boolean;
  toggleKind?: "checkmark" | "radio";
  submenu?: RemoteMenuEntry[];
  activate?: () => Promise<void> | void;
}

export interface RemoteMenuSeparatorEntry {
  kind: "separator";
  id: string;
}

export type RemoteMenuEntry = RemoteMenuItemEntry | RemoteMenuSeparatorEntry;

export interface RemoteMenuSection {
  title: string;
  items: RemoteMenuEntry[];
}

export interface RemoteGlobalMenu {
  source: "gtk-menus" | "dbusmenu" | "gtk-actions" | "desktop-actions";
  busName?: string;
  sections: RemoteMenuSection[];
  appActions: RemoteMenuEntry[];
  aboutToShowSection?: (index: number) => void;
  cleanup: () => void;
}

export interface GtkActionDescriptor {
  enabled: boolean;
  paramType: string;
  state?: unknown;
}

export interface GtkMenuRawItem {
  label?: string;
  action?: string;
  target?: unknown;
  accel?: string;
  section?: [number, number];
  submenu?: [number, number];
}

export interface GtkMenuRawGroup {
  group: number;
  menu: number;
  items: GtkMenuRawItem[];
}

/**
 * Strips GTK mnemonic markers (`_File` -> `File`, `__` -> `_`).
 */
export function stripGtkMnemonic(raw: string): string {
  return raw.replaceAll(/_(_?)/g, "$1").trim();
}

/**
 * Converts GTK accelerator notation (`<Primary>n`, `<Control><Shift>T`) into
 * readable shortcut labels (`Ctrl+N`, `Ctrl+Shift+T`).
 */
export function formatGtkAccel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const modifiers: string[] = [];
  let rest = trimmed;

  const modRegex = /^<(Primary|Control|Ctrl|Shift|Alt|Mod1|Super|Meta)>/i;
  while (true) {
    const match = modRegex.exec(rest);
    if (!match) break;
    const mod = match[1].toLowerCase();
    if (mod === "primary" || mod === "control" || mod === "ctrl") {
      if (!modifiers.includes("Ctrl")) modifiers.push("Ctrl");
    } else if (mod === "shift") {
      if (!modifiers.includes("Shift")) modifiers.push("Shift");
    } else if (mod === "alt" || mod === "mod1") {
      if (!modifiers.includes("Alt")) modifiers.push("Alt");
    } else if (mod === "super" || mod === "meta") {
      if (!modifiers.includes("Super")) modifiers.push("Super");
    }
    rest = rest.slice(match[0].length);
  }

  const keyNameMap: Record<string, string> = {
    plus: "+",
    minus: "-",
    equal: "=",
    comma: ",",
    period: ".",
    slash: "/",
    bracketleft: "[",
    bracketright: "]",
    return: "Enter",
    escape: "Esc",
    backspace: "Backspace",
    space: "Space",
    question: "?",
  };
  const lowerKey = rest.toLowerCase();
  const formattedKey =
    keyNameMap[lowerKey] ??
    (rest.length === 1 ? rest.toUpperCase() : rest);

  return modifiers.length > 0
    ? `${modifiers.join("+")}+${formattedKey}`
    : formattedKey;
}

/**
 * Extracts `<interface name="...">` and `<node name="...">` declarations from
 * D-Bus XML introspection output.
 */
export function parseDbusIntrospectXml(xml: string): {
  interfaces: string[];
  childNodes: string[];
} {
  const interfaces: string[] = [];
  const childNodes: string[] = [];

  for (const match of xml.matchAll(/<interface\s+name=["']([^"']+)["']/g)) {
    interfaces.push(match[1]);
  }
  for (const match of xml.matchAll(/<node\s+name=["']([^"']+)["']/g)) {
    const name = match[1];
    if (name && !name.startsWith("/")) {
      childNodes.push(name);
    }
  }
  return { interfaces, childNodes };
}

function unwrapVariant(val: unknown): unknown {
  if (
    val !== null &&
    typeof val === "object" &&
    "value" in (val as Record<string, unknown>) &&
    Object.keys(val as Record<string, unknown>).length <= 2
  ) {
    return (val as { value: unknown }).value;
  }
  return val;
}

function toVariantSignature(val: unknown): { signature: string; value: unknown } | null {
  if (
    val !== null &&
    typeof val === "object" &&
    "signature" in (val as Record<string, unknown>) &&
    "value" in (val as Record<string, unknown>)
  ) {
    return val as { signature: string; value: unknown };
  }
  const inner = unwrapVariant(val);
  if (typeof inner === "string") return { signature: "s", value: inner };
  if (typeof inner === "boolean") return { signature: "b", value: inner };
  if (typeof inner === "number") {
    return Number.isInteger(inner)
      ? { signature: "i", value: inner }
      : { signature: "d", value: inner };
  }
  return null;
}

/**
 * Parses `org.gtk.Actions.DescribeAll()` return body (`a{s(bgav)}`).
 */
export function parseGtkActionsDescribeAll(
  rawBodyFirstArg: unknown
): Map<string, GtkActionDescriptor> {
  const out = new Map<string, GtkActionDescriptor>();
  if (!rawBodyFirstArg || typeof rawBodyFirstArg !== "object") return out;

  for (const [name, desc] of Object.entries(
    rawBodyFirstArg as Record<string, unknown>
  )) {
    if (!Array.isArray(desc) || desc.length < 3) continue;
    const enabled = Boolean(desc[0]);
    const paramType = typeof desc[1] === "string" ? desc[1] : "";
    const stateArr = Array.isArray(desc[2]) ? desc[2] : [];
    const state = stateArr.length > 0 ? unwrapVariant(stateArr[0]) : undefined;
    out.set(name, { enabled, paramType, state });
  }
  return out;
}

/**
 * Parses `org.gtk.Menus.Start()` return body (`a(uuaa{sv})`).
 */
export function parseGtkMenusStartResponse(
  rawBodyFirstArg: unknown
): GtkMenuRawGroup[] {
  if (!Array.isArray(rawBodyFirstArg)) return [];
  const groups: GtkMenuRawGroup[] = [];

  for (const entry of rawBodyFirstArg) {
    if (!Array.isArray(entry) || entry.length < 3) continue;
    const group = Number(entry[0]);
    const menu = Number(entry[1]);
    const rawItems = Array.isArray(entry[2]) ? entry[2] : [];
    if (!Number.isFinite(group) || !Number.isFinite(menu)) continue;

    const items: GtkMenuRawItem[] = [];
    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const dict = rawItem as Record<string, unknown>;
      const item: GtkMenuRawItem = {};
      if ("label" in dict) {
        const v = unwrapVariant(dict.label);
        if (typeof v === "string") item.label = v;
      }
      if ("action" in dict) {
        const v = unwrapVariant(dict.action);
        if (typeof v === "string") item.action = v;
      }
      if ("target" in dict) {
        item.target = dict.target;
      }
      if ("accel" in dict) {
        const v = unwrapVariant(dict.accel);
        if (typeof v === "string") item.accel = v;
      }
      if (":section" in dict) {
        const v = unwrapVariant(dict[":section"]);
        if (Array.isArray(v) && v.length >= 2) {
          item.section = [Number(v[0]), Number(v[1])];
        }
      }
      if (":submenu" in dict) {
        const v = unwrapVariant(dict[":submenu"]);
        if (Array.isArray(v) && v.length >= 2) {
          item.submenu = [Number(v[0]), Number(v[1])];
        }
      }
      items.push(item);
    }
    groups.push({ group, menu, items });
  }

  return groups;
}

/**
 * Resolves `org.gtk.Menus` group/menu trees into top-level Global Menu bar
 * sections (`sections`) or flat `appActions` items.
 */
export function buildSectionsFromGtkMenus(
  rawGroups: readonly GtkMenuRawGroup[],
  options: {
    actionsByFullName: Map<string, GtkActionDescriptor>;
    onActivate: (action: string, target?: unknown) => Promise<void> | void;
  }
): {
  sections: RemoteMenuSection[];
  appActions: RemoteMenuEntry[];
  referencedGroups: number[];
} {
  const map = new Map<string, GtkMenuRawItem[]>();
  const referencedGroups = new Set<number>();
  for (const g of rawGroups) {
    referencedGroups.add(g.group);
    map.set(`${g.group}:${g.menu}`, g.items);
  }

  let seq = 0;

  const resolveItems = (
    group: number,
    menu: number,
    visited: Set<string>
  ): RemoteMenuEntry[] => {
    const key = `${group}:${menu}`;
    if (visited.has(key)) return [];
    const nextVisited = new Set(visited);
    nextVisited.add(key);

    const items = map.get(key) ?? [];
    const result: RemoteMenuEntry[] = [];

    for (const raw of items) {
      if (raw.section) {
        const sectionItems = resolveItems(
          raw.section[0],
          raw.section[1],
          nextVisited
        );
        if (sectionItems.length > 0) {
          if (
            result.length > 0 &&
            result[result.length - 1]?.kind !== "separator"
          ) {
            result.push({ kind: "separator", id: `sep-${++seq}` });
          }
          result.push(...sectionItems);
        }
        continue;
      }

      if (raw.submenu) {
        const subItems = resolveItems(
          raw.submenu[0],
          raw.submenu[1],
          nextVisited
        );
        const label = stripGtkMnemonic(raw.label ?? "");
        if (!label) continue;
        result.push({
          kind: "item",
          id: `sub-${++seq}-${label}`,
          label,
          enabled: subItems.length > 0,
          submenu: subItems,
        });
        continue;
      }

      const label = stripGtkMnemonic(raw.label ?? "");
      if (!label) continue;
      const actionName = raw.action;
      const desc = actionName
        ? options.actionsByFullName.get(actionName)
        : undefined;
      const enabled = actionName ? (desc ? desc.enabled : true) : false;
      const checked =
        desc && typeof desc.state === "boolean" ? desc.state : undefined;

      result.push({
        kind: "item",
        id: `item-${++seq}-${actionName ?? label}`,
        label,
        enabled,
        shortcut: formatGtkAccel(raw.accel),
        checked,
        toggleKind: checked !== undefined ? "checkmark" : undefined,
        activate: actionName
          ? () => options.onActivate(actionName, raw.target)
          : undefined,
      });
    }

    while (result.length > 0 && result[result.length - 1]?.kind === "separator") {
      result.pop();
    }
    return result;
  };

  const rootItems = resolveItems(0, 0, new Set());
  const sections: RemoteMenuSection[] = [];
  const appActions: RemoteMenuEntry[] = [];

  for (const entry of rootItems) {
    if (entry.kind === "item" && entry.submenu && entry.submenu.length > 0) {
      sections.push({ title: entry.label, items: entry.submenu });
    } else {
      appActions.push(entry);
    }
  }

  return {
    sections,
    appActions,
    referencedGroups: Array.from(referencedGroups),
  };
}

export function formatActionTitle(actionName: string): string {
  const clean = actionName.replace(/^(app|win)\./, "");
  return clean
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const SKIPPED_GAPP_ACTIONS = new Set([
  "quit",
  "close",
  "close-window",
]);

function mapDbusMenuEntries(
  entries: readonly DbusMenuEntry[],
  watched: WatchedMenu | null
): RemoteMenuEntry[] {
  return entries.map((entry) => {
    if (entry.kind === MenuEntryKind.Separator) {
      return { kind: "separator", id: `dbus-sep-${entry.id}` };
    }
    return {
      kind: "item",
      id: `dbus-${entry.id}`,
      label: entry.label,
      enabled: entry.enabled,
      checked: entry.toggle?.checked,
      toggleKind:
        entry.toggle?.kind === ToggleKind.Radio
          ? "radio"
          : entry.toggle?.kind === ToggleKind.Checkmark
            ? "checkmark"
            : undefined,
      submenu:
        entry.submenu && entry.submenu.length > 0
          ? mapDbusMenuEntries(entry.submenu, watched)
          : undefined,
      activate: () => {
        void watched?.click(entry.id);
      },
    };
  });
}

async function dbusCall(
  piloti: Piloti,
  destination: string,
  path: string,
  iface: string,
  member: string,
  signature = "",
  body: unknown[] = []
): Promise<unknown[] | undefined> {
  try {
    const res = await piloti.dbus.call({
      bus: Bus.Session,
      destination,
      path,
      interface: iface,
      member,
      signature,
      body,
    });
    return res.match({
      Ok: (ok) => (Array.isArray(ok.body) ? ok.body : undefined),
      Err: () => undefined,
    });
  } catch {
    return undefined;
  }
}

async function resolveAppBusName(
  piloti: Piloti,
  desktopId?: string,
  pid?: number | null
): Promise<string | undefined> {
  const cleanDesktop = desktopId?.replace(/\.desktop$/i, "").trim();
  if (cleanDesktop && cleanDesktop.includes(".")) {
    const hasOwnerBody = await dbusCall(
      piloti,
      "org.freedesktop.DBus",
      "/org/freedesktop/DBus",
      "org.freedesktop.DBus",
      "NameHasOwner",
      "s",
      [cleanDesktop]
    );
    if (hasOwnerBody?.[0] === true) {
      return cleanDesktop;
    }
  }

  if (!pid) return undefined;
  const namesBody = await dbusCall(
    piloti,
    "org.freedesktop.DBus",
    "/org/freedesktop/DBus",
    "org.freedesktop.DBus",
    "ListNames"
  );
  const names = Array.isArray(namesBody?.[0])
    ? (namesBody[0] as unknown[]).filter((n): n is string => typeof n === "string")
    : [];

  const wellKnown = names.filter(
    (name) =>
      !name.startsWith(":") &&
      name !== "org.freedesktop.DBus" &&
      !name.startsWith("org.freedesktop.systemd") &&
      !name.startsWith("org.gtk.vfs")
  );

  for (const name of wellKnown) {
    const pidBody = await dbusCall(
      piloti,
      "org.freedesktop.DBus",
      "/org/freedesktop/DBus",
      "org.freedesktop.DBus",
      "GetConnectionUnixProcessID",
      "s",
      [name]
    );
    if (Number(pidBody?.[0]) === pid) {
      return name;
    }
  }

  return undefined;
}

async function introspectPath(
  piloti: Piloti,
  busName: string,
  path: string
): Promise<{ interfaces: string[]; childNodes: string[] } | undefined> {
  const body = await dbusCall(
    piloti,
    busName,
    path,
    "org.freedesktop.DBus.Introspectable",
    "Introspect"
  );
  const xml = body?.[0];
  if (typeof xml !== "string" || !xml) return undefined;
  return parseDbusIntrospectXml(xml);
}

/**
 * Discovers live XDG / GTK / Canonical DBusMenu global menus and actions for
 * the active Wayland window (falling back gracefully when an app exports none).
 */
export async function discoverRemoteGlobalMenu(
  piloti: Piloti,
  options: {
    desktopId?: string;
    pid?: number | null;
    desktopEntry?: XdgDesktopEntry;
    onDesktopAction?: (actionId: string) => void;
    onUpdate: (menu: RemoteGlobalMenu) => void;
  },
  isCancelled: () => boolean
): Promise<() => void> {
  let activeCleanup: (() => void) | undefined;

  const desktopFallbackActions: RemoteMenuEntry[] = (
    options.desktopEntry?.actions ?? []
  ).map((act) => ({
    kind: "item",
    id: `desktop-act:${act.id}`,
    label: act.name,
    enabled: true,
    activate: () => options.onDesktopAction?.(act.id),
  }));

  const emitDesktopFallbackOnly = () => {
    if (desktopFallbackActions.length > 0 && !isCancelled()) {
      options.onUpdate({
        source: "desktop-actions",
        sections: [],
        appActions: desktopFallbackActions,
        cleanup: () => {},
      });
    }
  };

  const busName = await resolveAppBusName(
    piloti,
    options.desktopId,
    options.pid
  );
  if (isCancelled()) return () => {};
  if (!busName) {
    emitDesktopFallbackOnly();
    return () => {};
  }

  const basePath = `/${busName.replace(/\./g, "/")}`;
  const candidatePaths = Array.from(
    new Set([basePath, "/org/freedesktop/Application"])
  );

  let appPath = basePath;
  let rootInfo: { interfaces: string[]; childNodes: string[] } | undefined;
  for (const path of candidatePaths) {
    const info = await introspectPath(piloti, busName, path);
    if (isCancelled()) return () => {};
    if (info) {
      appPath = path;
      rootInfo = info;
      break;
    }
  }

  // 1. Probe `com.canonical.dbusmenu` on standard paths (Electron/Qt/appmenu-gtk)
  for (const dbusMenuPath of ["/com/canonical/dbusmenu", "/MenuBar", "/MenuBar/1"]) {
    const dmInfo = await introspectPath(piloti, busName, dbusMenuPath);
    if (isCancelled()) return () => {};
    if (dmInfo?.interfaces.includes("com.canonical.dbusmenu")) {
      let watched: WatchedMenu | null = null;
      let latestEntries: readonly DbusMenuEntry[] = [];

      watched = watchMenu(piloti, { bus: busName, path: dbusMenuPath }, (res) => {
        if (isCancelled()) return;
        res.match({
          Ok: (entries) => {
            latestEntries = entries;
            const sections: RemoteMenuSection[] = [];
            const appActions: RemoteMenuEntry[] = [];
            for (const entry of entries) {
              if (
                entry.kind === MenuEntryKind.Item &&
                entry.submenu &&
                entry.submenu.length > 0
              ) {
                sections.push({
                  title: entry.label,
                  items: mapDbusMenuEntries(entry.submenu, watched),
                });
              } else {
                appActions.push(...mapDbusMenuEntries([entry], watched));
              }
            }
            if (sections.length === 0 && appActions.length === 0) return;
            options.onUpdate({
              source: "dbusmenu",
              busName,
              sections,
              appActions:
                appActions.length > 0 ? appActions : desktopFallbackActions,
              aboutToShowSection: (sectionIdx) => {
                let submenuIdx = 0;
                for (const entry of latestEntries) {
                  if (
                    entry.kind === MenuEntryKind.Item &&
                    entry.submenu &&
                    entry.submenu.length > 0
                  ) {
                    if (submenuIdx === sectionIdx) {
                      void watched?.aboutToShow(entry.id);
                      break;
                    }
                    submenuIdx += 1;
                  }
                }
              },
              cleanup: () => watched?.stop(),
            });
          },
          Err: () => {},
        });
      });

      activeCleanup = () => watched?.stop();
      return () => activeCleanup?.();
    }
  }

  // 2. Probe GTK `org.gtk.Menus` & `org.gtk.Actions`
  const actionsByFullName = new Map<string, GtkActionDescriptor>();
  const collectActions = async (path: string, prefix: "app" | "win") => {
    const body = await dbusCall(
      piloti,
      busName,
      path,
      "org.gtk.Actions",
      "DescribeAll"
    );
    const map = parseGtkActionsDescribeAll(body?.[0]);
    for (const [k, v] of map) {
      actionsByFullName.set(`${prefix}.${k}`, v);
    }
  };

  if (rootInfo?.interfaces.includes("org.gtk.Actions")) {
    await collectActions(appPath, "app");
  }

  let winPath: string | undefined;
  if (rootInfo?.childNodes.includes("window")) {
    const winListInfo = await introspectPath(
      piloti,
      busName,
      `${appPath}/window`
    );
    const firstWin = winListInfo?.childNodes[0];
    if (firstWin) {
      winPath = `${appPath}/window/${firstWin}`;
      const winInfo = await introspectPath(piloti, busName, winPath);
      if (winInfo?.interfaces.includes("org.gtk.Actions")) {
        await collectActions(winPath, "win");
      }
    }
  }

  if (isCancelled()) return () => {};

  const activateGtkAction = async (fullAction: string, target?: unknown) => {
    const isWin = fullAction.startsWith("win.");
    const shortName = fullAction.replace(/^(app|win)\./, "");
    const targetPath = isWin && winPath ? winPath : appPath;
    const encodedTarget =
      target !== undefined ? toVariantSignature(target) : null;
    await dbusCall(
      piloti,
      busName,
      targetPath,
      "org.gtk.Actions",
      "Activate",
      "sava{sv}",
      [shortName, encodedTarget ? [encodedTarget] : [], {}]
    );
  };

  const menuPathsToTry: string[] = [];
  if (rootInfo?.childNodes.includes("menus")) {
    menuPathsToTry.push(
      `${appPath}/menus/menubar`,
      `${appPath}/menus/appmenu`
    );
  }
  if (rootInfo?.interfaces.includes("org.gtk.Menus")) {
    menuPathsToTry.push(appPath);
  }
  if (winPath) {
    menuPathsToTry.push(winPath);
  }

  const endSubscriptions: Array<() => void> = [];
  const sections: RemoteMenuSection[] = [];
  const gtkAppMenuItems: RemoteMenuEntry[] = [];

  for (const menuPath of menuPathsToTry) {
    const menuInfo = await introspectPath(piloti, busName, menuPath);
    if (isCancelled()) return () => {};
    if (!menuInfo?.interfaces.includes("org.gtk.Menus")) continue;

    const allGroups: GtkMenuRawGroup[] = [];
    const seenGroups = new Set<number>();
    const queue = [0, 1, 2, 3, 4];

    while (queue.length > 0) {
      const batch = queue.filter((id) => !seenGroups.has(id));
      for (const id of batch) seenGroups.add(id);
      if (batch.length === 0) break;

      const startBody = await dbusCall(
        piloti,
        busName,
        menuPath,
        "org.gtk.Menus",
        "Start",
        "au",
        [batch]
      );
      if (isCancelled()) {
        void dbusCall(piloti, busName, menuPath, "org.gtk.Menus", "End", "au", [
          Array.from(seenGroups),
        ]);
        return () => {};
      }
      const parsed = parseGtkMenusStartResponse(startBody?.[0]);
      if (parsed.length === 0) break;
      allGroups.push(...parsed);

      for (const g of parsed) {
        for (const item of g.items) {
          if (item.section && !seenGroups.has(item.section[0])) {
            queue.push(item.section[0]);
          }
          if (item.submenu && !seenGroups.has(item.submenu[0])) {
            queue.push(item.submenu[0]);
          }
        }
      }
    }

    if (allGroups.length > 0) {
      const built = buildSectionsFromGtkMenus(allGroups, {
        actionsByFullName,
        onActivate: activateGtkAction,
      });
      if (menuPath.endsWith("/appmenu")) {
        for (const s of built.sections) {
          gtkAppMenuItems.push({
            kind: "item",
            id: `gtk-appmenu-${s.title}`,
            label: s.title,
            enabled: true,
            submenu: s.items,
          });
        }
        gtkAppMenuItems.push(...built.appActions);
      } else {
        sections.push(...built.sections);
        gtkAppMenuItems.push(...built.appActions);
      }

      const subGroupList = Array.from(seenGroups);
      endSubscriptions.push(() => {
        void dbusCall(piloti, busName, menuPath, "org.gtk.Menus", "End", "au", [
          subGroupList,
        ]);
      });
    }
  }

  activeCleanup = () => {
    for (const stop of endSubscriptions) stop();
  };

  if (sections.length > 0 || gtkAppMenuItems.length > 0) {
    options.onUpdate({
      source: "gtk-menus",
      busName,
      sections,
      appActions:
        gtkAppMenuItems.length > 0 ? gtkAppMenuItems : desktopFallbackActions,
      cleanup: activeCleanup,
    });
    return activeCleanup;
  }

  // 3. Fallback to `org.gtk.Actions` (`DescribeAll`) for GTK4/Libadwaita apps
  //    that expose GApplication actions without a legacy GtkApplication menubar
  if (actionsByFullName.size > 0) {
    const gappItems: RemoteMenuEntry[] = [];
    for (const [fullName, desc] of actionsByFullName) {
      const short = fullName.replace(/^(app|win)\./, "");
      if (
        !fullName.startsWith("app.") ||
        !desc.enabled ||
        desc.paramType !== "" ||
        SKIPPED_GAPP_ACTIONS.has(short)
      ) {
        continue;
      }
      gappItems.push({
        kind: "item",
        id: `gact:${fullName}`,
        label: formatActionTitle(short),
        enabled: desc.enabled,
        checked: typeof desc.state === "boolean" ? desc.state : undefined,
        toggleKind: typeof desc.state === "boolean" ? "checkmark" : undefined,
        activate: () => activateGtkAction(fullName),
      });
    }

    const seenLabels = new Set(gappItems.map((i) => (i.kind === "item" ? i.label.toLowerCase() : "")));
    const merged = [
      ...gappItems,
      ...desktopFallbackActions.filter(
        (d) => d.kind !== "item" || !seenLabels.has(d.label.toLowerCase())
      ),
    ];

    if (merged.length > 0 && !isCancelled()) {
      options.onUpdate({
        source: "gtk-actions",
        busName,
        sections: [],
        appActions: merged,
        cleanup: activeCleanup,
      });
      return activeCleanup;
    }
  }

  emitDesktopFallbackOnly();
  return activeCleanup;
}

