import { desktop, type Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { DomicileHost, DomicileNotification } from "@domicile-desktop/sdk/domicile-host";
import { FakeDomicileHost } from "@domicile-desktop/sdk/fake-host";
import { VFS_HOME } from "@/core/state/vfs-home";
import { listDataDir, readShippedFile } from "./data-files";
import { installPortalSimulator } from "./portal-simulator";
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

type StaticDirEntry = { name: string; file_type: "file" | "directory" };

/** System files come from the shipped files, then from the real host if there is one. */
async function readStaticFileBytes(
  normalizedPath: string,
  hostFallbackFiles?: Domicile["files"],
): Promise<Uint8Array | null> {
  if (normalizedPath === "/home/user" || normalizedPath.startsWith("/home/user/")) {
    return null;
  }
  const shipped = await readShippedFile(normalizedPath);
  if (shipped !== undefined) return new TextEncoder().encode(shipped);
  // engine:web toggled inside Domicile Linux: the machine's own files.
  if (!hostFallbackFiles) return null;
  try {
    const res = await hostFallbackFiles.read(normalizedPath);
    const bytes = res.match({ Ok: (b) => b, Err: () => null });
    return bytes && bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

function isVfsPath(rawPath: string): boolean {
  if (!rawPath.startsWith("/")) return true;
  return (
    rawPath === VFS_HOME ||
    rawPath.startsWith(`${VFS_HOME}/`) ||
    rawPath === "/media/user" ||
    rawPath.startsWith("/media/user/")
  );
}

async function readStaticDirectory(
  dirPath: string,
): Promise<StaticDirEntry[] | null> {
  const normalized = dirPath.replace(/\/+$/, "") || "/";
  if (normalized === VFS_HOME || normalized.startsWith(`${VFS_HOME}/`)) {
    return null;
  }
  const entries = listDataDir(normalized);
  if (!entries) return null;
  const mapped: StaticDirEntry[] = entries
    // The home folder is the VFS's, not the pack's.
    .filter((e) => !(normalized === "/home" && e.name === "user") && !(normalized === "/" && e.name === "home"))
    .map((e) => ({ name: e.name, file_type: e.isDirectory ? "directory" : "file" }));
  if (normalized === "/" && !mapped.some((e) => e.name === "home")) {
    mapped.unshift({ name: "home", file_type: "directory" });
  }
  if (normalized === "/home" && !mapped.some((e) => e.name === "user")) {
    mapped.unshift({ name: "user", file_type: "directory" });
  }
  return mapped;
}

let spawnCounter = 1;

function encodeBytesBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function encodeUtf8Base64(text: string): string {
  return encodeBytesBase64(new TextEncoder().encode(text));
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
 * for developing and running Piloti inside any web browser (or toggling
 * to `engine:web` inside Domicile Linux for testing).
 */
/** Listener teardown of the previous browser Domicile (engine switches create a new one). */
let disposePreviousBrowserDomicile: (() => void) | null = null;

export function createBrowserDomicile(hostFallbackFiles?: Domicile["files"]): Domicile {
  disposePreviousBrowserDomicile?.();
  disposePreviousBrowserDomicile = null;
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
          refreshMhz: 60000,
          adaptiveSync: "unsupported",
          hdr: "unsupported",
          peakLuminance: 0,
          sdrWhite: 0,
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
    disposePreviousBrowserDomicile = () => window.removeEventListener("resize", updateDisplays);
  }

  const dispatchSystemLine = (payload: unknown) => {
    queueMicrotask(() => {
      fake.dispatch("system", { data: JSON.stringify(payload) });
    });
  };

  // Wrap fake.host so interactive calls update state and fire Domicile events
  const portalSimulator = installPortalSimulator(fake);

  const interactiveHost = new Proxy(fake.host, {
    get(target, prop, receiver) {
      if (prop === "answerPortalRequest") {
        return (id: number, answer: string) => {
          fake.calls.push(["answerPortalRequest", id, answer]);
          if (portalSimulator.owns(id)) portalSimulator.answer(id, answer);
        };
      }
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
              const rawPath = req.path;
              const vfsPath = normalizeVfsPath(rawPath);
              const vfsEntry = isVfsPath(rawPath) ? getVfsEntry(vfsPath) : undefined;
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
                return;
              }
              if (isVfsPath(rawPath)) {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "failed",
                    error: { kind: "not_found", message: "No such file" },
                  },
                });
                return;
              }
              const cleanStatic = rawPath.replace(/\/+$/, "") || "/";
              void (async () => {
                const dirHit = await readStaticDirectory(cleanStatic);
                if (dirHit) {
                  dispatchSystemLine({
                    id,
                    type: "system_reply",
                    reply: { kind: "stat", file_type: "directory", size: 0, modified_ms: 0 },
                  });
                  return;
                }
                const bytes = await readStaticFileBytes(cleanStatic, hostFallbackFiles);
                if (bytes !== null) {
                  dispatchSystemLine({
                    id,
                    type: "system_reply",
                    reply: { kind: "stat", file_type: "file", size: bytes.length, modified_ms: 0 },
                  });
                  return;
                }
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "failed",
                    error: { kind: "not_found", message: "No such file" },
                  },
                });
              })();
              return;
            }
            if (req.call === "read_dir" && req.path) {
              const rawPath = req.path;
              const vfsPath = normalizeVfsPath(rawPath);
              const vfsEntries = isVfsPath(rawPath) ? listVfsDir(vfsPath) : [];
              if (vfsEntries.length > 0) {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "entries",
                    entries: vfsEntries.map((item) => ({
                      name: item.name,
                      file_type: item.kind,
                    })),
                  },
                });
                return;
              }
              void readStaticDirectory(rawPath).then((staticEntries) => {
                if (staticEntries) {
                  dispatchSystemLine({
                    id,
                    type: "system_reply",
                    reply: { kind: "entries", entries: staticEntries },
                  });
                } else if (isVfsPath(rawPath) && getVfsEntry(vfsPath)?.kind === "directory") {
                  dispatchSystemLine({
                    id,
                    type: "system_reply",
                    reply: { kind: "entries", entries: [] },
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
              });
              return;
            }
            if (req.call === "read_file" && req.path) {
              const rawPath = req.path;
              const vfsPath = normalizeVfsPath(rawPath);
              const vfsEntry = isVfsPath(rawPath) ? getVfsEntry(vfsPath) : undefined;
              if (vfsEntry?.kind === "file") {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "read",
                    data: encodeUtf8Base64(vfsEntry.content ?? ""),
                  },
                });
                return;
              }
              if (isVfsPath(rawPath)) {
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "failed",
                    error: { kind: "not_found", message: "No such file" },
                  },
                });
                return;
              }
              const cleanStatic = rawPath.replace(/\/+$/, "") || "/";
              void readStaticFileBytes(cleanStatic, hostFallbackFiles).then((bytes) => {
                if (bytes !== null) {
                  dispatchSystemLine({
                    id,
                    type: "system_reply",
                    reply: {
                      kind: "read",
                      data: encodeBytesBase64(bytes),
                    },
                  });
                  return;
                }
                const fallbackVfs = getVfsEntry(vfsPath);
                if (fallbackVfs?.kind === "file") {
                  dispatchSystemLine({
                    id,
                    type: "system_reply",
                    reply: {
                      kind: "read",
                      data: encodeUtf8Base64(fallbackVfs.content ?? ""),
                    },
                  });
                  return;
                }
                dispatchSystemLine({
                  id,
                  type: "system_reply",
                  reply: {
                    kind: "failed",
                    error: { kind: "not_found", message: "No such file" },
                  },
                });
              });
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
              ? `${cmd === "nautilus" ? "Folders" : cmd === "gnome-control-center" ? "System Settings" : cmd} — GNOME (CSD / Libadwaita)`
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
