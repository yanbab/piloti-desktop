import type { Piloti } from "@/lib/engine/piloti";
import { Signal } from "@domicile-desktop/sdk/system";
import { hostFiles } from "@/lib/engine/host-files";
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
  piloti: Piloti
): Promise<FlatpakCapabilities> {
  const available = await commandExists(piloti, "flatpak");
  if (!available) return { available: false, hasFlathub: false, hasUserFlathub: false };
  const [allRemotes, userRemotes] = await Promise.all([
    runText(piloti, ["flatpak", "remotes", "--columns=name"]),
    runText(piloti, ["flatpak", "remotes", "--user", "--columns=name"]),
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
  piloti: Piloti
): Promise<boolean> {
  try {
    const res = await piloti.processes.run([
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
  piloti: Piloti
): Promise<FlatpakAppEntry[]> {
  const out = await runText(piloti, [
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

const POPULAR_FILE = "/usr/share/piloti/flathub-popular.json";
let popularHits: readonly FlathubPopularHit[] = [];

/** Reads the shipped list of popular apps (170 KB: only when the App Store opens). */
export async function loadPopularFlathubHits(piloti: Pick<Piloti, "files">): Promise<void> {
  if (popularHits.length > 0) return;
  try {
    const text = (await hostFiles(piloti).readText(POPULAR_FILE)).match({
      Ok: (t) => t,
      Err: () => "",
    });
    const hits = (JSON.parse(text) as { hits?: unknown }).hits;
    if (Array.isArray(hits)) popularHits = hits as FlathubPopularHit[];
  } catch {
    // no list: the App Store still searches Flathub online
  }
}

export function getPopularFlathubApps(
  installedIds?: ReadonlySet<string>
): FlatpakAppEntry[] {
  return popularHits.filter((h) => h.app_id && h.name).map((hit) => ({
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
  piloti: Piloti,
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

  const out = await runText(piloti, [
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
  piloti: Piloti,
  argv: string[],
  onUpdate?: (update: FlatpakStreamUpdate) => void,
  signal?: AbortSignal
): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  if (signal?.aborted) {
    return { ok: false, canceled: true, error: "Canceled" };
  }
  try {
    const launchRes = await piloti.processes.spawn(argv);
    const proc = launchRes.match({
      Ok: (p) => p,
      Err: () => null,
    });
    if (proc) {
      let canceled = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => {
        canceled = true;
        try {
          proc.kill(Signal.Term);
        } catch {
          // ignore
        }
        killTimer = setTimeout(() => {
          try {
            proc.kill(Signal.Kill);
          } catch {
            // ignore
          }
        }, 1500);
      };
      if (signal) {
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }
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

      try {
        const [, , exitRes] = await Promise.all([
          pumpStream(proc.stdout, false),
          pumpStream(proc.stderr, true),
          proc.exited,
        ]);

        const exitCode = exitRes.match({
          Ok: (e) => e.code ?? 1,
          Err: () => 1,
        });

        if (canceled) {
          return { ok: false, canceled: true, error: "Canceled" };
        }
        if (exitCode === 0) {
          return { ok: true };
        }
        return {
          ok: false,
          error: lastStderrLine || lastStdoutLine || `Exit ${exitCode}`,
        };
      } finally {
        signal?.removeEventListener("abort", onAbort);
        if (killTimer) clearTimeout(killTimer);
      }
    }
  } catch {
    // Fallback to processes.run below
  }

  try {
    const res = await piloti.processes.run(argv);
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
  piloti: Piloti,
  appId: string,
  remote = "flathub",
  onUpdate?: (update: FlatpakStreamUpdate) => void,
  signal?: AbortSignal
): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  const args = [
    "flatpak",
    "install",
    "--user",
    "-y",
    "--noninteractive",
    remote,
    appId,
  ];
  return runStreamingFlatpakCommand(piloti, args, onUpdate, signal);
}

export async function uninstallFlatpakApp(
  piloti: Piloti,
  appId: string,
  options?: {
    installation?: string;
    onUpdate?: (update: FlatpakStreamUpdate) => void;
    signal?: AbortSignal;
  }
): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
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
  return runStreamingFlatpakCommand(
    piloti,
    args,
    options?.onUpdate,
    options?.signal
  );
}

/**
 * Launches an installed Flatpak application under Domicile's Wayland/Xwayland session.
 */
export function launchFlatpakApp(piloti: Piloti, appId: string): void {
  const cleanId = appId.trim();
  if (!cleanId) return;
  launchDesktopCommand(piloti, ["flatpak", "run", cleanId]);
}

export interface FlatpakPermissionsState {
  network: boolean;
  homeFiles: boolean;
  hostFiles: boolean;
  wayland: boolean;
  audio: boolean;
  devices: boolean;
}

export const DEFAULT_FLATPAK_PERMISSIONS: FlatpakPermissionsState = {
  network: true,
  homeFiles: false,
  hostFiles: false,
  wayland: true,
  audio: true,
  devices: false,
};

function parseFlatpakPermissionLines(raw: string): Partial<FlatpakPermissionsState> {
  const result: Partial<FlatpakPermissionsState> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const tokens = trimmed
      .slice(eqIdx + 1)
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean);
    if (key === "shared") {
      if (tokens.includes("network")) result.network = true;
      if (tokens.includes("!network")) result.network = false;
    } else if (key === "sockets") {
      if (tokens.includes("wayland") || tokens.includes("fallback-x11")) result.wayland = true;
      if (tokens.includes("!wayland")) result.wayland = false;
      if (tokens.includes("pulseaudio")) result.audio = true;
      if (tokens.includes("!pulseaudio")) result.audio = false;
    } else if (key === "filesystems") {
      if (tokens.includes("home")) result.homeFiles = true;
      if (tokens.includes("!home")) result.homeFiles = false;
      if (tokens.includes("host")) result.hostFiles = true;
      if (tokens.includes("!host")) result.hostFiles = false;
    } else if (key === "devices") {
      if (tokens.includes("all")) result.devices = true;
      if (tokens.includes("!all")) result.devices = false;
    }
  }
  return result;
}

export async function getFlatpakPermissions(
  piloti: Piloti,
  appId: string
): Promise<FlatpakPermissionsState> {
  const merged: FlatpakPermissionsState = { ...DEFAULT_FLATPAK_PERMISSIONS };
  try {
    const [infoRes, overrideRes] = await Promise.all([
      piloti.processes.run(["flatpak", "info", "--show-permissions", appId]),
      piloti.processes.run(["flatpak", "override", "--user", "--show", appId]),
    ]);
    infoRes.match({
      Ok: (ran) => {
        if (ran.code === 0 && ran.stdout) {
          Object.assign(merged, parseFlatpakPermissionLines(ran.stdout));
        }
      },
      Err: () => {},
    });
    overrideRes.match({
      Ok: (ran) => {
        if (ran.code === 0 && ran.stdout) {
          Object.assign(merged, parseFlatpakPermissionLines(ran.stdout));
        }
      },
      Err: () => {},
    });
  } catch {
    // ignore in non-native environments
  }
  return merged;
}

export async function setFlatpakPermissionOverride(
  piloti: Piloti,
  appId: string,
  permission: keyof FlatpakPermissionsState,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  const flagMap: Record<keyof FlatpakPermissionsState, [string, string]> = {
    network: ["--share=network", "--unshare=network"],
    homeFiles: ["--filesystem=home", "--nofilesystem=home"],
    hostFiles: ["--filesystem=host", "--nofilesystem=host"],
    wayland: ["--socket=wayland", "--nosocket=wayland"],
    audio: ["--socket=pulseaudio", "--nosocket=pulseaudio"],
    devices: ["--device=all", "--nodevice=all"],
  };
  const flag = flagMap[permission][enabled ? 0 : 1];
  try {
    const res = await piloti.processes.run([
      "flatpak",
      "override",
      "--user",
      flag,
      appId,
    ]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0
          ? { ok: true }
          : { ok: false, error: ran.stderr?.trim() || `Exited ${ran.code}` },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export interface FlatpakUpdateEntry {
  appId: string;
  name: string;
  version?: string;
  branch?: string;
}

export interface AptUpdatePackage {
  name: string;
  currentVersion?: string;
  newVersion?: string;
  architecture?: string;
}

export async function listFlatpakUpdates(
  piloti: Piloti
): Promise<FlatpakUpdateEntry[]> {
  try {
    const res = await piloti.processes.run([
      "flatpak",
      "remote-ls",
      "--updates",
      "--columns=application,name,version,branch",
    ]);
    return res.match({
      Ok: (ran) => {
        if (ran.code !== 0 || !ran.stdout) return [];
        const entries: FlatpakUpdateEntry[] = [];
        for (const line of ran.stdout.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const cols = trimmed.split("\t").map((c) => c.trim());
          const appId = cols[0];
          if (!appId || appId.toLowerCase() === "application") continue;
          entries.push({
            appId,
            name: cols[1] || appId,
            version: cols[2] || undefined,
            branch: cols[3] || undefined,
          });
        }
        return entries;
      },
      Err: () => [],
    });
  } catch {
    return [];
  }
}

export async function updateFlatpakApp(
  piloti: Piloti,
  appId: string,
  options?: {
    onUpdate?: (update: FlatpakStreamUpdate) => void;
    signal?: AbortSignal;
  }
): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  return runStreamingFlatpakCommand(
    piloti,
    ["flatpak", "update", "-y", "--noninteractive", appId],
    options?.onUpdate,
    options?.signal
  );
}

export async function updateAllFlatpaks(
  piloti: Piloti,
  options?: {
    onUpdate?: (update: FlatpakStreamUpdate) => void;
    signal?: AbortSignal;
  }
): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  return runStreamingFlatpakCommand(
    piloti,
    ["flatpak", "update", "-y", "--noninteractive"],
    options?.onUpdate,
    options?.signal
  );
}

export function parseAptUpgradableOutput(stdout: string): AptUpdatePackage[] {
  const items: AptUpdatePackage[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Listing")) continue;
    // Example: libgtk-4-1/stable 4.14.4+ds-1 amd64 [upgradable from: 4.14.2+ds-1]
    const match = trimmed.match(
      /^([^\s/]+)\/[^\s]+\s+(\S+)\s+(\S+)(?:\s+\[upgradable from:\s*([^\]]+)\])?/i
    );
    if (match) {
      items.push({
        name: match[1],
        newVersion: match[2],
        architecture: match[3],
        currentVersion: match[4]?.trim(),
      });
    }
  }
  return items;
}

export async function listAptUpdates(
  piloti: Piloti
): Promise<AptUpdatePackage[]> {
  try {
    const res = await piloti.processes.run(["apt", "list", "--upgradable"]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0 && ran.stdout ? parseAptUpgradableOutput(ran.stdout) : [],
      Err: () => [],
    });
  } catch {
    return [];
  }
}

export async function runAptUpdateAndFlatpakRefresh(
  piloti: Piloti
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await piloti.processes.run([
      "sh",
      "-c",
      "pkexec apt update && flatpak update --appstream -y",
    ]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0
          ? { ok: true }
          : { ok: false, error: ran.stderr?.trim() || `Exited ${ran.code}` },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function runAptUpgrade(
  piloti: Piloti
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await piloti.processes.run([
      "pkexec",
      "apt",
      "upgrade",
      "-y",
    ]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0
          ? { ok: true }
          : { ok: false, error: ran.stderr?.trim() || `Exited ${ran.code}` },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Installs a local `.deb` file through apt (resolves its dependencies). Needs polkit (`pkexec`). */
export async function installDebPackage(
  piloti: Piloti,
  debPath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await piloti.processes.run(["pkexec", "apt", "install", "-y", debPath]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0
          ? { ok: true }
          : { ok: false, error: ran.stderr?.trim() || `Exited ${ran.code}` },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Installs a `.flatpakref` / `.flatpak` file for the current user. */
export async function installFlatpakFile(
  piloti: Piloti,
  filePath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await piloti.processes.run([
      "flatpak",
      "install",
      "--user",
      "-y",
      "--noninteractive",
      filePath,
    ]);
    return res.match({
      Ok: (ran) =>
        ran.code === 0
          ? { ok: true }
          : { ok: false, error: ran.stderr?.trim() || `Exited ${ran.code}` },
      Err: (err) => ({ ok: false, error: String(err) }),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
