import type { Files } from "@domicile-desktop/sdk/desktop/files";
import type {
  DiscoveredPlugin,
  PilotiPluginContext,
  PluginCommandManifest,
  PluginManifest,
  PluginWallpaperManifest,
} from "./types";

export const PLUGINS_REL_DIR = ".config/piloti/plugins";
export const SYSTEM_PLUGINS_DIR = "/usr/share/piloti/plugins";

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
  const roots: Array<{ dir: string; scope: "user" | "system" }> = [
    { dir: PLUGINS_REL_DIR, scope: "user" },
    { dir: SYSTEM_PLUGINS_DIR, scope: "system" },
  ];

  const discovered: DiscoveredPlugin[] = [];
  const seenIds = new Set<string>();

  for (const { dir: rootDir, scope } of roots) {
    let entries: Array<{ name: string; fileType: number }> = [];
    try {
      const res = await files.readDir(rootDir);
      entries = res.match({
        Ok: (list) => list,
        Err: () => [],
      });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.name || entry.name === "." || entry.name === "..") continue;
      const entryPath = `${rootDir}/${entry.name}`;

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
            scope,
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
            scope,
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

      let gtk4StylePath: string | undefined;
      if (manifest?.gtk4Style) {
        const candidate = normalizeRelativeChild(entryPath, manifest.gtk4Style);
        if (await fileExists(files, candidate)) gtk4StylePath = candidate;
      } else if (await fileExists(files, `${entryPath}/gtk4.css`)) {
        gtk4StylePath = `${entryPath}/gtk4.css`;
      } else if (await fileExists(files, `${entryPath}/gtk-4.0/gtk.css`)) {
        gtk4StylePath = `${entryPath}/gtk-4.0/gtk.css`;
      }

      let gtk3StylePath: string | undefined;
      if (manifest?.gtk3Style) {
        const candidate = normalizeRelativeChild(entryPath, manifest.gtk3Style);
        if (await fileExists(files, candidate)) gtk3StylePath = candidate;
      } else if (await fileExists(files, `${entryPath}/gtk3.css`)) {
        gtk3StylePath = `${entryPath}/gtk3.css`;
      } else if (await fileExists(files, `${entryPath}/gtk-3.0/gtk.css`)) {
        gtk3StylePath = `${entryPath}/gtk-3.0/gtk.css`;
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

      const wallpapers: PluginWallpaperManifest[] = Array.isArray(
        manifest?.wallpapers
      )
        ? manifest.wallpapers
            .filter(
              (w): w is PluginWallpaperManifest =>
                Boolean(
                  w && typeof w.id === "string" && typeof w.name === "string"
                )
            )
            .map((w) => ({
              ...w,
              ...(w.style
                ? { style: normalizeRelativeChild(entryPath, w.style) }
                : {}),
              ...(w.darkStyle
                ? { darkStyle: normalizeRelativeChild(entryPath, w.darkStyle) }
                : {}),
              ...(w.html
                ? { html: normalizeRelativeChild(entryPath, w.html) }
                : {}),
              ...(w.darkHtml
                ? { darkHtml: normalizeRelativeChild(entryPath, w.darkHtml) }
                : {}),
              ...(w.image
                ? { image: normalizeRelativeChild(entryPath, w.image) }
                : {}),
              ...(w.darkImage
                ? { darkImage: normalizeRelativeChild(entryPath, w.darkImage) }
                : {}),
            }))
        : [];

      if (
        !manifest &&
        !stylePath &&
        !gtk4StylePath &&
        !gtk3StylePath &&
        !scriptPath &&
        wallpapers.length === 0 &&
        !parseError
      ) {
        continue;
      }

      seenIds.add(id);
      discovered.push({
        id,
        name: manifest?.name?.trim() || id,
        kind: manifest?.type === "theme" ? "theme" : "plugin",
        scope,
        version: manifest?.version,
        description: manifest?.description,
        sourceType: "folder",
        entryPath,
        stylePath,
        gtk4StylePath,
        gtk3StylePath,
        scriptPath,
        hasManifest: manifest !== null,
        commands,
        ...(wallpapers.length > 0 ? { wallpapers } : {}),
        enabled: enabledSet.has(id),
        error: parseError,
      });
    }
  }

  return discovered.sort((a, b) => a.name.localeCompare(b.name));
}

/** Plugin stylesheets written before the `--adw-*` names became `--shell-*`:
 *  rewritten so both reading and overriding a token still work. */
export function upgradeLegacyCssNames(cssText: string): string {
  return cssText.replace(/(--|\.|data-slot="?)adw-/g, "$1shell-");
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
  el.textContent = upgradeLegacyCssNames(cssText);
}

export function removePluginCss(pluginId: string): void {
  if (typeof document === "undefined") return;
  const el = document.head.querySelector<HTMLStyleElement>(
    `style[data-piloti-plugin="${CSS.escape(pluginId)}"]`
  );
  el?.remove();
}

const MANAGED_GTK_CSS_START = "/* BEGIN PILOTI MANAGED GTK CSS */";
const MANAGED_GTK_CSS_END = "/* END PILOTI MANAGED GTK CSS */";

export function mergeManagedGtkCss(
  existingText: string,
  blocks: ReadonlyArray<{ id: string; css: string }>
): string {
  const startIdx = existingText.indexOf(MANAGED_GTK_CSS_START);
  const endIdx = existingText.indexOf(MANAGED_GTK_CSS_END);
  const preserved =
    startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx
      ? (
          existingText.slice(0, startIdx) +
          existingText.slice(endIdx + MANAGED_GTK_CSS_END.length)
        ).trimEnd()
      : existingText.trimEnd();

  const nonEmptyBlocks = blocks
    .map((b) => ({ id: b.id, css: b.css.trim() }))
    .filter((b) => b.css.length > 0);
  if (nonEmptyBlocks.length === 0) {
    return preserved ? `${preserved}\n` : "";
  }

  const managedBody = nonEmptyBlocks
    .map((b) => `/* Theme/Plugin: ${b.id} */\n${b.css}`)
    .join("\n\n");
  const managedSection = `${MANAGED_GTK_CSS_START}\n${managedBody}\n${MANAGED_GTK_CSS_END}\n`;
  return preserved ? `${preserved}\n\n${managedSection}` : managedSection;
}

export async function syncManagedGtkCssFile(
  files: Files,
  relDir: string,
  blocks: ReadonlyArray<{ id: string; css: string }>
): Promise<void> {
  const filePath = `${relDir}/gtk.css`;
  const existing = (await readOptionalText(files, filePath)) ?? "";
  const next = mergeManagedGtkCss(existing, blocks);
  if (next === existing) return;
  if (!next && !existing) return;
  if (next) {
    await files.createDir(".config").catch(() => undefined);
    await files.createDir(relDir).catch(() => undefined);
  }
  await files.write(filePath, next);
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

