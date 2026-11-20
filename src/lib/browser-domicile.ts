import { desktop, type Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { DomicileHost, DomicileNotification } from "@domicile-desktop/sdk/domicile-host";
import { FakeDomicileHost } from "@domicile-desktop/sdk/fake-host";
import { ADWAITA_VIRTUAL_ICONS } from "./adwaita-virtual-icons";
import {
  ensureVfsDir,
  getVfsEntry,
  listVfsDir,
  normalizeVfsPath,
  writeVfsTextFile,
} from "./web-vfs";

declare global {
  interface Window {
    __PILOTI_BROWSER_HOST__?: FakeDomicileHost;
  }
}

const INITIAL_NOTIFICATIONS: DomicileNotification[] = [];

/**
 * Virtual `/usr/share/applications/*.desktop` files served by `FakeDomicileHost`
 * in Browser Dev Mode so the XDG Desktop Entry Specification parser (`xdg-desktop`)
 * runs the exact same `domicile.files.readDir` + `domicile.files.readText` pipeline
 * in the browser as on Debian Linux.
 */
const VIRTUAL_XDG_DESKTOP_FILES: Record<string, string> = {};

/**
 * Virtual `/usr/share/icons/{Adwaita,hicolor}` files served by `FakeDomicileHost`
 * so the XDG Icon Theme Specification (`xdg-desktop`) resolves and renders real
 * GNOME Adwaita / Freedesktop SVG application icons in Browser Dev Mode too.
 */
const VIRTUAL_XDG_ICON_FILES: Record<string, string> = {
  "/usr/share/icons/Adwaita/index.theme": `[Icon Theme]
Name=Adwaita
Comment=GNOME Adwaita Icon Theme
Inherits=hicolor
Directories=scalable/apps,scalable/places,scalable/status,scalable/mimetypes,symbolic/actions

[scalable/apps]
Context=Applications
Size=128
MinSize=8
MaxSize=512
Type=Scalable

[scalable/places]
Context=Places
Size=128
MinSize=8
MaxSize=512
Type=Scalable

[scalable/status]
Context=Status
Size=128
MinSize=8
MaxSize=512
Type=Scalable

[scalable/mimetypes]
Context=MimeTypes
Size=128
MinSize=8
MaxSize=512
Type=Scalable

[symbolic/actions]
Context=Actions
Size=16
MinSize=8
MaxSize=512
Type=Scalable
`,
  "/usr/share/icons/hicolor/index.theme": `[Icon Theme]
Name=Hicolor
Comment=Fallback Icon Theme
Directories=scalable/apps

[scalable/apps]
Context=Applications
Size=128
MinSize=8
MaxSize=512
Type=Scalable
`,
  ...ADWAITA_VIRTUAL_ICONS,
};

const VIRTUAL_XDG_CONFIG_FILES: Record<string, string> = {
  ".config/user-dirs.dirs": `# Written by xdg-user-dirs-update
XDG_DESKTOP_DIR="$HOME/Desktop"
XDG_DOCUMENTS_DIR="$HOME/Documents"
XDG_DOWNLOAD_DIR="$HOME/Downloads"
XDG_MUSIC_DIR="$HOME/Music"
XDG_PICTURES_DIR="$HOME/Pictures"
XDG_VIDEOS_DIR="$HOME/Videos"
XDG_PUBLICSHARE_DIR="$HOME/Public"
XDG_TEMPLATES_DIR="$HOME/Templates"
`,
};

const VIRTUAL_DESKTOP_FOLDER_FILES: Record<string, string> = {
  "Desktop/Welcome.md": `# Piloti Desktop\n\nWelcome to Piloti! Drag icons anywhere on the grid, navigate with Arrow keys, and press Enter to open.\n`,
  "Desktop/Projects/roadmap.md": `# Roadmap\n\n- Wayland shell\n- Desktop icons\n`,
  "Desktop/Screenshots/aurora.txt": `Screenshot placeholder\n`,
  "Desktop/Files.desktop": `[Desktop Entry]
Name=Files
Comment=Browse local folders
Exec=nautilus
Icon=org.gnome.Nautilus
Type=Application
`,
};

const ALL_VIRTUAL_FILES: Record<string, string> = {
  ...VIRTUAL_XDG_DESKTOP_FILES,
  ...VIRTUAL_XDG_ICON_FILES,
  ...VIRTUAL_XDG_CONFIG_FILES,
  ...VIRTUAL_DESKTOP_FOLDER_FILES,
};

function readVirtualDirectory(
  dirPath: string
): { name: string; file_type: "file" | "directory" }[] | null {
  const normalized = dirPath.replace(/\/+$/, "");
  const prefix = `${normalized}/`;
  const entries = new Map<string, "file" | "directory">();

  for (const fullPath of Object.keys(ALL_VIRTUAL_FILES)) {
    if (!fullPath.startsWith(prefix)) continue;
    const rest = fullPath.slice(prefix.length);
    if (!rest) continue;
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) {
      entries.set(rest, "file");
    } else {
      const childDir = rest.slice(0, slashIdx);
      entries.set(childDir, "directory");
    }
  }

  if (entries.size === 0) return null;
  return Array.from(entries.entries()).map(([name, file_type]) => ({
    name,
    file_type,
  }));
}

let spawnCounter = 1;

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function decodeUtf8Base64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Creates an interactive Domicile instance backed by FakeDomicileHost
 * for developing and running Piloti inside any web browser.
 */
export function createBrowserDomicile(): Domicile {
  const fake = new FakeDomicileHost();
  window.__PILOTI_BROWSER_HOST__ = fake;

  const updateDisplays = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1440;
    const h = typeof window !== "undefined" ? window.innerHeight : 900;
    fake.set({
      displays: [
        {
          name: "Built-in Liquid Retina XDR",
          x: 0,
          y: 0,
          width: w,
          height: h,
          scale: typeof window !== "undefined" ? Math.round(window.devicePixelRatio || 2) : 2,
          modeWidth: w * 2,
          modeHeight: h * 2,
          transform: "normal",
        },
      ],
    });
  };

  fake.set({
    theme: "dark",
    windowsTheme: "dark",
    accentColor: "#3584e4",
    highContrast: false,
    reducedMotion: false,
    idle: false,
    locked: false,
    notifications: INITIAL_NOTIFICATIONS,
    tray: [],
  });
  updateDisplays();

  if (typeof window !== "undefined") {
    window.addEventListener("resize", updateDisplays);
  }

  const dispatchSystemLine = (payload: unknown) => {
    queueMicrotask(() => {
      fake.dispatch("system", { data: JSON.stringify(payload) });
    });
  };

  // Wrap fake.host so interactive calls update state and fire Domicile events
  const interactiveHost = new Proxy(fake.host, {
    get(target, prop, receiver) {
      if (prop === "focusApp") {
        return (appId: string) => {
          fake.calls.push(["focusApp", appId]);
          fake.set({ focusedWindow: appId });
        };
      }
      if (prop === "focusChrome") {
        return () => {
          fake.calls.push(["focusChrome"]);
          fake.set({ focusedWindow: null });
        };
      }
      if (prop === "closeApp") {
        return (appId: string) => {
          fake.calls.push(["closeApp", appId]);
          fake.close(appId);
        };
      }
      if (prop === "setTheme") {
        return (theme: "dark" | "light") => {
          fake.calls.push(["setTheme", theme]);
          fake.set({ theme, windowsTheme: theme });
        };
      }
      if (prop === "dismissNotifications") {
        return (ids: readonly number[]) => {
          fake.calls.push(["dismissNotifications", ids]);
          const idSet = new Set(ids);
          const current = fake.host.notifications ?? [];
          fake.set({
            notifications: current.filter((n) => !idSet.has(n.id)),
          });
        };
      }
      if (prop === "callSystem") {
        return (id: number, rawRequest: string) => {
          fake.calls.push(["callSystem", id, rawRequest]);
          try {
            const req = JSON.parse(rawRequest) as {
              call: string;
              path?: string;
              data?: string;
            };
            if (req.call === "create_dir" && req.path) {
              const vfsPath = normalizeVfsPath(req.path);
              ensureVfsDir(vfsPath);
              dispatchSystemLine({
                id,
                type: "system_reply",
                reply: { kind: "created" },
              });
              return;
            }
            if (req.call === "write_file" && req.path && typeof req.data === "string") {
              const vfsPath = normalizeVfsPath(req.path);
              writeVfsTextFile(vfsPath, decodeUtf8Base64(req.data));
              dispatchSystemLine({
                id,
                type: "system_reply",
                reply: { kind: "written" },
              });
              return;
            }
            if (req.call === "stat" && req.path) {
              const vfsPath = normalizeVfsPath(req.path);
              const vfsEntry = vfsPath.startsWith("/home/user")
                ? getVfsEntry(vfsPath)
                : undefined;
              const virtualContent = ALL_VIRTUAL_FILES[req.path];
              if (vfsEntry) {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "stat",
                    file_type: vfsEntry.kind === "directory" ? "directory" : "file",
                    size: vfsEntry.content?.length ?? 0,
                    modified_ms: vfsEntry.updatedAt,
                  },
                });
              } else if (virtualContent !== undefined) {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "stat",
                    file_type: "file",
                    size: virtualContent.length,
                  },
                });
              } else {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "failed",
                    error: { kind: "not_found", message: "No such file" },
                  },
                });
              }
              return;
            }
            if (req.call === "read_dir" && req.path) {
              const vfsPath = normalizeVfsPath(req.path);
              const vfsEntries =
                vfsPath.startsWith("/home/user") ? listVfsDir(vfsPath) : [];
              const virtualEntries = readVirtualDirectory(req.path);
              const entries =
                vfsEntries.length > 0
                  ? vfsEntries.map((item) => ({
                      name: item.name,
                      file_type: item.kind,
                    }))
                  : virtualEntries;
              if (entries) {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: { kind: "entries", entries },
                });
              } else {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "failed",
                    error: { kind: "not_found", message: "No such directory" },
                  },
                });
              }
              return;
            }
            if (req.call === "read_file" && req.path) {
              const vfsPath = normalizeVfsPath(req.path);
              const vfsEntry = vfsPath.startsWith("/home/user")
                ? getVfsEntry(vfsPath)
                : undefined;
              const content =
                vfsEntry?.kind === "file"
                  ? (vfsEntry.content ?? "")
                  : ALL_VIRTUAL_FILES[req.path];
              if (content !== undefined) {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "read",
                    data: encodeUtf8Base64(content),
                  },
                });
              } else {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "failed",
                    error: { kind: "not_found", message: "No such file" },
                  },
                });
              }
              return;
            }
            if (
              req.call === "set_window_states" ||
              req.call === "set_color_temperature"
            ) {
              dispatchSystemLine({
                id,
                type: "system_reply",
                reply: { kind: "set" },
              });
              return;
            }
            if (req.call === "dbus_call") {
              dispatchSystemLine({
                id,
                type: "system_reply",
                reply: {
                  kind: "returned",
                  signature: "(a{sa{sv}})",
                  body: JSON.stringify([
                    {
                      "org.gnome.desktop.interface": {
                        "icon-theme": { value: "Adwaita" },
                      },
                    },
                  ]),
                },
              });
              return;
            }
            if (
              req.call === "window_requests" ||
              req.call === "watch" ||
              req.call === "dbus_match"
            ) {
              dispatchSystemLine({
                id,
                type: "system_reply",
                reply: { kind: "started" },
              });
              return;
            }
          } catch {
            // ignore parse errors
          }
        };
      }
      if (prop === "spawn") {
        return (command: readonly string[]) => {
          fake.calls.push(["spawn", command]);
          let idx = 0;
          if (command[0] === "env" || command[0] === "/usr/bin/env") {
            idx = 1;
            while (idx < command.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(command[idx])) {
              idx++;
            }
          }
          const effectiveArgs = command.slice(idx);
          const cmd = effectiveArgs[0] ?? command[0] ?? "app";
          if (cmd === "piloti-webapp" && effectiveArgs[1]) {
            fake.openBrowser(effectiveArgs[1], {
              isApp: true,
              appId: effectiveArgs[1],
            });
            return;
          }
          const lowerCmd = cmd.toLowerCase();
          const isGnomeCsd =
            lowerCmd.includes("nautilus") ||
            lowerCmd.includes("gnome") ||
            lowerCmd.includes("kgx") ||
            lowerCmd.includes("loupe") ||
            lowerCmd.includes("evince") ||
            lowerCmd.includes("gedit") ||
            lowerCmd.includes("baobab") ||
            lowerCmd.includes("adw") ||
            lowerCmd.includes("gtk");
          const id = `wayland-${cmd}-${spawnCounter++}`;
          fake.appear(id, {
            title: isGnomeCsd
              ? `${cmd === "nautilus" ? "Files" : cmd === "gnome-control-center" ? "System Settings" : cmd} — GNOME (CSD / Libadwaita)`
              : `${cmd} — Wayland Client (${effectiveArgs.join(" ")})`,
            desktopId: cmd,
            width: 760,
            height: 490,
            clientFrame: isGnomeCsd,
          });
          fake.set({ focusedWindow: id });
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as DomicileHost;

  return desktop(interactiveHost);
}
