/**
 * Where the shell's console goes: `~/.local/state/piloti/piloti.log`, on the
 * real disk on Linux and in the browser VFS in the demo. The returned writer
 * replaces the whole file.
 */
import type { Piloti } from "@/platform/shared/piloti";
import { getEngine } from "@/core/ports/engine";
import { writeNativeShellLog } from "@/platform/native/shell-log";
import { demoFiles } from "@/core/ports/demo-files";

export type ShellLogWriter = (text: string) => Promise<unknown>;

export function createShellLogWriter(piloti: Pick<Piloti, "files" | "processes">): ShellLogWriter {
  if (getEngine().capabilities.realFilesystem) {
    return (text) => writeNativeShellLog(piloti, text);
  }
  // Loaded on first use: the native entry imports this module before `$HOME` is
  // known, and VFS modules read it when they load (see `vfs-home.ts`).
  return async (text) => {
    const { VFS_STATE_PATHS } = await import("@/core/state/vfs-state");
    demoFiles().writeText(VFS_STATE_PATHS.consoleLog, text);
  };
}
