/**
 * The machine's hardware and media, as the shell reads and drives it. Linux:
 * `engine-native/hardware.ts` and `dbus-services.ts` (assembled in
 * `engine/hardware.ts`). Browser demo: `engine-web/hardware.ts`.
 *
 * Watchers call back now and on each change, whoever made it, and return stop.
 */
import type { WifiNetwork } from "@/core/data/catalog";
import type { Piloti } from "@/core/ports/piloti";

export interface BatteryInfo {
  present: boolean;
  percentage: number;
  charging: boolean;
}

export interface AudioSinkInfo {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface AudioState {
  /** Default output, 0 to 100. */
  volume: number;
  muted: boolean;
  sinks: AudioSinkInfo[];
}

export interface WifiState {
  enabled: boolean;
  connectedSsid: string | null;
  networks: WifiNetwork[];
}

export type WifiConnectResult = "connected" | "needs-passphrase" | "failed";

export interface BluetoothDeviceInfo {
  /** BlueZ object path; what requests address. */
  path: string;
  name: string;
  connected: boolean;
  /** 0 to 100, for a device that reports it. */
  battery?: number;
}

export interface BluetoothState {
  powered: boolean;
  devices: BluetoothDeviceInfo[];
}

export type PowerProfile = "balanced" | "performance" | "power-saver";

/** A removable volume with a filesystem: a USB stick, an SD card, a CD. */
export interface DriveInfo {
  /** What requests address (the UDisks2 object path on Linux). */
  id: string;
  label: string;
  kind: "usb" | "optical";
  /** `null` while not mounted. */
  mountPath: string | null;
}

export interface MprisMediaInfo {
  status: "Playing" | "Paused" | "Stopped";
  title: string;
  artist: string;
  playerName?: string;
}

export type MediaAction = "play-pause" | "next" | "previous";

type Stop = () => void;

export interface Hardware {
  battery: {
    /** `null` when the battery service isn't running. */
    read(piloti: Piloti): Promise<BatteryInfo | null>;
    watch(piloti: Piloti, onChange: (info: BatteryInfo) => void): Stop;
  };
  audio: {
    watch(piloti: Piloti, onChange: (audio: AudioState) => void): Stop;
    set(piloti: Piloti, volume: number, muted: boolean): Promise<void>;
    setDefaultSink(piloti: Piloti, sinkName: string): Promise<void>;
  };
  brightness: {
    /** 0 to 100. */
    watch(piloti: Piloti, onChange: (percentage: number) => void): Stop;
    set(piloti: Piloti, percentage: number): Promise<void>;
  };
  powerProfile: {
    watch(piloti: Piloti, onChange: (profile: PowerProfile) => void): Stop;
    set(piloti: Piloti, profile: PowerProfile): Promise<void>;
  };
  wifi: {
    /** `null` when there is no Wi-Fi hardware. */
    watch(piloti: Piloti, onChange: (wifi: WifiState | null) => void): Stop;
    setEnabled(piloti: Piloti, enabled: boolean): Promise<void>;
    /** What it finds arrives through `watch`. */
    scan(piloti: Piloti): Promise<void>;
    connect(piloti: Piloti, ssid: string, passphrase?: string): Promise<WifiConnectResult>;
  };
  bluetooth: {
    /** `null` when there is no adapter. */
    watch(piloti: Piloti, onChange: (state: BluetoothState | null) => void): Stop;
    setPowered(piloti: Piloti, powered: boolean): Promise<void>;
    setConnected(piloti: Piloti, devicePath: string, connected: boolean): Promise<void>;
  };
  drives: {
    watch(piloti: Piloti, onChange: (drives: DriveInfo[]) => void): () => void;
    /** Returns where it is mounted; rejects with the system's message. */
    mount(piloti: Piloti, id: string): Promise<string>;
    /** Unmounts, then ejects or powers off what can be; rejects likewise. */
    eject(piloti: Piloti, id: string): Promise<void>;
  };
  media: {
    watch(piloti: Piloti, onChange: (media: MprisMediaInfo | null) => void): Stop;
    control(piloti: Piloti, action: MediaAction): Promise<void>;
  };
}
