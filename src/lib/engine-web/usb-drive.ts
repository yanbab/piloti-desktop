import { SIMULATED_USB_PATH, type DemoUsb } from "@/lib/ports/demo-usb";
import {
  getVfsEntry,
  removeVfsEntry,
  writeVfsTextFile,
} from "./web-vfs";

const SIMULATED_USB_CHANGED_EVENT = "piloti:usb-drive-changed";

const USB_MOUNTED_STORAGE_KEY = "piloti.simulated-usb.mounted";

function readStoredMountFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(USB_MOUNTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMountFlag(mounted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (mounted) {
      window.localStorage.setItem(USB_MOUNTED_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(USB_MOUNTED_STORAGE_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

function emitUsbChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIMULATED_USB_CHANGED_EVENT));
  }
}

function isMounted(): boolean {
  if (readStoredMountFlag()) {
    if (!getVfsEntry(SIMULATED_USB_PATH)) {
      seedSimulatedUsbContents();
    }
    return true;
  }
  return false;
}

function seedSimulatedUsbContents(): void {
  if (!getVfsEntry(`${SIMULATED_USB_PATH}/README.txt`)) {
    writeVfsTextFile(
      `${SIMULATED_USB_PATH}/README.txt`,
      "Piloti Simulated USB Pen Drive (8 GB FAT32)\n\n" +
        "Drop files onto the USB icon in the Dock or open this drive in Folders.\n"
    );
  }
  if (!getVfsEntry(`${SIMULATED_USB_PATH}/Photos/Note.txt`)) {
    writeVfsTextFile(
      `${SIMULATED_USB_PATH}/Photos/Note.txt`,
      "Sample folder on the simulated removable USB pen drive.\n"
    );
  }
}

function mount(): void {
  writeStoredMountFlag(true);
  seedSimulatedUsbContents();
  emitUsbChanged();
}

function unmount(): void {
  writeStoredMountFlag(false);
  removeVfsEntry(SIMULATED_USB_PATH);
  emitUsbChanged();
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === USB_MOUNTED_STORAGE_KEY || e.key === null) {
      listener();
    }
  };
  window.addEventListener(SIMULATED_USB_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SIMULATED_USB_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const webDemoUsb: DemoUsb = { mounted: isMounted, mount, unmount, subscribe };
