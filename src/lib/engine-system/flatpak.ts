import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import flathubPopularJson from "@/data/flathub-popular.json";
import { commandExists, runText } from "./exec";

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
  if (!available) return { available: false, hasFlathub: false };
  const remotes = await runText(domicile, [
    "flatpak",
    "remotes",
    "--columns=name",
  ]);
  const hasFlathub = Boolean(
    remotes &&
      remotes
        .split(/\r?\n/)
        .some((line) => line.trim().toLowerCase() === "flathub")
  );
  return { available: true, hasFlathub };
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

export async function installFlatpakApp(
  domicile: Domicile,
  appId: string,
  remote = "flathub",
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean; error?: string }> {
  try {
    onProgress?.(10);
    const launchRes = await domicile.processes.spawn([
      "flatpak",
      "install",
      "--user",
      "-y",
      "--noninteractive",
      remote,
      appId,
    ]);
    const proc = launchRes.match({
      Ok: (p) => p,
      Err: () => null,
    });
    if (proc) {
      let pct = 15;
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = value ? decoder.decode(value, { stream: true }) : "";
        const match = text.match(/(\d{1,3})%/);
        if (match) {
          pct = Math.max(pct, Math.min(98, Number(match[1])));
        } else {
          pct = Math.min(95, pct + 5);
        }
        onProgress?.(pct);
      }
      onProgress?.(100);
      return { ok: true };
    }
  } catch {
    // Fallback to processes.run below
  }

  try {
    const res = await domicile.processes.run([
      "flatpak",
      "install",
      "--user",
      "-y",
      "--noninteractive",
      remote,
      appId,
    ]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0
          ? { ok: true }
          : { ok: false, error: ran.stderr || ran.stdout || `Exit ${ran.code}` },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function uninstallFlatpakApp(
  domicile: Domicile,
  appId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await domicile.processes.run([
      "flatpak",
      "uninstall",
      "--user",
      "-y",
      "--noninteractive",
      appId,
    ]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0
          ? { ok: true }
          : { ok: false, error: ran.stderr || ran.stdout || `Exit ${ran.code}` },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
