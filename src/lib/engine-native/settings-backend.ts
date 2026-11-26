import type { Piloti } from "@/lib/engine/piloti";
import { keyfileSettingsBackend, setSettingsBackend } from "@/lib/engine/settings";
import { createDconfSettingsBackend, routeSettingsBackend, type DconfHost } from "@/lib/config/dconf-settings-backend";
import { desktopSchemaKeys } from "@/lib/config/piloti-settings-ini";
import type { SettingChange } from "@/lib/ports/settings";
import { runText } from "./exec";

const DESKTOP_ROOT = "/org/piloti/desktop/";
const DESKTOP_SCHEMA = "org.piloti.desktop";
const isDesktopSchema = (schema: string) =>
  schema === DESKTOP_SCHEMA || schema.startsWith(`${DESKTOP_SCHEMA}.`);

async function ok(piloti: Pick<Piloti, "processes">, argv: readonly string[]): Promise<boolean> {
  try {
    return (await piloti.processes.run(argv)).match({ Ok: (r) => r.code === 0, Err: () => false });
  } catch {
    return false;
  }
}

/** dconf's command line through Domicile's processes. */
export function nativeDconfHost(piloti: Pick<Piloti, "processes">): DconfHost {
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

/**
 * On Linux, when Piloti's schemas are installed (the .deb ships them), the
 * desktop settings live in dconf, seen by `gsettings` and dconf-editor; the
 * first time, settings.ini's values are copied there. Otherwise (dev build,
 * no dconf) everything stays in the keyfiles. Called before the shell renders.
 */
export async function selectNativeSettingsBackend(
  piloti: Pick<Piloti, "processes">,
  options: { home: string; exists: (path: string) => Promise<boolean> },
): Promise<"dconf" | "keyfile"> {
  // A file check, not `gsettings list-schemas` (a process, ~150 ms at start).
  const schemaDirs = [`${options.home}/.local/share`, "/usr/local/share", "/usr/share"].map(
    (dir) => `${dir}/glib-2.0/schemas/${DESKTOP_SCHEMA}.gschema.xml`,
  );
  const installed = (await Promise.all(schemaDirs.map(options.exists))).some(Boolean);
  if (!installed) return "keyfile";

  const kinds = new Map(desktopSchemaKeys().map(({ schema, key, kind }) => [`${schema}\0${key}`, kind]));
  const dconf = createDconfSettingsBackend(nativeDconfHost(piloti), {
    root: DESKTOP_ROOT,
    kindOf: (schema, key) => kinds.get(`${schema}\0${key}`),
  });
  if (!(await dconf.preload())) return "keyfile";

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
  setSettingsBackend(
    routeSettingsBackend((schema) => (isDesktopSchema(schema) ? "primary" : "fallback"), dconf, keyfile),
  );
  return "dconf";
}
