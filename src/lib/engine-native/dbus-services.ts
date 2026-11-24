import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { Bus } from "@domicile-desktop/sdk/system";
import { runText } from "./exec";
import type { MprisMediaInfo } from "./types";

/**
 * Power profiles (power-profiles-daemon) and media players (MPRIS) over D-Bus
 * with Domicile's `dbus` primitive: no polling, the shell hears changes as
 * signals. Same services GNOME Shell's quick settings use.
 */

type Variant = { signature?: string; value?: unknown };
type Props = Record<string, Variant | undefined>;

const PROPERTIES = "org.freedesktop.DBus.Properties";

// ---- Power profiles ---------------------------------------------------------

export type PowerProfile = "balanced" | "performance" | "power-saver";

/** power-profiles-daemon moved its name in 0.30: try the new one, then the old. */
const POWER_SERVICES = [
  { name: "org.freedesktop.UPower.PowerProfiles", path: "/org/freedesktop/UPower/PowerProfiles" },
  { name: "net.hadess.PowerProfiles", path: "/net/hadess/PowerProfiles" },
] as const;

export const asPowerProfile = (value: unknown): PowerProfile | null =>
  value === "balanced" || value === "performance" || value === "power-saver" ? value : null;

const variantValue = (v: Variant | undefined): unknown => v?.value;

/** `Properties.Get` answers `[variant]`. */
export function parsePropertyGet(body: unknown[]): unknown {
  return variantValue(body[0] as Variant | undefined);
}

/** The new `ActiveProfile` out of a `PropertiesChanged` body `[iface, changed, invalidated]`. */
export function parsePowerProfileChange(body: unknown[]): PowerProfile | null {
  const changed = body[1] as Props | undefined;
  return asPowerProfile(variantValue(changed?.ActiveProfile));
}

export async function readSystemPowerProfile(domicile: Domicile): Promise<PowerProfile | null> {
  for (const svc of POWER_SERVICES) {
    const res = await domicile.dbus
      .call({
        bus: Bus.System,
        destination: svc.name,
        path: svc.path,
        interface: PROPERTIES,
        member: "Get",
        signature: "ss",
        body: [svc.name, "ActiveProfile"],
      })
      .catch(() => null);
    const profile = res?.match({
      Ok: ({ body }) => asPowerProfile(parsePropertyGet(body)),
      Err: () => null,
    });
    if (profile) return profile;
  }
  // No daemon on the bus: the CLI answers the same question where it exists.
  return asPowerProfile((await runText(domicile, ["powerprofilesctl", "get"]))?.trim());
}

export async function setSystemPowerProfile(domicile: Domicile, profile: PowerProfile): Promise<void> {
  for (const svc of POWER_SERVICES) {
    const res = await domicile.dbus
      .call({
        bus: Bus.System,
        destination: svc.name,
        path: svc.path,
        interface: PROPERTIES,
        member: "Set",
        signature: "ssv",
        body: [svc.name, "ActiveProfile", { signature: "s", value: profile }],
      })
      .catch(() => null);
    if (res?.isOk()) return;
  }
  await runText(domicile, ["powerprofilesctl", "set", profile]);
}

/** Calls `on` now and whenever the active profile changes; returns a stop function. */
export function watchSystemPowerProfile(
  domicile: Domicile,
  on: (profile: PowerProfile) => void,
): () => void {
  let stopped = false;
  const stops: Array<() => void> = [];
  void readSystemPowerProfile(domicile).then((p) => {
    if (p && !stopped) on(p);
  });
  for (const svc of POWER_SERVICES) {
    void domicile.dbus
      .match({ bus: Bus.System, interface: PROPERTIES, member: "PropertiesChanged", path: svc.path })
      .then((res) =>
        res.match({
          Err: () => undefined,
          Ok: async ({ items, stop }) => {
            if (stopped) return stop();
            stops.push(stop);
            const reader = items.getReader();
            try {
              while (!stopped) {
                const next = await reader.read();
                if (next.done) break;
                const body = (next.value as { value?: { body?: unknown[] } }).value?.body;
                const profile = body ? parsePowerProfileChange(body) : null;
                if (profile) on(profile);
              }
            } catch {
              // the match ended
            }
          },
        }),
      )
      .catch(() => undefined);
  }
  return () => {
    stopped = true;
    for (const stop of stops) stop();
  };
}

// ---- MPRIS ------------------------------------------------------------------

const MPRIS_PREFIX = "org.mpris.MediaPlayer2.";
const MPRIS_PATH = "/org/mpris/MediaPlayer2";
const PLAYER = "org.mpris.MediaPlayer2.Player";

export interface MprisPlayerState {
  /** Bus name, e.g. `org.mpris.MediaPlayer2.firefox.instance123`. */
  busName: string;
  status: MprisMediaInfo["status"];
  title: string;
  artist: string;
}

/** `GetAll(Player)` properties to a player state, or `null` when nothing is loaded. */
export function parseMprisPlayer(busName: string, props: Props): MprisPlayerState | null {
  const rawStatus = variantValue(props.PlaybackStatus);
  const status: MprisMediaInfo["status"] =
    rawStatus === "Playing" ? "Playing" : rawStatus === "Paused" ? "Paused" : "Stopped";
  const meta = (variantValue(props.Metadata) ?? {}) as Props;
  const title = variantValue(meta["xesam:title"]);
  const artists = variantValue(meta["xesam:artist"]);
  const artist = Array.isArray(artists) ? artists.filter((a) => typeof a === "string").join(", ") : "";
  if (typeof title !== "string" && !artist) return null;
  return {
    busName,
    status,
    title: typeof title === "string" && title.trim() ? title.trim() : "Unknown Track",
    artist,
  };
}

/** Playing first, then Paused; players with nothing to show never win. */
export function pickMprisPlayer(players: readonly MprisPlayerState[]): MprisPlayerState | null {
  return (
    players.find((p) => p.status === "Playing") ?? players.find((p) => p.status === "Paused") ?? null
  );
}

/** `org.mpris.MediaPlayer2.firefox.instance123` -> `firefox`. */
export const mprisPlayerName = (busName: string): string =>
  busName.slice(MPRIS_PREFIX.length).split(".")[0] ?? "";

async function listMprisPlayers(domicile: Domicile): Promise<string[]> {
  const res = await domicile.dbus
    .call({
      bus: Bus.Session,
      destination: "org.freedesktop.DBus",
      path: "/org/freedesktop/DBus",
      interface: "org.freedesktop.DBus",
      member: "ListNames",
    })
    .catch(() => null);
  const names = res?.match({ Ok: ({ body }) => body[0], Err: () => null });
  return Array.isArray(names)
    ? names.filter((n): n is string => typeof n === "string" && n.startsWith(MPRIS_PREFIX))
    : [];
}

async function readMprisPlayer(domicile: Domicile, busName: string): Promise<MprisPlayerState | null> {
  const res = await domicile.dbus
    .call({
      bus: Bus.Session,
      destination: busName,
      path: MPRIS_PATH,
      interface: PROPERTIES,
      member: "GetAll",
      signature: "s",
      body: [PLAYER],
    })
    .catch(() => null);
  const props = res?.match({ Ok: ({ body }) => body[0] as Props | undefined, Err: () => undefined });
  return props ? parseMprisPlayer(busName, props) : null;
}

async function currentMprisPlayer(domicile: Domicile): Promise<MprisPlayerState | null> {
  const names = await listMprisPlayers(domicile);
  const states = await Promise.all(names.map((n) => readMprisPlayer(domicile, n)));
  return pickMprisPlayer(states.filter((s): s is MprisPlayerState => s !== null));
}

const toMediaInfo = (p: MprisPlayerState | null): MprisMediaInfo | null =>
  p && p.status !== "Stopped"
    ? {
        status: p.status,
        title: p.title,
        artist: p.artist || mprisPlayerName(p.busName) || "Media Player",
        playerName: mprisPlayerName(p.busName) || undefined,
      }
    : null;

export async function readMprisMediaInfo(domicile: Domicile): Promise<MprisMediaInfo | null> {
  return toMediaInfo(await currentMprisPlayer(domicile));
}

export async function controlMprisMedia(
  domicile: Domicile,
  action: "play-pause" | "next" | "previous",
): Promise<void> {
  const player = await currentMprisPlayer(domicile);
  if (!player) return;
  const member = action === "play-pause" ? "PlayPause" : action === "next" ? "Next" : "Previous";
  await domicile.dbus
    .call({ bus: Bus.Session, destination: player.busName, path: MPRIS_PATH, interface: PLAYER, member })
    .catch(() => undefined);
}

/**
 * Calls `on` now and after players appear, vanish or change; returns a stop
 * function. Property changes and name changes both just trigger a re-read.
 */
export function watchMprisMedia(
  domicile: Domicile,
  on: (info: MprisMediaInfo | null) => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stops: Array<() => void> = [];
  const refresh = () => {
    void readMprisMediaInfo(domicile).then((info) => {
      if (!stopped) on(info);
    });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  };
  const listen = (match: Parameters<Domicile["dbus"]["match"]>[0]) =>
    void domicile.dbus
      .match(match)
      .then((res) =>
        res.match({
          Err: () => undefined,
          Ok: async ({ items, stop }) => {
            if (stopped) return stop();
            stops.push(stop);
            const reader = items.getReader();
            try {
              while (!stopped) {
                const next = await reader.read();
                if (next.done) break;
                schedule();
              }
            } catch {
              // the match ended
            }
          },
        }),
      )
      .catch(() => undefined);
  listen({ bus: Bus.Session, interface: PROPERTIES, member: "PropertiesChanged", path: MPRIS_PATH });
  listen({ bus: Bus.Session, interface: "org.freedesktop.DBus", member: "NameOwnerChanged" });
  refresh();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    for (const stop of stops) stop();
  };
}
