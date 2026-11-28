/** Removable drives and CDs, from UDisks2 on the system bus. */
import { signalOf } from "@/platform/native/signal";
import { Bus } from "@domicile-desktop/sdk/system";
import type { Piloti } from "@/platform/shared/piloti";
import type { DriveInfo } from "@/core/ports/hardware";

const SERVICE = "org.freedesktop.UDisks2";
const ROOT = "/org/freedesktop/UDisks2";
const BLOCK = `${SERVICE}.Block`;
const FILESYSTEM = `${SERVICE}.Filesystem`;
const DRIVE = `${SERVICE}.Drive`;
const OBJECT_MANAGER = "org.freedesktop.DBus.ObjectManager";
const PROPERTIES = "org.freedesktop.DBus.Properties";

type Props = Record<string, { value?: unknown } | undefined>;
type Managed = Record<string, Record<string, Props> | undefined>;

const prop = (props: Props | undefined, name: string): unknown => props?.[name]?.value;

/** A NUL-terminated byte string (`ay`), as UDisks2 sends paths. */
function bytesToPath(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const bytes = value.filter((b): b is number => typeof b === "number" && b !== 0);
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** The volumes to show out of `GetManagedObjects`: removable ones with a filesystem. */
export function parseUDisksDrives(managed: Managed): DriveInfo[] {
  const drives: DriveInfo[] = [];
  for (const [id, interfaces] of Object.entries(managed)) {
    const block = interfaces?.[BLOCK];
    const filesystem = interfaces?.[FILESYSTEM];
    if (!block || !filesystem || prop(block, "HintIgnore") === true) continue;
    const drive = managed[String(prop(block, "Drive"))]?.[DRIVE];
    const optical = prop(drive, "Optical") === true;
    const bus = prop(drive, "ConnectionBus");
    const removable =
      optical ||
      bus === "usb" ||
      bus === "sdio" ||
      prop(drive, "Removable") === true ||
      prop(drive, "MediaRemovable") === true;
    if (!removable || (prop(block, "HintSystem") === true && !optical)) continue;
    const mounts = prop(filesystem, "MountPoints");
    const mountPath = Array.isArray(mounts) ? bytesToPath(mounts[0]) : "";
    const device = bytesToPath(prop(block, "Device"));
    const label = prop(block, "IdLabel");
    drives.push({
      id,
      label: (typeof label === "string" && label.trim()) || device.slice(device.lastIndexOf("/") + 1),
      kind: optical ? "optical" : "usb",
      mountPath: mountPath || null,
    });
  }
  return drives.sort((a, b) => a.id.localeCompare(b.id));
}

/** The body of the reply; throws with the system's message. */
async function call(
  piloti: Piloti,
  path: string,
  iface: string,
  member: string,
  signature?: string,
  body?: unknown[],
): Promise<unknown[]> {
  const res = await piloti.dbus.call({
    bus: Bus.System,
    destination: SERVICE,
    path,
    interface: iface,
    member,
    signature,
    body,
  });
  return res.match({
    Ok: (reply) => reply.body,
    Err: (error) => {
      const message = (error as { message?: unknown }).message;
      throw new Error(typeof message === "string" ? message : JSON.stringify(error));
    },
  });
}

async function readManaged(piloti: Piloti): Promise<Managed> {
  const body = await call(piloti, ROOT, OBJECT_MANAGER, "GetManagedObjects");
  return (body[0] ?? {}) as Managed;
}

export function watchSystemDrives(piloti: Piloti, onChange: (drives: DriveInfo[]) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = "";
  const stops: Array<() => void> = [];
  const refresh = () => {
    void readManaged(piloti)
      .then((managed) => {
        const drives = parseUDisksDrives(managed);
        const next = JSON.stringify(drives);
        if (stopped || next === last) return;
        last = next;
        onChange(drives);
      })
      .catch((error) => console.warn("[piloti] cannot list drives", error));
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refresh, 250);
  };
  // Drives come and go on the object manager; mounts are property changes.
  for (const match of [
    { bus: Bus.System, interface: OBJECT_MANAGER, path: ROOT },
    { bus: Bus.System, interface: PROPERTIES, member: "PropertiesChanged" },
  ]) {
    void piloti.dbus
      .match(match)
      .then((res) =>
        res.match({
          Err: () => undefined,
          Ok: async ({ items, stop }) => {
            if (stopped) return stop();
            stops.push(stop);
            const reader = items.getReader();
            try {
              while (!stopped) {
                const next = await reader.read();
                if (next.done) break;
                const path = signalOf(next.value)?.path;
                if (!path || path.startsWith(ROOT)) schedule();
              }
            } catch {
              // the match ended
            }
          },
        }),
      )
      .catch(() => undefined);
  }
  refresh();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    for (const stop of stops) stop();
  };
}

export async function mountSystemDrive(piloti: Piloti, id: string): Promise<string> {
  const mounted = parseUDisksDrives(await readManaged(piloti)).find((d) => d.id === id)?.mountPath;
  if (mounted) return mounted;
  const body = await call(piloti, id, FILESYSTEM, "Mount", "a{sv}", [{}]);
  return String(body[0]);
}

export async function ejectSystemDrive(piloti: Piloti, id: string): Promise<void> {
  const managed = await readManaged(piloti);
  if (parseUDisksDrives(managed).find((d) => d.id === id)?.mountPath) {
    await call(piloti, id, FILESYSTEM, "Unmount", "a{sv}", [{}]);
  }
  const drivePath = String(prop(managed[id]?.[BLOCK], "Drive"));
  const drive = managed[drivePath]?.[DRIVE];
  const member =
    prop(drive, "Ejectable") === true ? "Eject" : prop(drive, "CanPowerOff") === true ? "PowerOff" : null;
  if (member) await call(piloti, drivePath, DRIVE, member, "a{sv}", [{}]);
}
