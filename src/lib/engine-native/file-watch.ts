import type { Piloti } from "@/lib/engine/piloti";

/**
 * Watches a directory through Domicile (`files.watch`, inotify on the host) and
 * calls `onChange` (debounced) for changes inside it. If the watch can't be set
 * up — or breaks — it falls back to polling every `fallbackPollMs` while the
 * page is visible. Returns a stop function.
 *
 * `dir` is relative to `$HOME` or absolute, as for every `domicile.files` call.
 */
export function watchNativeDir(
  files: Piloti["files"],
  dir: string,
  onChange: () => void,
  options?: { debounceMs?: number; fallbackPollMs?: number },
): () => void {
  const debounceMs = options?.debounceMs ?? 250;
  const fallbackPollMs = options?.fallbackPollMs ?? 6000;
  let stopped = false;
  let stopWatch: (() => void) | null = null;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;

  const fire = () => {
    if (stopped) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      if (!stopped) onChange();
    }, debounceMs);
  };

  const startPolling = () => {
    if (stopped || poll) return;
    poll = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      onChange();
    }, fallbackPollMs);
  };

  void files
    .watch(dir)
    .then((res) => {
      res.match({
        Ok: async (listening) => {
          if (stopped) {
            listening.stop();
            return;
          }
          stopWatch = () => listening.stop();
          const reader = listening.items.getReader();
          try {
            while (!stopped) {
              const next = await reader.read();
              if (next.done) break;
              fire();
            }
          } catch {
            // stream errored
          }
          if (!stopped) startPolling();
        },
        Err: () => startPolling(),
      });
    })
    .catch(() => startPolling());

  return () => {
    stopped = true;
    if (debounce) clearTimeout(debounce);
    if (poll) clearInterval(poll);
    stopWatch?.();
  };
}
