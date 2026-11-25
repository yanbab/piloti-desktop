/**
 * Where the shell's console goes: `~/.local/state/piloti/piloti.log`, on the
 * real disk on Linux and in the browser VFS in the demo. The returned writer
 * replaces the whole file.
 */
import type { Piloti } from "@/lib/engine/piloti";
import { getEngine } from "@/lib/engine/engine";
import { writeNativeShellLog } from "@/lib/engine-native/shell-log";
import { writeVfsTextFile } from "@/lib/engine-web/web-vfs";
import { VFS_STATE_PATHS } from "@/lib/engine/vfs-state";

export type ShellLogWriter = (text: string) => Promise<unknown>;

export function createShellLogWriter(piloti: Piloti): ShellLogWriter {
  if (getEngine().capabilities.realFilesystem) {
    return (text) => writeNativeShellLog(piloti, text);
  }
  return async (text) => {
    writeVfsTextFile(VFS_STATE_PATHS.consoleLog, text);
  };
}
