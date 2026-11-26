export interface HostStateFile {
  /** True while the shell has its own write of this file pending or in flight. */
  isWriting: () => boolean;
  readCache: () => string | null;
  readHost: () => Promise<string | null>;
  writeCache: (text: string) => void;
}

/**
 * Brings a state file changed on disk into the VFS cache. The shell's own
 * writes win: a read that overlaps one would bring back an older value.
 */
export async function refreshFromHostFile(file: HostStateFile): Promise<void> {
  if (file.isWriting()) return;
  const cached = file.readCache();
  const text = await file.readHost();
  // Empty: deleted, or an editor truncated it and hasn't written yet.
  if (text === null || !text.trim() || text === cached) return;
  if (file.isWriting() || file.readCache() !== cached) return;
  file.writeCache(text);
}
