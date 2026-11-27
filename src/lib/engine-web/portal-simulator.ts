import { VFS_HOME } from "../engine/vfs-home";
import type { FakeDomicileHost } from "@domicile-desktop/sdk/fake-host";

/**
 * Fakes XDG portal requests in `engine:web`, so their dialogs can be opened and
 * styled in a browser. On Linux these come from apps through
 * xdg-desktop-portal instead.
 *
 * From the browser console:
 *   __PILOTI_PORTALS__.fileChooser()          // Open
 *   __PILOTI_PORTALS__.fileChooser("save")    // Save
 *   __PILOTI_PORTALS__.print()
 *   __PILOTI_PORTALS__.agent()                // an agent asks to be let in
 *   __PILOTI_PORTALS__.open("screen-cast")    // any PORTAL_TESTS id
 * Answers are logged to the console.
 */

type WireItem = {
  app_id: string;
  body: unknown;
  id: number;
  kind: string;
};

export type PortalSimulator = {
  fileChooser: (mode?: "open" | "save" | "save_files") => number;
  print: () => number;
  agent: () => number;
  /** The request of a `PORTAL_TESTS` id (`lib/portals/portal-tests.ts`). */
  open: (id: string) => number | null;
  /** Whether `id` is a request this simulator made (and so should answer). */
  owns: (id: number) => boolean;
  answer: (id: number, rawAnswer: string) => void;
};

declare global {
  interface Window {
    __PILOTI_PORTALS__?: PortalSimulator;
  }
}

const HOME = VFS_HOME;

/** A stand-in frame of the desk, for the screenshot and colour pickers. */
function frozenDesk() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
<rect width="1280" height="800" fill="#1c2a5e"/><rect x="140" y="120" width="520" height="360" rx="14" fill="#f6f5f4"/>
<rect x="720" y="260" width="420" height="300" rx="14" fill="#3584e4"/><circle cx="380" cy="640" r="90" fill="#ff7800"/></svg>`;
  return {
    desk: { position: [0, 0], size: [1280, 800] },
    frame: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    width: 1280,
    height: 800,
    monitors: [{ name: "DP-1", description: "Demo Display", area: { x: 0, y: 0, width: 1280, height: 800 } }],
    windows: [{ app_id: "org.gnome.TextEditor", id: "1", title: "notes.txt" }],
  };
}

const DEVICES = { keyboard: true, pointer: true, touchscreen: false };

/** Wire bodies of the requests that need no method of their own. */
const REQUESTS: Record<string, { kind: string; body: () => unknown }> = {
  access: {
    kind: "access",
    body: () => ({
      title: "Camera Access",
      subtitle: "Text Editor wants to use the camera",
      body: "This can be changed later in Settings.",
      destructive: false,
      grant_label: "Allow",
      deny_label: "Deny",
    }),
  },
  "app-chooser": {
    kind: "app_chooser",
    body: () => ({
      choices: ["org.gnome.TextEditor", "org.gnome.Epiphany", "org.gnome.Nautilus"],
      last_choice: "org.gnome.TextEditor",
      content_type: "text/plain",
      filename: "notes.txt",
    }),
  },
  account: {
    kind: "account",
    body: () => ({ name: "Piloti User", reason: "To sign your documents." }),
  },
  wallpaper: {
    kind: "wallpaper",
    body: () => ({ path: "/usr/share/backgrounds/piloti.jpg", set_on: "both" }),
  },
  launcher: {
    kind: "dynamic_launcher",
    body: () => ({
      editable_name: true,
      launcher_type: "webapp",
      name: "Piloti Test",
      target: "https://example.com",
    }),
  },
  usb: {
    kind: "usb",
    body: () => ({
      devices: [{ id: "1", vendor: "SanDisk", product: "Ultra Fit", writable: true }],
    }),
  },
  screenshot: { kind: "screenshot", body: frozenDesk },
  "pick-color": { kind: "pick_color", body: frozenDesk },
  "screen-cast": {
    kind: "screen_cast",
    body: () => ({
      browser_windows: true,
      multiple: true,
      region: true,
      desk: frozenDesk(),
      sources: [
        { type: "monitor", name: "DP-1", description: "Demo Display", size: [1280, 800] },
        { type: "window", id: "1", app_id: "org.gnome.TextEditor", title: "notes.txt" },
      ],
    }),
  },
  "remote-desktop": { kind: "remote_desktop", body: () => ({ clipboard: true, devices: DEVICES }) },
  "input-capture": { kind: "input_capture", body: () => ({ devices: DEVICES }) },
  "global-shortcuts": {
    kind: "global_shortcuts",
    body: () => ({
      shortcuts: [
        { id: "test", description: "Test shortcut", trigger: "CTRL+ALT+t" },
        { id: "mute", description: "Mute microphone" },
      ],
      taken: [],
    }),
  },
};

function printer(name: string, description?: string) {
  return {
    color_modes: [],
    copies_max: 99,
    description,
    initial: { copies: 1, pages: [] },
    media: [],
    name,
    orientations: [],
    page_ranges: true,
    qualities: [],
    sides: [],
  };
}

export function installPortalSimulator(fake: FakeDomicileHost): PortalSimulator {
  const pending = new Map<number, WireItem>();
  // High ids so they never collide with requests from a real compositor.
  let nextId = 900_000;

  const push = () => {
    fake.dispatch("portalrequests", {
      data: JSON.stringify({
        type: "portal_requests",
        items: [...pending.values()],
        capturing: [],
      }),
    });
  };

  const add = (kind: string, body: unknown, appId: string) => {
    const id = nextId++;
    pending.set(id, { app_id: appId, body, id, kind });
    push();
    return id;
  };

  const simulator: PortalSimulator = {
    open: (id) => {
      if (id === "file-open") return simulator.fileChooser("open");
      if (id === "file-save") return simulator.fileChooser("save");
      if (id === "print") return simulator.print();
      if (id === "agent") return simulator.agent();
      const request = REQUESTS[id];
      return request ? add(request.kind, request.body(), "org.gnome.TextEditor") : null;
    },
    fileChooser: (mode = "open") =>
      add(
        "file_chooser",
        {
          accept_label: undefined,
          choices: [
            {
              id: "encoding",
              initial: "utf8",
              label: "_Encoding",
              options: [
                { id: "utf8", label: "UTF-8" },
                { id: "latin1", label: "Western (ISO-8859-1)" },
                { id: "utf16", label: "UTF-16" },
              ],
            },
            { id: "readonly", initial: "false", label: "Open _read-only", options: [] },
          ],
          current_folder: `${HOME}/Documents`,
          current_name: mode === "save" ? "Untitled Document.txt" : undefined,
          directory: false,
          files: [],
          filters: [
            { name: "All Files", extensions: ["*"] },
            { name: "Text Files", extensions: ["txt", "md"] },
            { name: "Images", extensions: ["png", "jpg", "svg"] },
          ],
          home: HOME,
          mode,
          multiple: mode === "open",
          title: mode === "open" ? "Open File" : "Save File",
        },
        "org.gnome.TextEditor"
      ),
    print: () =>
      add(
        "print",
        {
          home: HOME,
          pdf: printer("Print to File"),
          printers: [
            printer("Office LaserJet", "HP LaserJet Pro M404"),
            printer("Photo Printer", "Epson EcoTank ET-8550"),
          ],
          title: "Print Document",
        },
        "org.gnome.TextEditor"
      ),
    agent: () =>
      add(
        "agent",
        {
          agent: "Claude",
          current: undefined,
          remembered: false,
          windows: [{ app: "org.gnome.TextEditor", id: "1", kind: "native", title: "notes.txt" }],
        },
        ""
      ),
    owns: (id) => pending.has(id),
    answer: (id, rawAnswer) => {
      let parsed: unknown = rawAnswer;
      try {
        parsed = JSON.parse(rawAnswer);
      } catch {
        /* keep raw */
      }
      console.info("[Piloti] portal simulator: answer", id, parsed);
      pending.delete(id);
      push();
    },
  };

  window.__PILOTI_PORTALS__ = simulator;
  return simulator;
}
