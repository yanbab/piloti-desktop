import { xdgDataHome, type XdgFileReader } from "./xdg-basedir";

/**
 * FreeDesktop.org Trash Specification (v1.0).
 * https://specifications.freedesktop.org/trash-spec/trashspec-1.0.html
 */

export interface XdgTrashPaths {
  trashDir: string;
  filesDir: string;
  infoDir: string;
}

export interface XdgTrashStatus {
  empty: boolean;
  itemCount: number;
}

export interface XdgTrashInfo {
  originalPath: string;
  deletionDate?: string;
}

/**
 * Resolves the user's XDG Trash directory paths under `$XDG_DATA_HOME/Trash`.
 */
export function resolveXdgTrashPaths(
  homeDir?: string,
  env?: Record<string, string | undefined>
): XdgTrashPaths {
  const dataHome = xdgDataHome(
    env || homeDir
      ? { ...(env ?? {}), ...(homeDir ? { HOME: homeDir } : {}) }
      : undefined
  );
  const trashDir = `${dataHome.replace(/\/+$/, "")}/Trash`;
  return {
    trashDir,
    filesDir: `${trashDir}/files`,
    infoDir: `${trashDir}/info`,
  };
}

/**
 * Parses a `.trashinfo` file according to the FreeDesktop Trash Spec.
 */
export function parseTrashInfo(raw: string): XdgTrashInfo | null {
  const lines = raw.split(/\r?\n/);
  let inHeader = false;
  let originalPath = "";
  let deletionDate: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inHeader = line === "[Trash Info]";
      continue;
    }
    if (!inHeader) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (key === "Path") {
      try {
        originalPath = decodeURIComponent(value);
      } catch {
        originalPath = value;
      }
    } else if (key === "DeletionDate") {
      deletionDate = value;
    }
  }

  return originalPath ? { originalPath, deletionDate } : null;
}

/**
 * Inspects `$XDG_DATA_HOME/Trash/files` to determine whether the trash is
 * empty or contains trashed items.
 */
export async function inspectXdgTrash(
  files: Pick<XdgFileReader, "readDir">,
  filesDir = ".local/share/Trash/files"
): Promise<XdgTrashStatus> {
  try {
    const res = await files.readDir(filesDir);
    return res.match({
      Ok: (entries) => {
        const visible = entries.filter(
          (entry) => entry.name !== "." && entry.name !== ".."
        );
        return {
          empty: visible.length === 0,
          itemCount: visible.length,
        };
      },
      Err: () => ({ empty: true, itemCount: 0 }),
    });
  } catch {
    return { empty: true, itemCount: 0 };
  }
}

/**
 * Empties the XDG Trash using `gio trash --empty` with a direct Trash cleanup
 * fallback if `gio` is unavailable.
 */
export async function emptyXdgTrash(
  processes: {
    run: (argv: readonly string[]) => Promise<{
      match: <U>(m: {
        Ok: (out: { status?: number; exitCode?: number; code?: number }) => U;
        Err: () => U;
      }) => U;
    }>;
  },
  paths: XdgTrashPaths
): Promise<boolean> {
  try {
    const gioRes = await processes.run(["gio", "trash", "--empty"]);
    const gioOk = gioRes.match({
      Ok: (out) => {
        const code = out.status ?? out.exitCode ?? out.code;
        return code === undefined || code === 0;
      },
      Err: () => false,
    });
    if (gioOk) return true;
  } catch {
    // Fall through to direct Trash cleanup
  }

  try {
    const rmRes = await processes.run([
      "sh",
      "-c",
      'rm -rf "$1"/* "$1"/.[!.]* "$2"/* "$2"/.[!.]* 2>/dev/null || true',
      "_",
      paths.filesDir,
      paths.infoDir,
    ]);
    return rmRes.match({
      Ok: () => true,
      Err: () => false,
    });
  } catch {
    return false;
  }
}
