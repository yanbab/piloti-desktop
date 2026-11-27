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
} from "@/lib/engine-native/hardware";
import {
  controlMprisMedia,
  setSystemPowerProfile,
  watchMprisMedia,
  watchSystemPowerProfile,
} from "@/lib/engine-native/dbus-services";
import type { Hardware } from "@/lib/ports/hardware";

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
  media: { watch: watchMprisMedia, control: controlMprisMedia },
};

let current: Hardware = nativeHardware;

export function setHardware(next: Hardware): void {
  current = next;
}

export const hardware = (): Hardware => current;
