/**
 * The demo's hardware: the browser's battery when it reports one, and the
 * simulated USB drive. Everything else is simulated by the settings themselves, so there is nothing to drive.
 */
import { SIMULATED_USB_LABEL, SIMULATED_USB_PATH } from "@/lib/ports/demo-usb";
import type { DriveInfo, Hardware } from "@/lib/ports/hardware";
import { webDemoUsb } from "./usb-drive";
import { subscribeWebBattery } from "./web-battery";

const nothing = async () => undefined;
const never = () => () => undefined;

const demoDrives = (): DriveInfo[] =>
  webDemoUsb.mounted()
    ? [{ id: "demo-usb", label: SIMULATED_USB_LABEL, kind: "usb", mountPath: SIMULATED_USB_PATH }]
    : [];

export const webHardware: Hardware = {
  battery: {
    read: async () => null,
    watch: (_piloti, onChange) => subscribeWebBattery(onChange),
  },
  audio: { watch: never, set: nothing, setDefaultSink: nothing },
  brightness: { watch: never, set: nothing },
  powerProfile: { watch: never, set: nothing },
  wifi: { watch: never, setEnabled: nothing, scan: nothing, connect: async () => "connected" },
  bluetooth: { watch: never, setPowered: nothing, setConnected: nothing },
  drives: {
    watch: (_piloti, onChange) => {
      onChange(demoDrives());
      return webDemoUsb.subscribe(() => onChange(demoDrives()));
    },
    mount: async () => SIMULATED_USB_PATH,
    eject: async () => webDemoUsb.unmount(),
  },
  media: { watch: never, control: nothing },
};
