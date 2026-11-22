import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import flathubPopularJson from "@/data/flathub-popular.json";
import { commandExists, launchDesktopCommand, runText } from "./exec";

export interface FlatpakAppEntry {
  appId: string;
  name: string;
  version?: string;
  origin?: string;
  installation?: string;
  description?: string;
  iconUrl?: string;
  mainCategories?: string[];
  installed: boolean;
}

export interface FlatpakCapabilities {
  available: boolean;
  hasFlathub: boolean;
  hasUserFlathub: boolean;
}

export interface FlatpakStreamUpdate {
  line: string;
  progress: number | null;
}

const ANSI_ESCAPE_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

/**
 * Cleans a raw terminal chunk/line from `flatpak` stdout/stderr by stripping
 * ANSI escape sequences and collapsing excess whitespace.
 */
export function cleanFlatpakOutputLine(raw: string): string {
  return raw.replace(ANSI_ESCAPE_RE, "").replace(/\s+/g, " ").trim();
}

/**
 * Extracts an explicit percentage (`0..100`) from a `flatpak` output line, or
 * returns `null` when no progress percentage is present (indeterminate).
 */
export function parseFlatpakProgressPercent(line: string): number | null {
  const match = line.match(/\b(\d{1,3})%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

/**
 * Parses tab-separated output from:
 * `flatpak list --app --columns=application,name,version,origin,installation`
 */
export function parseFlatpakListOutput(stdout: string): FlatpakAppEntry[] {
  const results: FlatpakAppEntry[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [appId, name, version, origin, installation] = line
      .split("\t")
      .map((part) => part.trim());
    if (!appId || !name || appId === "Application ID") continue;
    results.push({
      appId,
      name,
      version: version || undefined,
      origin: origin || undefined,
      installation: installation || undefined,
      installed: true,
    });
  }
  return results;
}

/**
 * Parses tab-separated output from:
 * `flatpak search --columns=application,name,description,version,remotes <query>`
 */
export function parseFlatpakSearchOutput(
  stdout: string,
  installedIds?: ReadonlySet<string>
): FlatpakAppEntry[] {
  const results: FlatpakAppEntry[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [appId, name, description, version, remotes] = line
      .split("\t")
      .map((part) => part.trim());
    if (!appId || !name || appId === "Application ID") continue;
    const origin = remotes ? remotes.split(/[,\s]+/)[0] : "flathub";
    results.push({
      appId,
      name,
      description: description || undefined,
      version: version || undefined,
      origin: origin || "flathub",
      installed: installedIds?.has(appId) ?? false,
    });
  }
  return results;
}

export async function probeFlatpakCapabilities(
  domicile: Domicile
): Promise<FlatpakCapabilities> {
  const available = await commandExists(domicile, "flatpak");
  if (!available) return { available: false, hasFlathub: false, hasUserFlathub: false };
  const [allRemotes, userRemotes] = await Promise.all([
    runText(domicile, ["flatpak", "remotes", "--columns=name"]),
    runText(domicile, ["flatpak", "remotes", "--user", "--columns=name"]),
  ]);
  const containsFlathub = (raw: string | null) =>
    Boolean(
      raw &&
        raw
          .split(/\r?\n/)
          .some((line) => line.trim().toLowerCase() === "flathub")
    );
  const hasUserFlathub = containsFlathub(userRemotes);
  const hasFlathub = hasUserFlathub || containsFlathub(allRemotes);
  return { available: true, hasFlathub, hasUserFlathub };
}

export async function ensureFlathubRemote(
  domicile: Domicile
): Promise<boolean> {
  try {
    const res = await domicile.processes.run([
      "flatpak",
      "remote-add",
      "--if-not-exists",
      "--user",
      "flathub",
      "https://dl.flathub.org/repo/flathub.flatpakrepo",
    ]);
    return res.match({
      Ok: (ran) => ran.code === 0,
      Err: () => false,
    });
  } catch {
    return false;
  }
}

export async function listInstalledFlatpaks(
  domicile: Domicile
): Promise<FlatpakAppEntry[]> {
  const out = await runText(domicile, [
    "flatpak",
    "list",
    "--app",
    "--columns=application,name,version,origin,installation",
  ]);
  if (!out) return [];
  return parseFlatpakListOutput(out);
}

interface FlathubPopularHit {
  app_id: string;
  name: string;
  summary?: string;
  icon?: string;
  main_categories?: string[];
}

const FLATHUB_POPULAR_HITS: readonly FlathubPopularHit[] = Array.isArray(
  (flathubPopularJson as { hits?: unknown }).hits
)
  ? ((flathubPopularJson as { hits: FlathubPopularHit[] }).hits)
  : [];

export function getPopularFlathubApps(
  installedIds?: ReadonlySet<string>
): FlatpakAppEntry[] {
  return FLATHUB_POPULAR_HITS.filter((h) => h.app_id && h.name).map((hit) => ({
    appId: hit.app_id,
    name: hit.name,
    description: hit.summary,
    iconUrl: hit.icon,
    mainCategories: hit.main_categories,
    origin: "flathub",
    installed: installedIds?.has(hit.app_id) ?? false,
  }));
}

async function fetchFlathubJson<T>(
  pathAndQuery: string,
  init?: RequestInit
): Promise<T | null> {
  const endpoints =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? [`/__flathub${pathAndQuery}`, `https://flathub.org/api/v2${pathAndQuery}`]
      : [`https://flathub.org/api/v2${pathAndQuery}`, `/__flathub${pathAndQuery}`];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) continue;
      return (await res.json()) as T;
    } catch {
      // try next endpoint
    }
  }
  return null;
}

export async function fetchFlathubPopular(
  installedIds?: ReadonlySet<string>
): Promise<FlatpakAppEntry[]> {
  return getPopularFlathubApps(installedIds);
}

export async function searchFlatpaks(
  domicile: Domicile,
  query: string,
  installedIds?: ReadonlySet<string>,
  signal?: AbortSignal
): Promise<FlatpakAppEntry[]> {
  const clean = query.trim();
  if (!clean) return getPopularFlathubApps(installedIds);

  const q = clean.toLowerCase();
  const localMatches = getPopularFlathubApps(installedIds).filter(
    (fp) =>
      fp.name.toLowerCase().includes(q) ||
      fp.appId.toLowerCase().includes(q) ||
      (fp.description?.toLowerCase().includes(q) ?? false)
  );

  // Try Flathub v2 search API for additional results beyond popular.
  const data = await fetchFlathubJson<{
    hits?: Array<{
      app_id?: string;
      name?: string;
      summary?: string;
      icon?: string;
      main_categories?: string[] | string;
    }>;
  }>("/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: clean, hits_per_page: 20 }),
    signal,
  });

  if (data && Array.isArray(data.hits) && data.hits.length > 0) {
    const byId = new Map<string, FlatpakAppEntry>();
    for (const m of localMatches) byId.set(m.appId, m);
    for (const hit of data.hits) {
      if (!hit.app_id || !hit.name || byId.has(hit.app_id)) continue;
      const cats = Array.isArray(hit.main_categories)
        ? hit.main_categories
        : typeof hit.main_categories === "string"
          ? [hit.main_categories]
          : undefined;
      byId.set(hit.app_id, {
        appId: hit.app_id,
        name: hit.name,
        description: hit.summary,
        iconUrl: hit.icon,
        mainCategories: cats,
        origin: "flathub",
        installed: installedIds?.has(hit.app_id) ?? false,
      });
    }
    return Array.from(byId.values());
  }

  const out = await runText(domicile, [
    "flatpak",
    "search",
    "--columns=application,name,description,version,remotes",
    clean,
  ]);
  if (out) {
    const cliMatches = parseFlatpakSearchOutput(out, installedIds);
    const byId = new Map<string, FlatpakAppEntry>();
    for (const m of localMatches) byId.set(m.appId, m);
    for (const m of cliMatches) {
      if (!byId.has(m.appId)) byId.set(m.appId, m);
    }
    return Array.from(byId.values());
  }

  return localMatches;
}

async function runStreamingFlatpakCommand(
  domicile: Domicile,
  argv: string[],
  onUpdate?: (update: FlatpakStreamUpdate) => void
): Promise<{ ok: boolean; error?: string }> {
  try {
    const launchRes = await domicile.processes.spawn(argv);
    const proc = launchRes.match({
      Ok: (p) => p,
      Err: () => null,
    });
    if (proc) {
      let lastStdoutLine = "";
      let lastStderrLine = "";

      const pumpStream = async (
        stream: ReadableStream<Uint8Array>,
        isStderr: boolean
      ) => {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let carry = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            carry += decoder.decode(value, { stream: true });
            const parts = carry.split(/[\r\n]+/);
            carry = parts.pop() ?? "";
            for (const part of parts) {
              const cleaned = cleanFlatpakOutputLine(part);
              if (!cleaned) continue;
              if (isStderr) lastStderrLine = cleaned;
              else lastStdoutLine = cleaned;
              onUpdate?.({
                line: cleaned,
                progress: parseFlatpakProgressPercent(cleaned),
              });
            }
          }
          const trailing = cleanFlatpakOutputLine(carry + decoder.decode());
          if (trailing) {
            if (isStderr) lastStderrLine = trailing;
            else lastStdoutLine = trailing;
            onUpdate?.({
              line: trailing,
              progress: parseFlatpakProgressPercent(trailing),
            });
          }
        } catch {
          // stream closed
        }
      };

      const [, , exitRes] = await Promise.all([
        pumpStream(proc.stdout, false),
        pumpStream(proc.stderr, true),
        proc.exited,
      ]);

      const exitCode = exitRes.match({
        Ok: (e) => e.code ?? 1,
        Err: () => 1,
      });

      if (exitCode === 0) {
        return { ok: true };
      }
      return {
        ok: false,
        error: lastStderrLine || lastStdoutLine || `Exit ${exitCode}`,
      };
    }
  } catch {
    // Fallback to processes.run below
  }

  try {
    const res = await domicile.processes.run(argv);
    return res.match({
      Ok: (ran) => {
        const tail = cleanFlatpakOutputLine(
          (ran.stderr || ran.stdout || "").split(/[\r\n]+/).filter(Boolean).pop() ?? ""
        );
        if (tail) {
          onUpdate?.({ line: tail, progress: parseFlatpakProgressPercent(tail) });
        }
        return ran.code === 0
          ? { ok: true }
          : { ok: false, error: tail || `Exit ${ran.code}` };
      },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function installFlatpakApp(
  domicile: Domicile,
  appId: string,
  remote = "flathub",
  onUpdate?: (update: FlatpakStreamUpdate) => void
): Promise<{ ok: boolean; error?: string }> {
  const args = [
    "flatpak",
    "install",
    "--user",
    "-y",
    "--noninteractive",
    remote,
    appId,
  ];
  return runStreamingFlatpakCommand(domicile, args, onUpdate);
}

export async function uninstallFlatpakApp(
  domicile: Domicile,
  appId: string,
  options?: {
    installation?: string;
    onUpdate?: (update: FlatpakStreamUpdate) => void;
  }
): Promise<{ ok: boolean; error?: string }> {
  const scopeFlag =
    options?.installation?.toLowerCase() === "system" ? "--system" : "--user";
  const args = [
    "flatpak",
    "uninstall",
    scopeFlag,
    "-y",
    "--noninteractive",
    appId,
  ];
  return runStreamingFlatpakCommand(domicile, args, options?.onUpdate);
}

/**
 * Launches an installed Flatpak application under Domicile's Wayland/Xwayland session.
 */
export function launchFlatpakApp(domicile: Domicile, appId: string): void {
  const cleanId = appId.trim();
  if (!cleanId) return;
  launchDesktopCommand(domicile, ["flatpak", "run", cleanId]);
}
