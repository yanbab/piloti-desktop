/**
 * The demo's simulated USB pen drive. Its files are in the browser VFS
 * (`engine-web/usb-drive.ts`, set by the demo); without it, as on Linux, no
 * drive is ever mounted.
 */
import * as React from "react";
import { normalizeVfsPath } from "@/core/files/vfs-paths";

export const SIMULATED_USB_PATH = "/media/user/PILOTI_USB";
export const SIMULATED_USB_LABEL = "PILOTI USB";

export interface DemoUsb {
  mounted(): boolean;
  mount(): void;
  unmount(): void;
  subscribe(listener: () => void): () => void;
}

const none: DemoUsb = {
  mounted: () => false,
  mount: () => undefined,
  unmount: () => undefined,
  subscribe: () => () => undefined,
};

let current: DemoUsb = none;

export function setDemoUsb(next: DemoUsb): void {
  current = next;
}

export function isSimulatedUsbPath(rawPath: string): boolean {
  const norm = normalizeVfsPath(rawPath);
  return norm === SIMULATED_USB_PATH || norm.startsWith(`${SIMULATED_USB_PATH}/`);
}

export function unmountSimulatedUsb(): void {
  current.unmount();
}

export function toggleSimulatedUsb(): void {
  if (current.mounted()) current.unmount();
  else current.mount();
}

export function useSimulatedUsbMounted(): boolean {
  const [mounted, setMounted] = React.useState(() => current.mounted());
  React.useEffect(() => {
    setMounted(current.mounted());
    return current.subscribe(() => setMounted(current.mounted()));
  }, []);
  return mounted;
}
