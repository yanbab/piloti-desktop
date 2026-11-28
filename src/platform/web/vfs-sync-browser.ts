import type { VfsSync, VfsSyncMessage } from "@/core/ports/vfs-sync";
import { memoryVfsSync } from "@/core/ports/vfs-sync";

/** Kept for diagnostics (the Console listens to it) and external observers. */
export const WEB_VFS_CHANGED_DOM_EVENT = "piloti:web-vfs-changed";
const RENAMED_DOM_EVENT = "piloti:vfs-renamed";
const CHANNEL_NAME = "piloti-vfs";

export function browserVfsSync(): VfsSync {
  if (typeof window === "undefined") return memoryVfsSync();

  let channel: BroadcastChannel | null | undefined;
  const getChannel = (): BroadcastChannel | null => {
    if (channel !== undefined) return channel;
    try {
      channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
    return channel;
  };

  return {
    emit(msg) {
      if (msg.type === "changed") {
        window.dispatchEvent(
          new CustomEvent(WEB_VFS_CHANGED_DOM_EVENT, {
            detail: msg.paths ? { paths: [...msg.paths] } : {},
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent(RENAMED_DOM_EVENT, { detail: { oldPath: msg.oldPath, newPath: msg.newPath } }),
        );
      }
    },
    broadcast(msg) {
      try {
        getChannel()?.postMessage(
          msg.type === "changed"
            ? { type: "vfs-changed", paths: msg.paths }
            : { type: "vfs-renamed", oldPath: msg.oldPath, newPath: msg.newPath },
        );
      } catch {
        // ignore broadcast errors
      }
    },
    subscribe(listener) {
      const onChanged = (e: Event) => {
        const detail = (e as CustomEvent<{ paths?: readonly string[] } | undefined>).detail;
        listener({ type: "changed", paths: detail?.paths }, false);
      };
      const onRenamed = (e: Event) => {
        const d = (e as CustomEvent<{ oldPath?: string; newPath?: string }>).detail;
        if (d?.oldPath && d?.newPath) {
          listener({ type: "renamed", oldPath: d.oldPath, newPath: d.newPath }, false);
        }
      };
      const ch = getChannel();
      const onMessage = (e: MessageEvent<{ type?: string; paths?: readonly string[]; oldPath?: string; newPath?: string }>) => {
        const m = e.data;
        if (m?.type === "vfs-changed") {
          listener({ type: "changed", paths: m.paths }, true);
        } else if (m?.type === "vfs-renamed" && m.oldPath && m.newPath) {
          listener({ type: "renamed", oldPath: m.oldPath, newPath: m.newPath }, true);
        }
      };
      window.addEventListener(WEB_VFS_CHANGED_DOM_EVENT, onChanged);
      window.addEventListener(RENAMED_DOM_EVENT, onRenamed);
      ch?.addEventListener("message", onMessage);
      return () => {
        window.removeEventListener(WEB_VFS_CHANGED_DOM_EVENT, onChanged);
        window.removeEventListener(RENAMED_DOM_EVENT, onRenamed);
        ch?.removeEventListener("message", onMessage);
      };
    },
    onExternalWrite(listener) {
      const on = (e: StorageEvent) => listener(e.key);
      window.addEventListener("storage", on);
      return () => window.removeEventListener("storage", on);
    },
    get canBroadcast() {
      return getChannel() !== null;
    },
    onFlushRequested(listener) {
      const onHide = () => {
        if (document.visibilityState === "hidden") listener();
      };
      window.addEventListener("pagehide", listener);
      window.addEventListener("beforeunload", listener);
      document.addEventListener("visibilitychange", onHide);
      return () => {
        window.removeEventListener("pagehide", listener);
        window.removeEventListener("beforeunload", listener);
        document.removeEventListener("visibilitychange", onHide);
      };
    },
  } satisfies VfsSync;
}

export type { VfsSyncMessage };
