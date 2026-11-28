import * as React from "react";
import { getConsoleEntries, subscribeConsoleEntries, type ConsoleLogEntry } from "@/core/util/console-store";

export function useConsoleEntries(): readonly ConsoleLogEntry[] {
  return React.useSyncExternalStore(subscribeConsoleEntries, getConsoleEntries, getConsoleEntries);
}
