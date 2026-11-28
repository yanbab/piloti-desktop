/**
 * Puts the demo's storage behind the shared file, state and emblem APIs.
 * Imported first by `piloti-web.tsx` (and the tests), before a module reads them.
 */
import { setEmblemStorage } from "@/platform/shared/emblems";
import { setDefaultStateSource } from "@/core/state/vfs-state";
import { setDemoFiles } from "@/core/ports/demo-files";
import { setDemoUsb } from "@/core/ports/demo-usb";
import { setVfsInspector } from "@/core/ports/vfs-inspector";
import { webDemoFiles } from "./demo-files";
import { browserStateSource } from "./state-source";
import { webDemoUsb } from "./usb-drive";
import {
  getVfsSnapshotEntries,
  getWebVfsPerfStats,
  listWebVfsBackingStorageEntries,
  resetWebVfsPerfStats,
  webEmblemStorage,
  WEB_VFS_CHANGED_EVENT,
} from "./web-vfs";

setDemoFiles(webDemoFiles);
setDemoUsb(webDemoUsb);
setEmblemStorage(webEmblemStorage);
setDefaultStateSource(browserStateSource);
setVfsInspector({
  changedEvent: WEB_VFS_CHANGED_EVENT,
  entries: getVfsSnapshotEntries,
  backingStorage: listWebVfsBackingStorageEntries,
  stats: getWebVfsPerfStats,
  resetStats: resetWebVfsPerfStats,
});
