/**
 * Compress and extract real files with `bsdtar` (libarchive-tools): it reads
 * zip, tar.*, 7z and rar and writes zip. Names are passed as arguments, never
 * pasted into the script. Existing files are never overwritten: a free name
 * ("Archive (1).zip", "photos (1)") is picked, and a failed run removes only what
 * it created.
 */
import type { Piloti } from "@/lib/engine/piloti";
import { runText } from "./exec";

// $1 = folder, $2 = archive name without ".zip", rest = entries in the folder.
// Names that are taken get " (1)", " (2)"…
const COMPRESS_SCRIPT = `
cd -- "$1" || exit 1
base="$2"; shift 2
out="$base.zip"; n=1
while [ -e "./$out" ] || [ -L "./$out" ]; do out="$base ($n).zip"; n=$((n+1)); done
bsdtar --format=zip -cf "./$out" -- "$@" || { rm -f -- "./$out"; exit 1; }
printf %s "$out"
`;

// $1 = folder, $2 = archive file name, $3 = folder name if one is needed.
// A lone file or folder in the archive comes out as itself; several entries get
// a folder of their own.
const EXTRACT_SCRIPT = `
cd -- "$1" || exit 1
tmp="$(mktemp -d ./.extract-XXXXXX)" || exit 1
bsdtar -xf "./$2" -C "$tmp" || { rm -rf -- "$tmp"; exit 1; }
count=0
for e in "$tmp"/* "$tmp"/.[!.]* "$tmp"/..?*; do
  [ -e "$e" ] || [ -L "$e" ] || continue
  count=$((count+1)); only="$e"
done
if [ "$count" = 1 ]; then
  from="$only"; name="\${only##*/}"
else
  from="$tmp"; name="$3"
  chmod =rwx "$tmp"
fi
stem="$name"; ext=""
if [ "$count" = 1 ] && [ ! -d "$from" ]; then
  case "$name" in
    ?*.tar.*) stem="\${name%.tar.*}"; ext="\${name#"$stem"}" ;;
    ?*.*) stem="\${name%.*}"; ext=".\${name##*.}" ;;
  esac
fi
out="$name"; n=1
while [ -e "./$out" ] || [ -L "./$out" ]; do out="$stem ($n)$ext"; n=$((n+1)); done
mv -n -- "$from" "./$out" || { rm -rf -- "$tmp"; exit 1; }
[ "$count" = 1 ] && rmdir -- "$tmp"
printf %s "$out"
`;

const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || "/";
const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const join = (dir: string, name: string) => `${dir === "/" ? "" : dir}/${name}`;

/** Folder name for an extracted archive: `a.tar.gz` → `a`. */
export function archiveStem(name: string): string {
  return name.replace(/\.(tar\.(gz|xz|bz2|zst)|tgz|txz|tbz2?|tar|zip|7z|rar)$/i, "") || "Archive";
}

/** Zips `paths` (siblings) next to them; returns the new archive's path, or null. */
export async function compressNative(
  piloti: Piloti,
  paths: readonly string[]
): Promise<string | null> {
  if (paths.length === 0) return null;
  const parent = dirOf(paths[0]!);
  // bsdtar reads "@name" as "include that archive": spell those "./@name".
  const names = paths.map(nameOf).map((n) => (n.startsWith("@") ? `./${n}` : n));
  const base = paths.length === 1 ? nameOf(paths[0]!) : "Archive";
  const out = await runText(piloti, ["sh", "-c", COMPRESS_SCRIPT, "sh", parent, base, ...names]);
  return out ? join(parent, out) : null;
}

/**
 * Extracts an archive next to it; returns what appeared (the archive's lone entry,
 * or a folder of its entries), or null.
 */
export async function extractNative(piloti: Piloti, path: string): Promise<string | null> {
  const parent = dirOf(path);
  const name = nameOf(path);
  const out = await runText(piloti, ["sh", "-c", EXTRACT_SCRIPT, "sh", parent, name, archiveStem(name)]);
  return out ? join(parent, out) : null;
}
