import * as React from "react";
import { isSimulatedUsbMounted, subscribeSimulatedUsb } from "@/core/ports/demo-usb";

export function useSimulatedUsbMounted(): boolean {
  return React.useSyncExternalStore(subscribeSimulatedUsb, isSimulatedUsbMounted, isSimulatedUsbMounted);
}
