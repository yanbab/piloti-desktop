import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { WifiNetwork } from "@/data/catalog";
import { runText } from "./exec";
import type { AudioSinkInfo, BatteryInfo, MprisMediaInfo } from "./types";

export function parseWpctlVolumeOutput(
  wpOut: string
): { volume: number; muted: boolean } | null {
  const m = wpOut.match(/Volume:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return null;
  const vol = Math.max(0, Math.min(100, Math.round(Number(m[1]) * 100)));
  const muted = /\[MUTED\]/i.test(wpOut);
  return { volume: vol, muted };
}

export async function readSystemAudio(
  domicile: Domicile
): Promise<{ volume: number; muted: boolean } | null> {
  const wpOut = await runText(domicile, [
    "wpctl",
    "get-volume",
    "@DEFAULT_AUDIO_SINK@",
  ]);
  if (wpOut) {
    const parsed = parseWpctlVolumeOutput(wpOut);
    if (parsed) return parsed;
  }

  const [paVolOut, paMuteOut] = await Promise.all([
    runText(domicile, ["pactl", "get-sink-volume", "@DEFAULT_SINK@"]),
    runText(domicile, ["pactl", "get-sink-mute", "@DEFAULT_SINK@"]),
  ]);
  if (paVolOut) {
    const m = paVolOut.match(/(\d+)%/);
    if (m) {
      const vol = Math.max(0, Math.min(100, Number(m[1])));
      const muted = paMuteOut ? /yes/i.test(paMuteOut) : false;
      return { volume: vol, muted };
    }
  }

  return null;
}

export async function setSystemAudio(
  domicile: Domicile,
  volume: number,
  muted: boolean
): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  const wpRes = await runText(domicile, [
    "wpctl",
    "set-volume",
    "@DEFAULT_AUDIO_SINK@",
    (clamped / 100).toFixed(2),
  ]);
  if (wpRes !== null) {
    await runText(domicile, [
      "wpctl",
      "set-mute",
      "@DEFAULT_AUDIO_SINK@",
      muted ? "1" : "0",
    ]);
    return;
  }

  await Promise.allSettled([
    runText(domicile, [
      "pactl",
      "set-sink-volume",
      "@DEFAULT_SINK@",
      `${clamped}%`,
    ]),
    runText(domicile, [
      "pactl",
      "set-sink-mute",
      "@DEFAULT_SINK@",
      muted ? "1" : "0",
    ]),
  ]);
}

export async function listSystemAudioSinks(
  domicile: Domicile
): Promise<AudioSinkInfo[]> {
  const [defaultSinkOut, shortOut] = await Promise.all([
    runText(domicile, ["pactl", "get-default-sink"]),
    runText(domicile, ["pactl", "list", "short", "sinks"]),
  ]);
  if (!shortOut) return [];

  const defaultName = defaultSinkOut?.trim() ?? "";
  const sinks: AudioSinkInfo[] = [];

  for (const line of shortOut.split(/\r?\n/)) {
    const cols = line.split(/\t+/);
    if (cols.length < 2) continue;
    const id = cols[0].trim();
    const name = cols[1].trim();
    if (!name) continue;
    const friendly = name
      .replace(/^alsa_output\./, "")
      .replace(/^bluez_output\./, "Bluetooth · ")
      .replace(/\.analog-stereo$/, " (Analog Stereo)")
      .replace(/\.hdmi-stereo.*$/, " (HDMI / DisplayPort)")
      .replace(/_/g, " ");
    sinks.push({
      id,
      name,
      description: friendly,
      active: name === defaultName,
    });
  }

  return sinks;
}

export async function setDefaultAudioSink(
  domicile: Domicile,
  sinkName: string
): Promise<void> {
  await runText(domicile, ["pactl", "set-default-sink", sinkName]);
}

export function parseNmcliWifiOutput(listOut: string): {
  connectedSsid: string | null;
  networks: WifiNetwork[];
} {
  let connectedSsid: string | null = null;
  const dedup = new Map<string, WifiNetwork>();

  for (const line of listOut.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split(/(?<!\\):/);
    if (parts.length < 3) continue;
    const active = parts[0].trim() === "yes";
    const ssid = parts[1].replace(/\\:/g, ":").trim();
    if (!ssid) continue;
    const signal = Number.parseInt(parts[2] ?? "0", 10) || 0;
    const sec = (parts[3] ?? "").trim();

    if (active) {
      connectedSsid = ssid;
    }
    const prev = dedup.get(ssid);
    if (!prev || signal > prev.signal) {
      dedup.set(ssid, {
        ssid,
        signal,
        secured: Boolean(sec && sec !== "--"),
        band: "5 GHz",
      });
    }
  }

  return {
    connectedSsid,
    networks: Array.from(dedup.values()).sort((a, b) => b.signal - a.signal),
  };
}

/**
 * Reads Wi-Fi radio state and active SSID; only runs the heavier
 * `nmcli dev wifi list` scan when `options?.scan` is true.
 */
export async function readSystemWifi(
  domicile: Domicile,
  options?: { scan?: boolean }
): Promise<{
  enabled: boolean;
  connectedSsid: string | null;
  networks: WifiNetwork[];
} | null> {
  const radioOut = await runText(domicile, ["nmcli", "radio", "wifi"]);
  if (radioOut === null) return null;

  const enabled = radioOut.trim().toLowerCase() === "enabled";
  if (!enabled) {
    return { enabled: false, connectedSsid: null, networks: [] };
  }

  if (!options?.scan) {
    const activeOut = await runText(domicile, [
      "nmcli",
      "-t",
      "-f",
      "NAME,TYPE",
      "connection",
      "show",
      "--active",
    ]);
    let connectedSsid: string | null = null;
    if (activeOut) {
      for (const line of activeOut.split(/\r?\n/)) {
        const idx = line.lastIndexOf(":");
        if (idx <= 0) continue;
        const connType = line.slice(idx + 1).trim();
        if (connType === "802-11-wireless" || connType === "wifi") {
          connectedSsid = line.slice(0, idx).replace(/\\:/g, ":").trim();
          break;
        }
      }
    }
    return { enabled, connectedSsid, networks: [] };
  }

  const listOut = await runText(domicile, [
    "nmcli",
    "-t",
    "-f",
    "ACTIVE,SSID,SIGNAL,SECURITY",
    "dev",
    "wifi",
    "list",
  ]);
  if (!listOut) {
    return { enabled, connectedSsid: null, networks: [] };
  }

  return {
    enabled,
    ...parseNmcliWifiOutput(listOut),
  };
}

export async function setSystemWifiEnabled(
  domicile: Domicile,
  enabled: boolean
): Promise<void> {
  await runText(domicile, ["nmcli", "radio", "wifi", enabled ? "on" : "off"]);
}

export async function connectSystemWifi(
  domicile: Domicile,
  ssid: string
): Promise<boolean> {
  const res = await runText(domicile, [
    "nmcli",
    "dev",
    "wifi",
    "connect",
    ssid,
  ]);
  return res !== null;
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

export async function readSystemBattery(
  domicile: Domicile
): Promise<BatteryInfo | null> {
  try {
    const dirRes = await domicile.files.readDir("/sys/class/power_supply");
    const entries = dirRes.match({
      Ok: (list) => list,
      Err: () => [],
    });
    const bat = entries.find((e) => /^BAT\d+$/i.test(e.name));
    if (bat) {
      const [capRes, statusRes] = await Promise.all([
        domicile.files.readText(`/sys/class/power_supply/${bat.name}/capacity`),
        domicile.files.readText(`/sys/class/power_supply/${bat.name}/status`),
      ]);
      const capStr = capRes.match({ Ok: (t) => t, Err: () => "" });
      const statusStr = statusRes.match({ Ok: (t) => t, Err: () => "" });
      const pct = Number.parseInt(capStr.trim(), 10);
      if (Number.isFinite(pct)) {
        return {
          present: true,
          percentage: Math.max(0, Math.min(100, pct)),
          charging: /charging|full/i.test(statusStr),
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function setSystemBrightness(
  domicile: Domicile,
  percentage: number
): Promise<void> {
  const clamped = Math.max(10, Math.min(100, Math.round(percentage)));
  await runText(domicile, ["brightnessctl", "set", `${clamped}%`]);
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

