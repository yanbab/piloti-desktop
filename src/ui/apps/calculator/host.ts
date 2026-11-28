/** What the Calculator needs from whoever runs it. */
import type { AppHost } from "@/core/ports/app-host";

export interface CalculatorHost extends Pick<AppHost, "readState" | "writeState" | "close"> {
  /** Fits the window to the keypad; a host that can't leaves it out. */
  resize?(windowId: string, size: { width: number; height: number }): void;
  /** For a host with a menu bar. */
  publishMenu?(windowId: string, state: Record<string, { checked: boolean }>): void;
  onMenuAction?(windowId: string, listener: (actionId: string) => void): () => void;
}
