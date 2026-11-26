/**
 * Where the shell's console goes: `~/.local/state/piloti/piloti.log`, on the
 * real disk on Linux and in the browser VFS in the demo. The returned writer
 * replaces the whole file.
 */
import type { Piloti } from "@/lib/engine/piloti";
import { getEngine } from "@/lib/engine/engine";
import { writeNativeShellLog } from "@/lib/engine-native/shell-log";

export type ShellLogWriter = (text: string) => Promise<unknown>;

export function createShellLogWriter(piloti: Pick<Piloti, "files" | "processes">): ShellLogWriter {
  if (getEngine().capabilities.realFilesystem) {
    return (text) => writeNativeShellLog(piloti, text);
  }
  // Loaded on first use: the native entry imports this module before `$HOME` is
  // known, and VFS modules read it when they load (see `vfs-home.ts`).
  return async (text) => {
    const [{ writeVfsTextFile }, { VFS_STATE_PATHS }] = await Promise.all([
      import("@/lib/engine-web/web-vfs"),
      import("@/lib/engine/vfs-state"),
    ]);
    writeVfsTextFile(VFS_STATE_PATHS.consoleLog, text);
  };
}
