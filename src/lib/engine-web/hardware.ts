/**
 * The demo's hardware: the browser's battery when it reports one. Everything
 * else is simulated by the settings themselves, so there is nothing to drive.
 */
import type { Hardware } from "@/lib/ports/hardware";
import { subscribeWebBattery } from "./web-battery";

const nothing = async () => undefined;
const never = () => () => undefined;

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
  media: { watch: never, control: nothing },
};
