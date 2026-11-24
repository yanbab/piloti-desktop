import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
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
import { runText } from "./exec";
import type { AudioSinkInfo, BatteryInfo, MprisMediaInfo } from "./types";

const sound = new WeakMap<object, { server: SoundServer; defaultId?: string }>();

function soundFor(domicile: Domicile) {
  let entry = sound.get(domicile);
  if (!entry) {
    entry = { server: soundServer(domicile) };
    sound.set(domicile, entry);
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
  domicile: Domicile,
  onAudio: (audio: SystemAudioState) => void,
): () => void {
  const entry = soundFor(domicile);
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
  domicile: Domicile,
  volume: number,
  muted: boolean,
): Promise<void> {
  const { server, defaultId } = soundFor(domicile);
  if (!defaultId) return;
  await Promise.allSettled([
    server.setVolume(defaultId, Math.max(0, Math.min(100, volume)) / 100),
    server.setMuted(defaultId, muted),
  ]);
}

/** Makes an output (an `AudioSinkInfo.name`) the default for new streams. */
export async function setDefaultAudioSink(domicile: Domicile, sinkId: string): Promise<void> {
  await soundFor(domicile).server.setDefault(sinkId).catch(() => undefined);
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
  domicile: Domicile,
  onWifi: (wifi: WifiSnapshot | null) => void,
): () => void {
  return watchWifi(domicile, (result) =>
    result.match({
      Err: () => onWifi(null),
      Ok: (found) =>
        found.match({
          None: () => onWifi(null),
          Some: (wifi) => {
            latestWifiDevice.set(domicile, wifi);
            latestWifiNetworks.set(domicile, wifi.networks);
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

export async function setSystemWifiEnabled(domicile: Domicile, enabled: boolean): Promise<void> {
  const device = latestWifiDevice.get(domicile);
  if (device) await setWifiEnabled(domicile, device, enabled).catch(() => undefined);
}

/** Asks for a scan; the networks it finds arrive through `watchSystemWifi`. */
export async function scanSystemWifi(domicile: Domicile): Promise<void> {
  const device = latestWifiDevice.get(domicile);
  if (device) await scanWifi(domicile, device).catch(() => undefined);
}

/** Joins a network by name. Only networks with a saved profile (or open ones) connect without a passphrase. */
export async function connectSystemWifi(
  domicile: Domicile,
  ssid: string,
  passphrase?: string,
): Promise<boolean> {
  const device = latestWifiDevice.get(domicile);
  const network = latestWifiNetworks.get(domicile)?.find((n) => n.ssid === ssid);
  if (!device || !network) return false;
  try {
    const res = await connectWifi(domicile, device, network, passphrase);
    return res.isOk();
  } catch {
    return false; // a secured network with no saved profile needs a passphrase
  }
}

export async function readSystemPowerProfile(
  domicile: Domicile
): Promise<"balanced" | "performance" | "power-saver" | null> {
  const out = await runText(domicile, ["powerprofilesctl", "get"]);
  if (!out) return null;
  const val = out.trim();
  if (val === "balanced" || val === "performance" || val === "power-saver") {
    return val;
  }
  return null;
}

export async function setSystemPowerProfile(
  domicile: Domicile,
  profile: "balanced" | "performance" | "power-saver"
): Promise<void> {
  await runText(domicile, ["powerprofilesctl", "set", profile]);
}

const toBatteryInfo = (battery: Battery | undefined): BatteryInfo =>
  battery
    ? { present: true, percentage: Math.round(battery.charge * 100), charging: battery.charging }
    : { present: false, percentage: 100, charging: true };

/** The battery from UPower (Domicile's `system-battery`); `null` if UPower isn't running. */
export async function readSystemBattery(domicile: Domicile): Promise<BatteryInfo | null> {
  const res = await readBattery(domicile).catch(() => null);
  return res?.match({ Ok: (battery) => toBatteryInfo(battery.unwrapOr(undefined as never)), Err: () => null }) ?? null;
}

/** Calls `onChange` now and on each UPower change; returns a stop function. */
export function watchSystemBattery(
  domicile: Domicile,
  onChange: (info: BatteryInfo) => void,
): () => void {
  let stopped = false;
  let stopWatch: (() => void) | null = null;
  void watchBattery(domicile)
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
export async function setSystemBrightness(domicile: Domicile, percentage: number): Promise<void> {
  let set = brightnessSetters.get(domicile);
  if (!set) {
    set = brightnessSetter(domicile);
    brightnessSetters.set(domicile, set);
  }
  await set(Math.max(0.1, Math.min(1, percentage / 100))).catch(() => undefined);
}

/** Calls `onLevel` (0 to 100) now and when the backlight changes, whoever changed it; returns a stop function. */
export function watchSystemBrightness(
  domicile: Domicile,
  onLevel: (percentage: number) => void,
): () => void {
  let stopped = false;
  let stopWatch: (() => void) | null = null;
  void watchBrightness(domicile, (level) => onLevel(Math.round(level * 100)))
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

export async function readMprisMediaInfo(
  domicile: Domicile
): Promise<MprisMediaInfo | null> {
  const out = await runText(domicile, [
    "playerctl",
    "metadata",
    "--format",
    "{{status}}\t{{title}}\t{{artist}}\t{{playerName}}",
  ]);
  if (!out) return null;
  const line = out.split(/\r?\n/)[0]?.trim();
  if (!line) return null;
  const [rawStatus, title, artist, playerName] = line.split("\t");
  if (!title && !artist) return null;
  const status: MprisMediaInfo["status"] =
    rawStatus === "Playing"
      ? "Playing"
      : rawStatus === "Paused"
        ? "Paused"
        : "Stopped";
  if (status === "Stopped") return null;
  return {
    status,
    title: title?.trim() || "Unknown Track",
    artist: artist?.trim() || playerName?.trim() || "Media Player",
    playerName: playerName?.trim() || undefined,
  };
}

export async function controlMprisMedia(
  domicile: Domicile,
  action: "play-pause" | "next" | "previous"
): Promise<void> {
  await runText(domicile, ["playerctl", action]);
}

