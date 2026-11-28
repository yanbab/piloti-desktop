/**
 * Emblems on Linux live in each file's `metadata::emblems` and are read as
 * folders are listed. Only the favorites are saved besides: `gio` can't say
 * which files have one.
 */
import { memoryEmblemStorage, type EmblemMap, type EmblemStorage } from "@/platform/shared/emblems";
import { readVfsStateJson, VFS_STATE_PATHS, writeVfsStateJson } from "@/platform/shared/vfs-state";
import { VFS_HOME } from "@/platform/shared/vfs-home";
import type { Vfs } from "@/core/ports/vfs";

/** Where earlier releases saved the favorites. */
const OLD_FAVORITES = `${VFS_HOME}/.local/state/piloti/kv/piloti.web.vfs.favorites.v1`;

const isPathList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export async function createNativeEmblemStorage(vfs: Pick<Vfs, "readText">): Promise<EmblemStorage> {
  let saved = readVfsStateJson(VFS_STATE_PATHS.favorites, undefined, isPathList);
  if (!saved) {
    try {
      const old: unknown = JSON.parse((await vfs.readText(OLD_FAVORITES).catch(() => null)) ?? "null");
      if (isPathList(old)) {
        saved = old;
        writeVfsStateJson(VFS_STATE_PATHS.favorites, old);
      }
    } catch {
      // unreadable: start without favorites
    }
  }
  const initial: EmblemMap = {};
  for (const path of saved ?? []) initial[path] = ["favorite"];
  return memoryEmblemStorage(initial, (map) => {
    const favorites = Object.keys(map).filter((path) => map[path].includes("favorite"));
    writeVfsStateJson(VFS_STATE_PATHS.favorites, favorites.sort());
  });
}
