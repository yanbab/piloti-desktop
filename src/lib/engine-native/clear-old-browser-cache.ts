const MARKER = "piloti.vfs.native-memory.v1";

/** Earlier builds cached the VFS (and a demo tree) in browser storage: dropped once. */
export function clearOldBrowserCache(): void {
  try {
    if (localStorage.getItem(MARKER) === "1") return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("piloti.") || key.startsWith("vfs_")) localStorage.removeItem(key);
    }
    localStorage.setItem(MARKER, "1");
  } catch {
    /* storage unavailable */
  }
}
