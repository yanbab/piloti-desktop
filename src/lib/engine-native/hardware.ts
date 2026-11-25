import type { Piloti } from "@/lib/engine/piloti";
import type { WifiNetwork } from "@/data/catalog";
import { brightnessSetter } from "@domicile-desktop/system-backlight/set-brightness";
import { watchBrightness } from "@domicile-desktop/system-backlight/watch-brightness";
import { readBattery, watchBattery, type Battery } from "@domicile-desktop/system-battery/battery";
import {
  connectWifi,
  scanWifi,
  setWifiEnabled,
  watchWifi,
  type WifiDevice,
  type WifiNetwork as LibWifiNetwork,
} from "@domicile-desktop/system-network/wifi";
import { soundServer, type SoundServer } from "@domicile-desktop/system-audio/sound-server";
import {
  connect as connectBluetooth,
  disconnect as disconnectBluetooth,
  setPowered,
  watchBluetooth,
} from "@domicile-desktop/system-bluetooth/bluetooth";
import type { AudioSinkInfo, BatteryInfo, BluetoothDeviceInfo } from "./types";

const sound = new WeakMap<object, { server: SoundServer; defaultId?: string }>();

function soundFor(piloti: Piloti) {
  let entry = sound.get(piloti);
  if (!entry) {
    entry = { server: soundServer(piloti) };
    sound.set(piloti, entry);
  }
  return entry;
}

export interface SystemAudioState {
  /** Default output, 0 to 100. */
  volume: number;
  muted: boolean;
  sinks: AudioSinkInfo[];
}

/**
 * Calls `onAudio` now and after each change of the sound server (PulseAudio or
 * PipeWire, through Domicile's `system-audio`); returns a stop function.
 */
export function watchSystemAudio(
  piloti: Piloti,
  onAudio: (audio: SystemAudioState) => void,
): () => void {
  const entry = soundFor(piloti);
  return entry.server.watch((audio) => {
    const outputs = audio.outputs.filter((d) => !d.monitor);
    const def = outputs.find((d) => d.default) ?? outputs[0];
    entry.defaultId = def?.id;
    onAudio({
      volume: Math.max(0, Math.min(100, Math.round((def?.volume ?? 1) * 100))),
      muted: def?.muted ?? false,
      sinks: outputs.map((d) => ({
        id: d.id,
        name: d.id,
        description: d.description,
        active: d === def,
      })),
    });
  });
}

/** Sets the default output's volume (0 to 100) and mute. */
export async function setSystemAudio(
  piloti: Piloti,
  volume: number,
  muted: boolean,
): Promise<void> {
  const { server, defaultId } = soundFor(piloti);
  if (!defaultId) return;
  await Promise.allSettled([
    server.setVolume(defaultId, Math.max(0, Math.min(100, volume)) / 100),
    server.setMuted(defaultId, muted),
  ]);
}

/** Makes an output (an `AudioSinkInfo.name`) the default for new streams. */
export async function setDefaultAudioSink(piloti: Piloti, sinkId: string): Promise<void> {
  await soundFor(piloti).server.setDefault(sinkId).catch(() => undefined);
}

type WifiSnapshot = {
  enabled: boolean;
  connectedSsid: string | null;
  networks: WifiNetwork[];
};

const latestWifiDevice = new WeakMap<object, WifiDevice>();
const latestWifiNetworks = new WeakMap<object, LibWifiNetwork[]>();

const bandOf = (frequencyMhz: number | undefined): WifiNetwork["band"] =>
  frequencyMhz && frequencyMhz >= 5925 ? "6 GHz" : frequencyMhz && frequencyMhz >= 4900 ? "5 GHz" : "2.4 GHz";

/**
 * Calls `onWifi` now and after each change of the Wi-Fi device (NetworkManager
 * or iwd, through Domicile's `system-network`); `null` when there is none.
 */
export function watchSystemWifi(
  piloti: Piloti,
  onWifi: (wifi: WifiSnapshot | null) => void,
): () => void {
  return watchWifi(piloti, (result) =>
    result.match({
      Err: () => onWifi(null),
      Ok: (found) =>
        found.match({
          None: () => onWifi(null),
          Some: (wifi) => {
            latestWifiDevice.set(piloti, wifi);
            latestWifiNetworks.set(piloti, wifi.networks);
            onWifi({
              enabled: wifi.enabled,
              connectedSsid: wifi.connection?.ssid ?? null,
              networks: wifi.networks.map((n) => ({
                ssid: n.ssid,
                signal: Math.max(1, Math.round(n.strength * 100)),
                secured: n.secured,
                band:
                  n.connected || n.ssid === wifi.connection?.ssid
                    ? bandOf(wifi.connection?.frequency)
                    : "5 GHz",
              })),
            });
          },
        }),
    }),
  );
}

export async function setSystemWifiEnabled(piloti: Piloti, enabled: boolean): Promise<void> {
  const device = latestWifiDevice.get(piloti);
  if (device) await setWifiEnabled(piloti, device, enabled).catch(() => undefined);
}

/** Asks for a scan; the networks it finds arrive through `watchSystemWifi`. */
export async function scanSystemWifi(piloti: Piloti): Promise<void> {
  const device = latestWifiDevice.get(piloti);
  if (device) await scanWifi(piloti, device).catch(() => undefined);
}

/**
 * Joins a network by name. A secured network with no saved profile and no passphrase
 * answers "needs-passphrase" so the UI can ask for it.
 */
export async function connectSystemWifi(
  piloti: Piloti,
  ssid: string,
  passphrase?: string,
): Promise<"connected" | "needs-passphrase" | "failed"> {
  const device = latestWifiDevice.get(piloti);
  const network = latestWifiNetworks.get(piloti)?.find((n) => n.ssid === ssid);
  if (!device || !network) return "failed";
  let ok = false;
  try {
    ok = (await connectWifi(piloti, device, network, passphrase)).isOk();
  } catch {
    ok = false;
  }
  if (ok) return "connected";
  return network.secured && !passphrase ? "needs-passphrase" : "failed";
}

const toBatteryInfo = (battery: Battery | undefined): BatteryInfo =>
  battery
    ? { present: true, percentage: Math.round(battery.charge * 100), charging: battery.charging }
    : { present: false, percentage: 100, charging: true };

/** The battery from UPower (Domicile's `system-battery`); `null` if UPower isn't running. */
export async function readSystemBattery(piloti: Piloti): Promise<BatteryInfo | null> {
  const res = await readBattery(piloti).catch(() => null);
  return res?.match({ Ok: (battery) => toBatteryInfo(battery.unwrapOr(undefined as never)), Err: () => null }) ?? null;
}

/** Calls `onChange` now and on each UPower change; returns a stop function. */
export function watchSystemBattery(
  piloti: Piloti,
  onChange: (info: BatteryInfo) => void,
): () => void {
  let stopped = false;
  let stopWatch: (() => void) | null = null;
  void watchBattery(piloti)
    .then((res) =>
      res.match({
        Err: () => undefined,
        Ok: async ({ items, stop }) => {
          if (stopped) return stop();
          stopWatch = stop;
          const reader = items.getReader();
          try {
            while (!stopped) {
              const next = await reader.read();
              if (next.done) break;
              onChange(toBatteryInfo(next.value.unwrapOr(undefined as never)));
            }
          } catch {
            // the watch ended
          }
        },
      }),
    )
    .catch(() => undefined);
  return () => {
    stopped = true;
    stopWatch?.();
  };
}

const brightnessSetters = new WeakMap<object, ReturnType<typeof brightnessSetter>>();

/** Sets the backlight through logind (Domicile's `system-backlight`); `percentage` is 0 to 100. */
export async function setSystemBrightness(piloti: Piloti, percentage: number): Promise<void> {
  let set = brightnessSetters.get(piloti);
  if (!set) {
    set = brightnessSetter(piloti);
    brightnessSetters.set(piloti, set);
  }
  await set(Math.max(0.1, Math.min(1, percentage / 100))).catch(() => undefined);
}

/** Calls `onLevel` (0 to 100) now and when the backlight changes, whoever changed it; returns a stop function. */
export function watchSystemBrightness(
  piloti: Piloti,
  onLevel: (percentage: number) => void,
): () => void {
  let stopped = false;
  let stopWatch: (() => void) | null = null;
  void watchBrightness(piloti, (level) => onLevel(Math.round(level * 100)))
    .then((res) =>
      res.match({
        Err: () => undefined,
        Ok: (watch) => {
          if (stopped) return watch.stop();
          stopWatch = watch.stop;
        },
      }),
    )
    .catch(() => undefined);
  return () => {
    stopped = true;
    stopWatch?.();
  };
}

const bluetoothAdapters = new WeakMap<object, string>();

/**
 * Calls `onBluetooth` now and after each BlueZ change (Domicile's
 * `system-bluetooth`): whether the first adapter is on, and the paired devices.
 * `null` when BlueZ or an adapter is missing. Returns a stop function.
 */
export function watchSystemBluetooth(
  piloti: Piloti,
  onBluetooth: (state: { powered: boolean; devices: BluetoothDeviceInfo[] } | null) => void,
): () => void {
  return watchBluetooth(piloti, (result) =>
    result.match({
      Err: () => onBluetooth(null),
      Ok: ({ adapters, devices }) => {
        const adapter = adapters[0];
        if (!adapter) return onBluetooth(null);
        bluetoothAdapters.set(piloti, adapter.path);
        onBluetooth({
          powered: adapter.powered,
          devices: devices
            .filter((d) => d.adapter === adapter.path && d.paired)
            .map((d) => ({
              path: d.path,
              name: d.name,
              connected: d.connected,
              ...(d.battery !== undefined ? { battery: d.battery } : {}),
            })),
        });
      },
    }),
  );
}

export async function setSystemBluetoothPowered(piloti: Piloti, powered: boolean): Promise<void> {
  const adapter = bluetoothAdapters.get(piloti);
  if (adapter) await setPowered(piloti, adapter, powered).catch(() => undefined);
}

export async function setSystemBluetoothConnected(
  piloti: Piloti,
  devicePath: string,
  connected: boolean,
): Promise<void> {
  await (connected ? connectBluetooth(piloti, devicePath) : disconnectBluetooth(piloti, devicePath)).catch(
    () => undefined,
  );
}
