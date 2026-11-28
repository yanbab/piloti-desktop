import type { Piloti } from "@/platform/shared/piloti";
import { keyfileSettingsBackend, setSettingsBackend } from "@/core/state/settings";
import { createDconfSettingsBackend, routeSettingsBackend, type DconfHost } from "@/core/config/dconf-settings-backend";
import { GSETTINGS_LINKS_PATH, linkSettingsBackend, parseGSettingsLinks } from "@/core/config/gsettings-links";
import { desktopSchemaKeys } from "@/core/config/piloti-settings-ini";
import type { SettingChange, SettingsBackend } from "@/core/ports/settings";
import { runText } from "./exec";

/** An app module has no `launch`. */
type ProcessHost = { processes: Pick<Piloti["processes"], "run" | "spawn"> };

const DESKTOP_ROOT = "/org/piloti/desktop/";
const DESKTOP_SCHEMA = "org.piloti.desktop";
const isDesktopSchema = (schema: string) =>
  schema === DESKTOP_SCHEMA || schema.startsWith(`${DESKTOP_SCHEMA}.`);

async function ok(piloti: ProcessHost, argv: readonly string[]): Promise<boolean> {
  try {
    return (await piloti.processes.run(argv)).match({ Ok: (r) => r.code === 0, Err: () => false });
  } catch {
    return false;
  }
}

/** dconf's command line through Domicile's processes. */
export function nativeDconfHost(piloti: ProcessHost): DconfHost {
  return {
    dump: (dir) => runText(piloti, ["dconf", "dump", dir]),
    // `run` has no stdin: the text goes through sh as an argument, unquoted.
    load: (dir, keyfile) =>
      ok(piloti, ["sh", "-c", 'printf "%s" "$1" | dconf load "$2"', "sh", keyfile, dir]),
    reset: (path) => ok(piloti, ["dconf", "reset", path]),
    read: async (path) => {
      const out = await runText(piloti, ["dconf", "read", path]);
      return out === null || out.trim() === "" ? null : out.trim();
    },
    watch(dir, onPath) {
      let stopped = false;
      let kill: (() => void) | undefined;
      void (async () => {
        try {
          const proc = (await piloti.processes.spawn(["dconf", "watch", dir])).match({
            Ok: (p) => p,
            Err: () => undefined,
          });
          if (!proc) return;
          if (stopped) return proc.kill();
          kill = () => proc.kill();
          const reader = proc.stdout.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!stopped) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";
            for (const line of lines) if (line.startsWith("/")) onPath(line.trim());
          }
        } catch {
          // no dconf watch: changes made elsewhere apply at next start
        }
      })();
      return () => {
        stopped = true;
        kill?.();
      };
    },
  };
}

const GNOME_ROOT = "/org/gnome/desktop/";

type Options = {
  home: string;
  exists: (path: string) => Promise<boolean>;
  readText: (path: string) => Promise<string | null>;
};

/**
 * Where the desktop settings live on Linux, then the GNOME keys they are linked
 * to (`gsettings-links.ini`). Called before the shell renders.
 */
export async function selectNativeSettingsBackend(
  piloti: ProcessHost,
  options: Options,
): Promise<"dconf" | "keyfile"> {
  // Each reads dconf with its own process: both at once.
  const [own, link] = await Promise.all([
    desktopBackend(piloti, options),
    gnomeLinks(piloti, options.readText),
  ]);
  const backend = own ?? keyfileSettingsBackend();
  setSettingsBackend(link?.(backend) ?? backend);
  return own ? "dconf" : "keyfile";
}

/**
 * The same for an app module, which only reads: dconf and its links, or `null`
 * without Piloti's schema. Copying settings.ini there is the shell's job.
 */
export async function loadNativeDesktopBackend(
  piloti: ProcessHost,
  options: Options,
): Promise<SettingsBackend | null> {
  const [own, link] = await Promise.all([
    installedDconf(piloti, options),
    gnomeLinks(piloti, options.readText),
  ]);
  return own ? (link?.(own) ?? own) : null;
}

/** Adds the linked keys to a backend; null without the list or without dconf. */
async function gnomeLinks(
  piloti: ProcessHost,
  readText: Options["readText"],
): Promise<((base: SettingsBackend) => SettingsBackend) | null> {
  const text = await readText(GSETTINGS_LINKS_PATH).catch(() => null);
  const links = text ? parseGSettingsLinks(text) : [];
  if (links.length === 0) return null;
  const kinds = new Map(links.map(({ target }) => [`${target.schema}\0${target.key}`, target.kind]));
  const gnome = createDconfSettingsBackend(nativeDconfHost(piloti), {
    root: GNOME_ROOT,
    kindOf: (schema, key) => kinds.get(`${schema}\0${key}`),
  });
  if (!(await gnome.preload())) return null;
  return (base) =>
    linkSettingsBackend({
      base,
      gnome,
      links,
      toggle: { schema: `${DESKTOP_SCHEMA}.system`, key: "sync-gnome-settings" },
    });
}

/** Piloti's dconf settings, if its schema is installed (the .deb ships it). */
async function installedDconf(piloti: ProcessHost, options: Options) {
  // A file check, not `gsettings list-schemas` (a process, ~150 ms at start).
  const schemaDirs = [`${options.home}/.local/share`, "/usr/local/share", "/usr/share"].map(
    (dir) => `${dir}/glib-2.0/schemas/${DESKTOP_SCHEMA}.gschema.xml`,
  );
  const installed = (await Promise.all(schemaDirs.map(options.exists))).some(Boolean);
  if (!installed) return null;

  const kinds = new Map(desktopSchemaKeys().map(({ schema, key, kind }) => [`${schema}\0${key}`, kind]));
  const dconf = createDconfSettingsBackend(nativeDconfHost(piloti), {
    root: DESKTOP_ROOT,
    kindOf: (schema, key) => kinds.get(`${schema}\0${key}`),
  });
  if (!(await dconf.preload())) return null;
  return dconf;
}

/**
 * When Piloti's schema is installed, the desktop
 * settings live in dconf, seen by `gsettings` and dconf-editor; the first time,
 * settings.ini's values are copied there. Otherwise (dev build, no dconf),
 * null: everything stays in the keyfiles.
 */
async function desktopBackend(
  piloti: ProcessHost,
  options: Options,
): Promise<SettingsBackend | null> {
  const dconf = await installedDconf(piloti, options);
  if (!dconf) return null;

  const keyfile = keyfileSettingsBackend();
  const nothingSet = desktopSchemaKeys().every(({ schema, key }) => dconf.read(schema, key) === undefined);
  if (nothingSet) {
    const fromFile: SettingChange[] = [];
    for (const { schema, key } of desktopSchemaKeys()) {
      const value = keyfile.read(schema, key);
      if (value !== undefined) fromFile.push({ schema, key, value });
    }
    if (fromFile.length > 0) {
      dconf.writeBatch(fromFile);
      await dconf.flushNow();
      console.info(`[piloti] settings: copied ${fromFile.length} keys from settings.ini to dconf`);
    }
  }
  return routeSettingsBackend((schema) => (isDesktopSchema(schema) ? "primary" : "fallback"), dconf, keyfile);
}
