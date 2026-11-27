/**
 * Emblems (favorite, work…) on files, for both engines. They are still kept by
 * `web-vfs`, mirrored to GVfs `metadata::emblems` on Linux; views ask here so
 * their storage can move without touching them.
 */
import { loadVfsEmblemsMap, subscribeWebVfs } from "@/lib/engine-web/web-vfs";
import type { VfsEmblemId } from "@/lib/core/emblems";

export {
  getVfsEmblems as getEmblems,
  toggleVfsEmblem as toggleEmblem,
  loadVfsEmblemsMap as loadEmblemsMap,
} from "@/lib/engine-web/web-vfs";
export { VFS_EMBLEM_META as EMBLEM_META, type VfsEmblemId as EmblemId } from "@/lib/core/emblems";

/** Calls `onChange` with every file's emblems when they may have changed. */
export function subscribeEmblems(
  onChange: (emblems: Record<string, VfsEmblemId[]>) => void,
): () => void {
  return subscribeWebVfs(() => onChange(loadVfsEmblemsMap()));
}
