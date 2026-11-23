import { VFS_HOME } from "../engine/vfs-home";
import type { FakeDomicileHost } from "@domicile-desktop/sdk/fake-host";

/**
 * Fakes XDG portal requests (File Chooser, Print) in `engine:web`, so their
 * dialogs can be opened and styled in a browser. On Linux these come from
 * apps through xdg-desktop-portal instead.
 *
 * From the browser console:
 *   __PILOTI_PORTALS__.fileChooser()          // Open
 *   __PILOTI_PORTALS__.fileChooser("save")    // Save
 *   __PILOTI_PORTALS__.print()
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
