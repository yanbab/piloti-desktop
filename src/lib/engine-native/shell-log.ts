import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";

const LOG_DIR = ".local/state/piloti";
const LOG_FILE = `${LOG_DIR}/piloti.log`;
let directory: Promise<unknown> | null = null;

/** Replaces `~/.local/state/piloti/piloti.log` (paths are relative to $HOME). */
export async function writeNativeShellLog(domicile: Domicile, text: string): Promise<void> {
  directory ??= domicile.processes.run(["mkdir", "-p", LOG_DIR]);
  await directory;
  await domicile.files.write(LOG_FILE, text);
}
