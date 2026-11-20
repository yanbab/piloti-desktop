import type { Files } from "@domicile-desktop/sdk/desktop/files";
import type {
  DiscoveredPlugin,
  PilotiPluginContext,
  PluginCommandManifest,
  PluginManifest,
} from "./types";

export const PLUGINS_REL_DIR = ".config/piloti/plugins";

async function readOptionalText(
  files: Files,
  relPath: string
): Promise<string | null> {
  try {
    const res = await files.readText(relPath);
    return res.match({
      Ok: (text) => text,
      Err: () => null,
    });
  } catch {
    return null;
  }
}

async function fileExists(files: Files, relPath: string): Promise<boolean> {
  try {
    const res = await files.stat(relPath);
    return res.match({
      Ok: (stat) => stat.fileType !== 1,
      Err: () => false,
    });
  } catch {
    return false;
  }
}

function stripExt(name: string): string {
  return name.replace(/\.(css|mjs|js)$/i, "");
}

function normalizeRelativeChild(dir: string, child: string): string {
  const clean = child.replace(/^\.?\//, "");
  return `${dir}/${clean}`;
}

export async function discoverPlugins(
  files: Files,
  enabledIds: readonly string[]
): Promise<DiscoveredPlugin[]> {
  const enabledSet = new Set(enabledIds);
  let entries: Array<{ name: string; fileType: number }> = [];
  try {
    const res = await files.readDir(PLUGINS_REL_DIR);
    entries = res.match({
      Ok: (list) => list,
      Err: () => [],
    });
  } catch {
    return [];
  }

  const discovered: DiscoveredPlugin[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    if (!entry.name || entry.name === "." || entry.name === "..") continue;
    const entryPath = `${PLUGINS_REL_DIR}/${entry.name}`;

    // Single-file plugin: foo.css or foo.js / foo.mjs (no manifest required)
    if (entry.fileType !== 1) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".css")) {
        const id = stripExt(entry.name);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        discovered.push({
          id,
          name: id,
          sourceType: "css",
          entryPath,
          stylePath: entryPath,
          hasManifest: false,
          commands: [],
          enabled: enabledSet.has(id),
        });
      } else if (lower.endsWith(".js") || lower.endsWith(".mjs")) {
        const id = stripExt(entry.name);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        discovered.push({
          id,
          name: id,
          sourceType: "js",
          entryPath,
          scriptPath: entryPath,
          hasManifest: false,
          commands: [],
          enabled: enabledSet.has(id),
        });
      }
      continue;
    }

    // Folder plugin: optional manifest.json, auto-detects style.css and index.js
    const manifestPath = `${entryPath}/manifest.json`;
    const manifestText = await readOptionalText(files, manifestPath);
    let manifest: PluginManifest | null = null;
    let parseError: string | undefined;

    if (manifestText !== null) {
      try {
        manifest = JSON.parse(manifestText) as PluginManifest;
      } catch (err) {
        parseError = `Invalid manifest.json: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }
    }

    const id = manifest?.id?.trim() || entry.name;
    if (seenIds.has(id)) continue;

    let stylePath: string | undefined;
    if (manifest?.style) {
      const candidate = normalizeRelativeChild(entryPath, manifest.style);
      if (await fileExists(files, candidate)) stylePath = candidate;
    } else if (await fileExists(files, `${entryPath}/style.css`)) {
      stylePath = `${entryPath}/style.css`;
    }

    let scriptPath: string | undefined;
    const declaredScript = manifest?.script || manifest?.main;
    if (declaredScript) {
      const candidate = normalizeRelativeChild(entryPath, declaredScript);
      if (await fileExists(files, candidate)) scriptPath = candidate;
    } else if (await fileExists(files, `${entryPath}/index.js`)) {
      scriptPath = `${entryPath}/index.js`;
    } else if (await fileExists(files, `${entryPath}/index.mjs`)) {
      scriptPath = `${entryPath}/index.mjs`;
    }

    const commands: PluginCommandManifest[] = Array.isArray(manifest?.commands)
      ? manifest.commands.filter(
          (c): c is PluginCommandManifest =>
            Boolean(c && typeof c.id === "string" && typeof c.title === "string")
        )
      : [];

    if (!manifest && !stylePath && !scriptPath && !parseError) {
      continue;
    }

    seenIds.add(id);
    discovered.push({
      id,
      name: manifest?.name?.trim() || id,
      version: manifest?.version,
      description: manifest?.description,
      sourceType: "folder",
      entryPath,
      stylePath,
      scriptPath,
      hasManifest: manifest !== null,
      commands,
      enabled: enabledSet.has(id),
      error: parseError,
    });
  }

  return discovered.sort((a, b) => a.name.localeCompare(b.name));
}

export function injectPluginCss(pluginId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLStyleElement>(
    `style[data-piloti-plugin="${CSS.escape(pluginId)}"]`
  );
  if (!el) {
    el = document.createElement("style");
    el.setAttribute("data-piloti-plugin", pluginId);
    document.head.appendChild(el);
  }
  el.textContent = cssText;
}

export function removePluginCss(pluginId: string): void {
  if (typeof document === "undefined") return;
  const el = document.head.querySelector<HTMLStyleElement>(
    `style[data-piloti-plugin="${CSS.escape(pluginId)}"]`
  );
  el?.remove();
}

export async function loadPluginScript(
  scriptText: string,
  ctx: PilotiPluginContext,
  disposables: Array<() => void>
): Promise<void> {
  const blob = new Blob([scriptText], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    const mod = (await import(/* @vite-ignore */ url)) as {
      activate?: (ctx: PilotiPluginContext) => unknown | Promise<unknown>;
      deactivate?: () => unknown;
    };
    if (typeof mod.deactivate === "function") {
      const deactivate = mod.deactivate;
      disposables.push(() => {
        try {
          deactivate();
        } catch (err) {
          console.error(`[Plugin:${ctx.pluginId}] deactivate error:`, err);
        }
      });
    }
    if (typeof mod.activate === "function") {
      await mod.activate(ctx);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
