/** The programs of `$PATH`, for piloti-shell. */
import type { Piloti } from "@/platform/shared/piloti";
import { listPathPrograms } from "@/platform/shared/system-commands";

const STALE_MS = 5000;

export function createProgramIndex(piloti: Piloti) {
  let names = new Set<string>();
  let readAt = -Infinity;
  let reading: Promise<void> | null = null;

  const read = () =>
    (reading ??= listPathPrograms(piloti)
      .then((found) => {
        names = new Set(found);
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
