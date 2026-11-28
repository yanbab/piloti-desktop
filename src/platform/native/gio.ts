/** What `gio` says about files' `metadata::*` attributes, emblems included. */
import type { Piloti } from "@/platform/shared/piloti";

/** Parses `gio info -a metadata::*` stdout lines into a key/value map. */
export function parseGioMetadataInfo(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of stdout.split(/\r?\n/)) {
    const match = /^\s*(metadata::[A-Za-z0-9_.:-]+)\s*:\s*(.*)$/.exec(rawLine);
    if (!match) continue;
    const val = match[2].trim();
    if (val) out[match[1]] = val;
  }
  return out;
}

/** Parses `gio list -a metadata::emblems` lines: `name<TAB>size<TAB>(type)<TAB>metadata::emblems=[a, b]`. */
export function parseGioListEmblems(stdout: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of stdout.split("\n")) {
    const cols = line.split("\t");
    const attr = cols.find((c) => c.startsWith("metadata::emblems="));
    if (cols.length < 2 || !attr) continue;
    const names = attr
      .slice("metadata::emblems=".length)
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length > 0) out[cols[0]!] = names;
  }
  return out;
}

/** Parses the `metadata::emblems: [a, b]` line of `gio info`. */
export function parseGioInfoEmblems(stdout: string): string[] {
  const m = /metadata::emblems:\s*\[(.*)\]/.exec(stdout);
  return m ? m[1]!.split(",").map((n) => n.trim()).filter(Boolean) : [];
}

type Processes = Pick<Piloti["processes"], "run">;

const run = async (processes: Processes, argv: string[]): Promise<string | null> => {
  const res = await processes.run(argv).catch(() => null);
  return res?.match({ Ok: (r) => (r.code === 0 ? r.stdout : null), Err: () => null }) ?? null;
};

/** `metadata::emblems` of every entry in a folder that has some, or `null` if unknown. */
export async function listEmblems(processes: Processes, dir: string): Promise<Record<string, string[]> | null> {
  const out = await run(processes, ["gio", "list", "-a", "metadata::emblems", "--", dir]);
  return out === null ? null : parseGioListEmblems(out);
}

/** Sets a file's emblems, keeping names not in `managed`; none removes the attribute. */
export async function setEmblems(
  processes: Processes,
  path: string,
  names: string[],
  managed: readonly string[],
): Promise<void> {
  const info = await run(processes, ["gio", "info", "-a", "metadata::emblems", "--", path]);
  const merged = [...parseGioInfoEmblems(info ?? "").filter((n) => !managed.includes(n)), ...names];
  await run(
    processes,
    merged.length === 0
      ? ["gio", "set", "-t", "unset", "--", path, "metadata::emblems"]
      : ["gio", "set", "-t", "stringv", "--", path, "metadata::emblems", ...merged],
  );
}
