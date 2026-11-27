import { describe, expect, test } from "bun:test";
import { parseUDisksDrives } from "@/lib/engine-native/drives";

const bytes = (text: string) => [...new TextEncoder().encode(text), 0];
const v = (value: unknown) => ({ value });
const volume = (drive: string, device: string, label: string, mounts: string[], hints = {}) => ({
  "org.freedesktop.UDisks2.Block": { Drive: v(drive), Device: v(bytes(device)), IdLabel: v(label), ...hints },
  "org.freedesktop.UDisks2.Filesystem": { MountPoints: v(mounts.map(bytes)) },
});
const drive = (props: Record<string, unknown>) => ({
  "org.freedesktop.UDisks2.Drive": Object.fromEntries(Object.entries(props).map(([k, value]) => [k, v(value)])),
});

describe("UDisks2 drives", () => {
  test("shows CDs and removable volumes, not the system's disks", () => {
    const drives = parseUDisksDrives({
      "/d/cd": drive({ Optical: true, MediaRemovable: true }),
      "/d/stick": drive({ ConnectionBus: "usb" }),
      "/d/disk": drive({ ConnectionBus: "" }),
      "/b/sda1": volume("/d/disk", "/dev/sda1", "root", ["/"], { HintSystem: v(true) }),
      "/b/sdb1": volume("/d/stick", "/dev/sdb1", "", []),
      "/b/sr0": volume("/d/cd", "/dev/sr0", "Debian 13", ["/media/cdrom0"]),
      "/b/hidden": volume("/d/stick", "/dev/sdb2", "efi", [], { HintIgnore: v(true) }),
      // A blank disc or an audio CD: no filesystem.
      "/b/blank": { "org.freedesktop.UDisks2.Block": { Drive: v("/d/cd") } },
    });
    expect(drives).toEqual([
      { id: "/b/sdb1", label: "sdb1", kind: "usb", mountPath: null },
      { id: "/b/sr0", label: "Debian 13", kind: "optical", mountPath: "/media/cdrom0" },
    ]);
  });
});
