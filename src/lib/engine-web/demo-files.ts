import type { DemoFiles } from "@/lib/ports/demo-files";
import { isTextEditableVfsFile } from "@/lib/core/file-types";
import {
  buildVfsEntryWebAppUrl,
  compressVfsEntries,
  createVfsFileFromTemplate,
  createVfsTextFile,
  downloadVfsFile,
  extractVfsZip,
  getVfsEntry,
  importExternalFilesToVfs,
  incrementVfsAccessCount,
  listVfsDir,
  listVfsFavoriteEntries,
  listVfsRecentEntries,
  listVfsTemplates,
  resolveVfsTemplatesDir,
  subscribeWebVfs,
  writeVfsTextFile,
} from "./web-vfs";
import { WEB_VFS_TRASH } from "@/lib/core/vfs-paths";

export const webDemoFiles: DemoFiles = {
  entry: getVfsEntry,
  pageUrl: (file) =>
    file.name.toLowerCase().endsWith(".pdf") && file.content?.trimStart().startsWith("%PDF-")
      ? URL.createObjectURL(new Blob([file.content], { type: "application/pdf" }))
      : buildVfsEntryWebAppUrl(getVfsEntry(file.path)!),
  isTextEditable: isTextEditableVfsFile,
  recordAccess: (path) => void incrementVfsAccessCount(path),
  extract: async (path) => (await extractVfsZip(path)) ?? undefined,
  download: (path) => void downloadVfsFile(path),
  watchFolder: (dir, onChange) =>
    subscribeWebVfs(() => onChange(), { path: dir, mode: "children" }),
  watchAll: (onChange) => subscribeWebVfs(() => onChange()),
  list: listVfsDir,
  templates: listVfsTemplates,
  templatesDir: resolveVfsTemplatesDir,
  createFromTemplate: (dir, template) =>
    createVfsFileFromTemplate(dir, template.path) ??
    createVfsTextFile(dir, template.name, template.content ?? ""),
  importFiles: importExternalFilesToVfs,
  trashedPath: (path) =>
    listVfsDir(WEB_VFS_TRASH, { includeHidden: true })
      .filter((e) => e.trashedFromPath === path)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.path ?? null,
  favorites: listVfsFavoriteEntries,
  recents: () => listVfsRecentEntries(),
  compress: async (paths) => (await compressVfsEntries(paths))?.path ?? null,
  writeText: (path, text) => void writeVfsTextFile(path, text),
};
