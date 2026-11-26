/** The programs of `$PATH`, for piloti-shell. */
import type { Piloti } from "@/lib/engine/piloti";

const LIST = 'IFS=:; for dir in $PATH; do [ -d "$dir" ] && ls -1 "$dir"; done';
const STALE_MS = 5000;

export function createProgramIndex(piloti: Piloti) {
  let names = new Set<string>();
  let readAt = -Infinity;
  let reading: Promise<void> | null = null;

  const read = () =>
    (reading ??= piloti.processes
      .run(["sh", "-c", LIST])
      .then((res) => {
        const out = res.match({ Ok: (ran) => ran.stdout, Err: () => "" });
        names = new Set(out.split("\n").filter(Boolean));
      })
      .catch(() => undefined)
      .finally(() => {
        readAt = Date.now();
        reading = null;
      }));

  const all = async () => {
    if (Date.now() - readAt > STALE_MS) await read();
    return names;
  };

  return {
    all,
    /** A miss reads again, so a program just installed is found. */
    has: async (name: string) => names.has(name) || (await all()).has(name),
  };
}
