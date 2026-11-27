import type { DemoFiles } from "@/lib/ports/demo-files";
import { isTextEditableVfsFile } from "@/lib/core/file-types";
import {
  buildVfsEntryWebAppUrl,
  downloadVfsFile,
  extractVfsZip,
  getVfsEntry,
  incrementVfsAccessCount,
  subscribeWebVfs,
} from "./web-vfs";

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
};
