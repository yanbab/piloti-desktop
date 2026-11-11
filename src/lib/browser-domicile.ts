import { desktop, type Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { DomicileHost, DomicileNotification } from "@domicile-desktop/sdk/domicile-host";
import { FakeDomicileHost } from "@domicile-desktop/sdk/fake-host";

declare global {
  interface Window {
    __PILOTI_BROWSER_HOST__?: FakeDomicileHost;
  }
}

const INITIAL_NOTIFICATIONS: DomicileNotification[] = [
  {
    id: 101,
    appName: "Domicile Compositor",
    summary: "Piloti Shell Ready",
    body: "Press Alt+Space to open the Command Palette or Alt+Tab to switch windows.",
    icon: "",
    urgency: "normal",
    actions: [{ key: "settings", label: "Open Settings" }],
    clickable: true,
    timeoutMs: 0,
    time: Date.now() - 1000 * 60 * 4,
    browserWindow: "",
  },
  {
    id: 102,
    appName: "Theme Engine",
    summary: "Cupertino & GNOME Adwaita Themes Ready",
    body: "Switch between Cupertino (macOS 27) and GNOME Adwaita themes in System Settings → Appearance.",
    icon: "",
    urgency: "low",
    actions: [],
    clickable: true,
    timeoutMs: 0,
    time: Date.now() - 1000 * 60 * 18,
    browserWindow: "",
  },
  {
    id: 103,
    appName: "VMware / Debian Bridge",
    summary: "XDG Desktop Applications Indexed",
    body: "Installed .desktop applications loaded via the xdg-desktop specification module.",
    icon: "",
    urgency: "normal",
    actions: [],
    clickable: true,
    timeoutMs: 0,
    time: Date.now() - 1000 * 60 * 42,
    browserWindow: "",
  },
];

/**
 * Virtual `/usr/share/applications/*.desktop` files served by `FakeDomicileHost`
 * in Browser Dev Mode so the XDG Desktop Entry Specification parser (`xdg-desktop`)
 * runs the exact same `domicile.files.readDir` + `domicile.files.readText` pipeline
 * in the browser as on Debian Linux.
 */
const VIRTUAL_XDG_DESKTOP_FILES: Record<string, string> = {
  "/usr/share/applications/org.gnome.Nautilus.desktop": `[Desktop Entry]
Name=Files (Nautilus)
GenericName=File Manager
Comment=Access and organize files in GNOME Adwaita
Exec=nautilus --new-window %U
Icon=org.gnome.Nautilus
Terminal=false
Type=Application
StartupNotify=true
Categories=GNOME;GTK;Utility;Core;FileManager;
Keywords=folder;manager;explore;disk;filesystem;nautilus;
X-GNOME-UsesNotifications=true
Actions=new-window;

[Desktop Action new-window]
Name=New Window
Exec=nautilus --new-window
`,
  "/usr/share/applications/org.gnome.Console.desktop": `[Desktop Entry]
Name=Console (KGX)
GenericName=Terminal Emulator
Comment=Command line terminal for GNOME
Exec=kgx
Icon=org.gnome.Console
Terminal=false
Type=Application
Categories=GNOME;GTK;System;TerminalEmulator;
Keywords=shell;prompt;command;commandline;cmd;
`,
  "/usr/share/applications/org.gnome.TextEditor.desktop": `[Desktop Entry]
Name=Text Editor
GenericName=Text Editor
Comment=Edit text files with GNOME Libadwaita
Exec=gnome-text-editor %U
Icon=org.gnome.TextEditor
Terminal=false
Type=Application
Categories=GNOME;GTK;Utility;TextEditor;
Keywords=write;notepad;plain;code;
`,
  "/usr/share/applications/org.gnome.Calculator.desktop": `[Desktop Entry]
Name=Calculator
GenericName=Calculator
Comment=Perform arithmetic, scientific or financial calculations
Exec=gnome-calculator
Icon=org.gnome.Calculator
Terminal=false
Type=Application
Categories=GNOME;GTK;Utility;Calculator;
Keywords=calculation;arithmetic;math;scientific;
`,
  "/usr/share/applications/org.gnome.Loupe.desktop": `[Desktop Entry]
Name=Image Viewer (Loupe)
GenericName=Image Viewer
Comment=View images and photos in GNOME
Exec=loupe %U
Icon=org.gnome.Loupe
Terminal=false
Type=Application
Categories=GNOME;GTK;Graphics;Viewer;
Keywords=picture;photos;graphics;loupe;
`,
  "/usr/share/applications/org.gnome.Evince.desktop": `[Desktop Entry]
Name=Document Viewer (Evince)
GenericName=Document Viewer
Comment=View multi-page PDF and PostScript documents
Exec=evince %U
Icon=org.gnome.Evince
Terminal=false
Type=Application
Categories=GNOME;GTK;Office;Viewer;
Keywords=pdf;ps;djvu;document;viewer;
`,
  "/usr/share/applications/org.gnome.baobab.desktop": `[Desktop Entry]
Name=Disk Usage Analyzer
GenericName=Storage Analyzer
Comment=Check folder sizes and available disk space
Exec=baobab %U
Icon=org.gnome.baobab
Terminal=false
Type=Application
Categories=GNOME;GTK;System;Filesystem;
Keywords=storage;disk;capacity;space;baobab;
`,
  "/usr/share/applications/org.gnome.SystemMonitor.desktop": `[Desktop Entry]
Name=GNOME System Monitor
GenericName=System Monitor
Comment=View current processes and monitor system state
Exec=gnome-system-monitor
Icon=org.gnome.SystemMonitor
Terminal=false
Type=Application
Categories=GNOME;GTK;System;Monitor;
Keywords=monitor;system;process;cpu;memory;network;task;
`,
  "/usr/share/applications/kitty.desktop": `[Desktop Entry]
Version=1.0
Type=Application
Name=Kitty Terminal
GenericName=GPU Terminal Emulator
Comment=Fast, feature-rich, GPU based terminal
Exec=kitty
Icon=kitty
Categories=System;TerminalEmulator;
Keywords=terminal;shell;zsh;bash;
`,
  "/usr/share/applications/firefox-esr.desktop": `[Desktop Entry]
Version=1.0
Name=Firefox ESR
GenericName=Web Browser
Comment=Browse the World Wide Web
Exec=firefox %u
Icon=firefox-esr
Terminal=false
Type=Application
Categories=Network;WebBrowser;
Keywords=internet;www;browser;web;explorer;
`,
  "/usr/share/applications/code.desktop": `[Desktop Entry]
Name=Visual Studio Code
GenericName=Code Editor
Comment=Code Editing. Redefined.
Exec=code %F
Icon=vscode
Type=Application
Categories=Development;IDE;TextEditor;
Keywords=vscode;editor;typescript;programming;
`,
  "/usr/share/applications/gimp.desktop": `[Desktop Entry]
Version=1.0
Type=Application
Name=GNU Image Manipulation Program
GenericName=Image Editor
Comment=Create images and edit photographs
Exec=gimp-2.10 %U
Icon=gimp
Terminal=false
Categories=Graphics;2DGraphics;RasterGraphics;GTK;
Keywords=GIMP;photoshop;image;graphic;
`,
};

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
Directories=scalable/apps,scalable/places

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
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Nautilus.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="naut-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#62a0ea"/>
      <stop offset="100%" stop-color="#1a5fb4"/>
    </linearGradient>
    <linearGradient id="naut-front" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#99c1f1"/>
      <stop offset="100%" stop-color="#3584e4"/>
    </linearGradient>
  </defs>
  <rect x="12" y="18" width="104" height="94" rx="20" fill="#1a5fb4"/>
  <path d="M12 34C12 24.06 20.06 16 30 16H52L62 28H98C107.94 28 116 36.06 116 46V94C116 103.94 107.94 112 98 112H30C20.06 112 12 103.94 12 94V34Z" fill="url(#naut-bg)"/>
  <rect x="20" y="34" width="88" height="46" rx="10" fill="#ffffff" fill-opacity="0.9"/>
  <rect x="12" y="44" width="104" height="66" rx="18" fill="url(#naut-front)"/>
  <rect x="48" y="68" width="32" height="8" rx="4" fill="#ffffff" fill-opacity="0.92"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Console.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="12" y="16" width="104" height="96" rx="20" fill="#1e1e24"/>
  <rect x="16" y="20" width="96" height="84" rx="16" fill="#282830" stroke="#3d3846" stroke-width="2"/>
  <path d="M34 46L52 60L34 74" fill="none" stroke="#62a0ea" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="60" y1="74" x2="84" y2="74" stroke="#8ff0a4" stroke-width="8" stroke-linecap="round"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.TextEditor.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="20" y="12" width="88" height="104" rx="16" fill="#f6f5f4" stroke="#deddda" stroke-width="2"/>
  <line x1="36" y1="38" x2="92" y2="38" stroke="#9a9996" stroke-width="6" stroke-linecap="round"/>
  <line x1="36" y1="56" x2="92" y2="56" stroke="#9a9996" stroke-width="6" stroke-linecap="round"/>
  <line x1="36" y1="74" x2="76" y2="74" stroke="#9a9996" stroke-width="6" stroke-linecap="round"/>
  <line x1="36" y1="92" x2="64" y2="92" stroke="#3584e4" stroke-width="6" stroke-linecap="round"/>
  <path d="M74 88L102 60L114 72L86 100L70 104L74 88Z" fill="#ff7800"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Calculator.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="18" y="12" width="92" height="104" rx="18" fill="#3d3846"/>
  <rect x="28" y="22" width="72" height="26" rx="8" fill="#1e1e24"/>
  <circle cx="38" cy="64" r="8" fill="#77767b"/>
  <circle cx="64" cy="64" r="8" fill="#77767b"/>
  <circle cx="90" cy="64" r="8" fill="#77767b"/>
  <circle cx="38" cy="86" r="8" fill="#77767b"/>
  <circle cx="64" cy="86" r="8" fill="#77767b"/>
  <rect x="82" y="78" width="16" height="28" rx="8" fill="#ff7800"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Loupe.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="loupe-sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f66151"/>
      <stop offset="50%" stop-color="#c061cb"/>
      <stop offset="100%" stop-color="#3584e4"/>
    </linearGradient>
  </defs>
  <rect x="14" y="18" width="100" height="92" rx="18" fill="url(#loupe-sky)"/>
  <circle cx="42" cy="44" r="11" fill="#f9f06b"/>
  <path d="M18 96L48 64L72 86L90 68L110 96C110 103 104 108 96 108H32C24 108 18 103 18 96Z" fill="#1e1e24" fill-opacity="0.72"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Evince.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="22" y="12" width="84" height="104" rx="14" fill="#f6f5f4" stroke="#deddda" stroke-width="2"/>
  <rect x="22" y="12" width="22" height="104" rx="8" fill="#e01b24"/>
  <path d="M56 54C66 36 86 36 92 54C76 62 62 78 56 92C52 76 52 62 56 54Z" fill="none" stroke="#e01b24" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.baobab.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="50" fill="#2ec27e"/>
  <path d="M64 64L64 14A50 50 0 0 1 114 64Z" fill="#3584e4"/>
  <path d="M64 64L114 64A50 50 0 0 1 40 108Z" fill="#ff7800"/>
  <circle cx="64" cy="64" r="20" fill="#241f31"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.SystemMonitor.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="12" y="18" width="104" height="92" rx="20" fill="#1e1e24" stroke="#3d3846" stroke-width="3"/>
  <path d="M22 68H44L54 40L68 90L80 56L90 68H106" fill="none" stroke="#57e389" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Settings.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="14" y="14" width="100" height="100" rx="24" fill="#5e5c64"/>
  <circle cx="64" cy="64" r="30" fill="none" stroke="#f6f5f4" stroke-width="12" stroke-dasharray="16 8"/>
  <circle cx="64" cy="64" r="14" fill="#241f31" stroke="#f6f5f4" stroke-width="6"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Epiphany.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="web-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#62a0ea"/>
      <stop offset="100%" stop-color="#1c71d8"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="50" fill="url(#web-g)"/>
  <ellipse cx="64" cy="64" rx="24" ry="48" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="5"/>
  <line x1="16" y1="64" x2="112" y2="64" stroke="#ffffff" stroke-opacity="0.75" stroke-width="5"/>
  <line x1="24" y1="42" x2="104" y2="42" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4"/>
  <line x1="24" y1="86" x2="104" y2="86" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4"/>
</svg>`,
  "/usr/share/icons/Adwaita/scalable/apps/org.gnome.Adwaita1.Demo.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="14" y="14" width="100" height="100" rx="24" fill="#3584e4"/>
  <path d="M64 28L96 88H32L64 28Z" fill="#ffffff" fill-opacity="0.92"/>
  <circle cx="64" cy="72" r="12" fill="#2190a4"/>
</svg>`,
  "/usr/share/icons/hicolor/scalable/apps/kitty.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="14" y="16" width="100" height="96" rx="22" fill="#1f1f28" stroke="#7e9cd8" stroke-width="3"/>
  <path d="M32 48L50 62L32 76" fill="none" stroke="#ffa066" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="58" y="68" width="28" height="8" rx="4" fill="#98bb6c"/>
</svg>`,
  "/usr/share/icons/hicolor/scalable/apps/firefox-esr.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="50" fill="#4a2080"/>
  <path d="M64 14C91.6 14 114 36.4 114 64C114 91.6 91.6 114 64 114C36.4 114 14 91.6 14 64C14 42 28 24 48 17C38 30 42 52 60 56C78 60 88 46 84 32C98 40 104 58 96 76C88 94 64 100 46 88" fill="#ff7800"/>
  <circle cx="64" cy="66" r="22" fill="#f9f06b" fill-opacity="0.85"/>
</svg>`,
  "/usr/share/icons/hicolor/scalable/apps/vscode.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="14" y="14" width="100" height="100" rx="22" fill="#1e1e24"/>
  <path d="M84 26L40 68L26 56L18 64L40 84L84 42V86L48 64L40 72L84 102L104 92V36L84 26Z" fill="#3584e4"/>
</svg>`,
  "/usr/share/icons/hicolor/scalable/apps/gimp.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="14" y="14" width="100" height="100" rx="24" fill="#63452c"/>
  <ellipse cx="64" cy="66" rx="34" ry="26" fill="#cdab8f"/>
  <circle cx="50" cy="58" r="8" fill="#ffffff"/>
  <circle cx="74" cy="58" r="8" fill="#ffffff"/>
  <circle cx="52" cy="58" r="4" fill="#1e1e24"/>
  <circle cx="72" cy="58" r="4" fill="#1e1e24"/>
  <circle cx="34" cy="72" r="9" fill="#1e1e24"/>
</svg>`,
};

const ALL_VIRTUAL_FILES: Record<string, string> = {
  ...VIRTUAL_XDG_DESKTOP_FILES,
  ...VIRTUAL_XDG_ICON_FILES,
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

/**
 * Creates an interactive Domicile instance backed by FakeDomicileHost
 * for developing and running Piloti inside any web browser on macOS/Linux.
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
    tray: [
      {
        id: "org.piloti.Daemon:/StatusNotifierItem",
        title: "Piloti Wayland Bridge (Active)",
        icon: "",
        bus: ":1.42",
        menu: "",
        itemIsMenu: false,
      },
    ],
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
            };
            if (req.call === "read_dir" && req.path) {
              const entries = readVirtualDirectory(req.path);
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
              const content = ALL_VIRTUAL_FILES[req.path];
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
              ? `${cmd === "nautilus" ? "Files" : cmd === "gnome-control-center" ? "GNOME Settings" : cmd} — GNOME (CSD / Libadwaita)`
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
