/**
 * The files shipped with Piloti (`data/files`), as the browser demo sees them.
 * They are served as plain files under `__fs/` (also used by the landing page).
 * The shell waits for /home/user (what a new demo starts with) and /etc; system
 * files (/usr) are fetched alongside and read from memory, read-only.
 */
export interface DataFilesIndex {
  dirs: readonly string[];
  files: readonly string[];
}

export const DATA_FILES: Record<string, string> = {};
export const DATA_DIRS: string[] = [];

export interface DataDirEntry {
  name: string;
  isDirectory: boolean;
}

let listings: Map<string, DataDirEntry[]> | null = null;
/** Every shipped file, whether its content has arrived or not. */
let paths: readonly string[] = [];
const requests = new Map<string, Promise<string | undefined>>();

export function setDataFiles(dirs: readonly string[], files: Record<string, string>): void {
  for (const key of Object.keys(DATA_FILES)) delete DATA_FILES[key];
  Object.assign(DATA_FILES, files);
  DATA_DIRS.splice(0, DATA_DIRS.length, ...dirs);
  paths = Object.keys(files);
  requests.clear();
  listings = null;
}

/** A shipped file's content, waiting for it if it is still on its way. */
export function readShippedFile(path: string): Promise<string | undefined> {
  const loaded = DATA_FILES[path];
  if (loaded !== undefined) return Promise.resolve(loaded);
  return requests.get(path) ?? Promise.resolve(undefined);
}

/** The page's folder, also when the demo is opened without a trailing slash. */
function demoBaseUrl(): string {
  const url = new URL(document.baseURI || window.location.href);
  if (!url.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(url.pathname)) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

/**
 * Fetches the index, then every file at once; resolves when /home/user and /etc
 * are in. A file that fails is left out, not fatal.
 */
export async function loadDataFiles(): Promise<void> {
  const base = demoBaseUrl();
  const index = (await (await fetch(new URL("__fs/index.json", base))).json()) as DataFilesIndex;
  setDataFiles(index.dirs, {});
  paths = index.files;
  for (const path of index.files) {
    const url = new URL(`__fs${path.split("/").map(encodeURIComponent).join("/")}`, base);
    requests.set(
      path,
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          return (DATA_FILES[path] = await res.text());
        })
        .catch(() => {
          console.warn(`[piloti] could not load ${path}`);
          return undefined;
        })
    );
  }
  await Promise.all(
    index.files
      .filter((p) => p.startsWith("/home/user/") || p.startsWith("/etc/"))
      .map((p) => requests.get(p))
  );
}

/** The entries of a shipped folder (`/` included), or null when it isn't one. */
export function listDataDir(path: string): readonly DataDirEntry[] | null {
  if (!listings) {
    listings = new Map([["/", []]]);
    for (const dir of DATA_DIRS) listings.set(dir, []);
    const add = (path: string, isDirectory: boolean) => {
      const cut = path.lastIndexOf("/");
      listings!.get(path.slice(0, cut) || "/")?.push({ name: path.slice(cut + 1), isDirectory });
    };
    for (const dir of DATA_DIRS) add(dir, true);
    for (const file of paths) add(file, false);
  }
  return listings.get(path) ?? null;
}
