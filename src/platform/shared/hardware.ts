/**
 * `hardware()` is how UI code reaches the machine (`ports/hardware.ts`). It is
 * Linux unless the web entry point set the demo's.
 */
import {
  connectSystemWifi,
  readSystemBattery,
  scanSystemWifi,
  setDefaultAudioSink,
  setSystemAudio,
  setSystemBluetoothConnected,
  setSystemBluetoothPowered,
  setSystemBrightness,
  setSystemWifiEnabled,
  watchSystemAudio,
  watchSystemBattery,
  watchSystemBluetooth,
  watchSystemBrightness,
  watchSystemWifi,
} from "@/platform/native/hardware";
import {
  controlMprisMedia,
  setSystemPowerProfile,
  watchMprisMedia,
  watchSystemPowerProfile,
} from "@/platform/native/dbus-services";
import { ejectSystemDrive, mountSystemDrive, watchSystemDrives } from "@/platform/native/drives";
import type { Hardware } from "@/core/ports/hardware";

export const nativeHardware: Hardware = {
  battery: { read: readSystemBattery, watch: watchSystemBattery },
  audio: { watch: watchSystemAudio, set: setSystemAudio, setDefaultSink: setDefaultAudioSink },
  brightness: { watch: watchSystemBrightness, set: setSystemBrightness },
  powerProfile: { watch: watchSystemPowerProfile, set: setSystemPowerProfile },
  wifi: {
    watch: watchSystemWifi,
    setEnabled: setSystemWifiEnabled,
    scan: scanSystemWifi,
    connect: connectSystemWifi,
  },
  bluetooth: {
    watch: watchSystemBluetooth,
    setPowered: setSystemBluetoothPowered,
    setConnected: setSystemBluetoothConnected,
  },
  drives: { watch: watchSystemDrives, mount: mountSystemDrive, eject: ejectSystemDrive },
  media: { watch: watchMprisMedia, control: controlMprisMedia },
};

let current: Hardware = nativeHardware;

export function setHardware(next: Hardware): void {
  current = next;
}

export const hardware = (): Hardware => current;
