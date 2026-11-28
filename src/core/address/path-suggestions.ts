/**
 * Folder suggestions for a typed path: the subfolders of the folder being
 * typed whose name starts with the last segment (`~/Doc` → `~/Documents/`).
 * Hidden folders only once a `.` is typed. The folder listing is passed in,
 * so this runs wherever `piloti.vfs` (or a module's copy of it) does.
 */
import { expandPath, looksLikePath, tildePath } from "@/core/address/input";
import type { AddressSuggestion } from "@/core/address/types";
import type { Vfs } from "@/core/ports/vfs";

export type FolderLister = Pick<Vfs, "list">;

/** Splits typed text into the folder to list and the name prefix to match. */
export function splitTypedPath(
  raw: string,
  home: string
): { dir: string; prefix: string; typedDir: string } | null {
  const text = raw.trim();
  if (!looksLikePath(text) || /^file:/i.test(text)) return null;
  if (text === "~") return { dir: expandPath("~", home)!, prefix: "", typedDir: "~/" };
  const cut = text.lastIndexOf("/");
  const typedDir = text.slice(0, cut + 1);
  const dir = expandPath(typedDir || "/", home);
  if (dir === null) return null;
  return { dir, prefix: text.slice(cut + 1), typedDir };
}

export async function pathSuggestions(
  raw: string,
  host: FolderLister,
  home: string,
  limit = 8
): Promise<AddressSuggestion[]> {
  const split = splitTypedPath(raw, home);
  if (!split) return [];
  const entries = await host.list(split.dir).catch(() => null);
  if (!entries) return [];
  const prefix = split.prefix.toLowerCase();
  const showHidden = prefix.startsWith(".");
  const base = split.dir === "/" ? "" : split.dir;
  return entries
    .filter(
      (e) =>
        e.kind === "directory" &&
        (showHidden || !e.name.startsWith(".")) &&
        e.name.toLowerCase().startsWith(prefix)
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }))
    .slice(0, limit)
    .map((e) => {
      const path = `${base}/${e.name}`;
      return {
        key: path,
        title: e.name,
        detail: tildePath(path, home),
        icon: "folder" as const,
        target: { kind: "path" as const, path },
        completion: `${split.typedDir}${e.name}/`,
      };
    });
}
