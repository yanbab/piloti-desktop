/**
 * The portal dialogs that can be asked for on demand, to review and test them:
 * faked in the demo, real requests through `xdg-desktop-portal` on Linux.
 */
export interface PortalTest {
  id: string;
  /** English; translate with `_()`. */
  label: string;
  /** The demo only: Linux asks for it with hardware or an agent. */
  demoOnly?: boolean;
}

export const PORTAL_TESTS: readonly PortalTest[] = [
  { id: "file-open", label: "Open File" },
  { id: "file-save", label: "Save File" },
  { id: "app-chooser", label: "Open With" },
  { id: "access", label: "Permission" },
  { id: "account", label: "Account" },
  { id: "screenshot", label: "Screenshot" },
  { id: "pick-color", label: "Pick Color" },
  { id: "screen-cast", label: "Screen Sharing" },
  { id: "remote-desktop", label: "Remote Control" },
  { id: "input-capture", label: "Input Capture" },
  { id: "global-shortcuts", label: "Global Shortcuts" },
  { id: "print", label: "Print" },
  { id: "wallpaper", label: "Wallpaper" },
  { id: "launcher", label: "Install Launcher" },
  { id: "usb", label: "USB Devices", demoOnly: true },
  { id: "agent", label: "Agent Access", demoOnly: true },
];
