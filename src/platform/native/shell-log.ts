import type { Piloti } from "@/platform/shared/piloti";

const LOG_DIR = ".local/state/piloti";
const LOG_FILE = `${LOG_DIR}/piloti.log`;
let directory: Promise<unknown> | null = null;

/** Replaces `~/.local/state/piloti/piloti.log` (paths are relative to $HOME). */
export async function writeNativeShellLog(
  piloti: Pick<Piloti, "files" | "processes">,
  text: string,
): Promise<void> {
  directory ??= piloti.processes.run(["mkdir", "-p", LOG_DIR]);
  await directory;
  await piloti.files.write(LOG_FILE, text);
}
