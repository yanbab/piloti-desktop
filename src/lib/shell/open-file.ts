import { isTextEditableVfsFile } from "@/lib/engine-web/web-vfs";
import { parseLinkFile } from "@/lib/shell/link-files";
import {
  inferMimeType,
  type MimeAppOption,
  type MimeAppsConfig,
  resolveAppsForMime,
} from "@/lib/xdg/xdg-mimeapps";
import { parseDesktopEntry, type XdgDesktopEntry } from "@/lib/xdg/xdg-desktop-entry";

/** What opening a file should do. Pure data: `useOpenPath` performs it. */
export type OpenAction =
  | { type: "folder"; path: string }
  /** A built-in shell app (Notepad, Image Viewer, Web Browser, …) with the file as payload. */
  | { type: "app"; appId: string; path: string }
  /** An installed application (.deb, Flatpak, web app, …) launched with the file. */
  | { type: "xdg"; entry: XdgDesktopEntry; path: string }
  /** A web page. */
  | { type: "url"; url: string }
  /** A link file whose target is a local path or `file://` URL: open that instead. */
  | { type: "path"; path: string }
  /** An `.desktop` application launcher file: run the application it describes. */
  | { type: "launch-entry"; entry: XdgDesktopEntry }
  | { type: "extract"; path: string }
  /** A `.deb` / `.flatpakref` file: hand over to the App Store to install. */
  | { type: "install-package"; path: string; format: "deb" | "flatpak" }
  /** No installed app: show it in the web viewer (PDF, audio, video…). */
  | { type: "web-file"; path: string };

export interface ResolveOpenInput {
  path: string;
  name: string;
  kind: "file" | "directory";
  /** Text content (browser VFS / small files); absent for native files. */
  content?: string;
  mimeType?: string;
  config: MimeAppsConfig;
  installed?: readonly XdgDesktopEntry[];
  /** The user chose this application explicitly ("Open With"). */
  preferApp?: MimeAppOption;
  homeDir?: string;
}

export function actionForApp(app: MimeAppOption, path: string): OpenAction {
  if (app.builtinAppId) return { type: "app", appId: app.builtinAppId, path };
  if (app.entry) return { type: "xdg", entry: app.entry, path };
  return { type: "app", appId: app.appId, path };
}

function isImageName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(name);
}

/** Decides how to open a file or folder (no side effects). */
export function resolveOpenAction(input: ResolveOpenInput): OpenAction {
  const { path, name, kind, content, config, installed, preferApp } = input;
  if (kind === "directory") {
    return preferApp ? actionForApp(preferApp, path) : { type: "folder", path };
  }
  if (preferApp) return actionForApp(preferApp, path);

  const link = parseLinkFile(name, content);
  if (link) {
    if (/^(https?|ftp):\/\//i.test(link.url)) return { type: "url", url: link.url };
    return { type: "path", path: link.url };
  }

  if (/\.desktop$/i.test(name) && content) {
    const entry = parseDesktopEntry(content, { filePath: path });
    if (entry && entry.type === "Application" && entry.execArgv.length > 0) {
      return { type: "launch-entry", entry };
    }
  }

  const mime = input.mimeType ?? inferMimeType(name, "file");
  if (mime === "application/zip") return { type: "extract", path };
  if (mime === "application/vnd.debian.binary-package") {
    return { type: "install-package", path, format: "deb" };
  }
  if (mime === "application/vnd.flatpak.ref" || mime === "application/vnd.flatpak") {
    return { type: "install-package", path, format: "flatpak" };
  }

  const apps = resolveAppsForMime(mime, config, installed);
  const first = apps[0];
  if (first) return actionForApp(first, path);

  if (isImageName(name)) return { type: "app", appId: "image-viewer", path };
  if (isTextEditableVfsFile(name)) return { type: "app", appId: "text-editor", path };
  return { type: "web-file", path };
}
