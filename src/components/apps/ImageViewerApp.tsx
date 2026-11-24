import { VFS_HOME } from "@/lib/engine/vfs-home";
import * as React from "react";
import { emitShellEvent, onShellEvent } from "@/lib/shell/shell-events";
import {
  CheckIcon,
  CropIcon,
  Maximize2Icon,
  RotateCcwIcon,
  RotateCwIcon,
  SaveIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { useIsolatedAppBridge } from "@/lib/engine/app-bridge";
import { toDomicilePath } from "@/lib/engine/fs-bridge";
import { readVfsStateJson, writeVfsStateJson } from "@/lib/engine/vfs-state";
import { shouldConfirmUnsavedOnClose } from "@/lib/config/piloti-ini";
import { isBrowserDevRuntime } from "@/context/SettingsContext";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import {
  getVfsEntry,
  normalizeVfsPath,
  renameVfsEntry,
  subscribeVfsRenamed,
} from "@/lib/engine-web/web-vfs";

export interface ImageViewerAppProps {
  initialPath?: string;
  windowId?: string;
  isCsd?: boolean;
}

const IMAGE_VIEWER_STATE_PATH = `${VFS_HOME}/.local/state/piloti/image-viewer-state.json`;
/** Skip persisting unsaved crops larger than this (data URL chars) to keep state files small. */
const MAX_PERSISTED_CROP_CHARS = 3_000_000;
const MAX_PERSISTED_FILES = 200;

interface PersistedImageViewState {
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  /** Unsaved cropped version (PNG data URL). */
  unsavedCrop?: string;
  updatedAt: number;
}

type PersistedImageViewStateMap = Record<string, PersistedImageViewState>;

function readImageViewStateMap(): PersistedImageViewStateMap {
  return (
    readVfsStateJson<PersistedImageViewStateMap>(
      IMAGE_VIEWER_STATE_PATH,
      undefined,
      (val): val is PersistedImageViewStateMap =>
        Boolean(val && typeof val === "object" && !Array.isArray(val)),
    ) ?? {}
  );
}

function isLocalImagePath(path: string): boolean {
  return path.startsWith("/");
}

export const ImageViewerApp: React.FC<ImageViewerAppProps> = ({
  initialPath,
  windowId = "",
  isCsd: propIsCsd = true,
}) => {
  const [dragRegionHovered, setDragRegionHovered] = React.useState(false);
  const resolvedPath = React.useMemo(() => {
    if (initialPath) return initialPath;
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("path") ?? "";
    }
    return "";
  }, [initialPath]);
  const [activePath, setActivePath] = React.useState(resolvedPath);
  React.useEffect(() => {
    setActivePath(resolvedPath);
  }, [resolvedPath]);

  const handleShellAction = React.useCallback((actionId: string) => {
    if (actionId === "piloti:header-enter") setDragRegionHovered(true);
    else if (actionId === "piloti:header-leave") setDragRegionHovered(false);
    else if (actionId.startsWith("piloti:open-path:")) {
      setActivePath(actionId.slice("piloti:open-path:".length));
    }
  }, []);
  const bridge = useIsolatedAppBridge(windowId, propIsCsd, handleShellAction);

  const [imageSrc, setImageSrc] = React.useState<string>(() => {
    if (!resolvedPath) return "";
    if (
      resolvedPath.startsWith("data:") ||
      resolvedPath.startsWith("http://") ||
      resolvedPath.startsWith("https://") ||
      resolvedPath.startsWith("blob:")
    ) {
      return resolvedPath;
    }
    if (typeof window !== "undefined" && window.parent === window) {
      const entry = getVfsEntry(resolvedPath);
      const content = entry?.kind === "file" ? (entry.content ?? "") : "";
      if (!content) return "";
      if (content.startsWith("data:image/")) return content;
      if (resolvedPath.toLowerCase().endsWith(".svg")) {
        return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
      }
      return content;
    }
    return "";
  });
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [rotation, setRotation] = React.useState(0);
  const [cropping, setCropping] = React.useState(false);
  const [cropRect, setCropRect] = React.useState({
    x: 15,
    y: 15,
    w: 70,
    h: 70,
  });
  const [croppedDataUrl, setCroppedDataUrl] = React.useState<string | null>(
    null,
  );
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState("");
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const panDragRef = React.useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const cropDragRef = React.useRef<{
    startX: number;
    startY: number;
    rect: DOMRect;
  } | null>(null);

  // Spatial state: restore zoom / pan / rotation / unsaved crop for this file.
  const restoredPathRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const persisted = isLocalImagePath(activePath)
      ? readImageViewStateMap()[normalizeVfsPath(activePath)]
      : undefined;
    setPan({ x: persisted?.panX ?? 0, y: persisted?.panY ?? 0 });
    setZoom(persisted?.zoom ?? 1);
    setRotation(persisted?.rotation ?? 0);
    setCroppedDataUrl(persisted?.unsavedCrop ?? null);
    restoredPathRef.current = activePath;
  }, [activePath]);

  React.useEffect(() => {
    if (!activePath) return;
    if (
      activePath.startsWith("data:") ||
      activePath.startsWith("http://") ||
      activePath.startsWith("https://") ||
      activePath.startsWith("blob:")
    ) {
      setImageSrc(activePath);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    type NativeFiles = {
      read: (p: string) => Promise<{
        match: <R>(h: { Ok: (v: Uint8Array) => R; Err: () => R }) => R;
      }>;
    };
    const nativeFiles =
      window.parent === window && !isBrowserDevRuntime()
        ? (window as unknown as {
            __PILOTI__?: { domicile?: { files?: NativeFiles } };
          }).__PILOTI__?.domicile?.files
        : undefined;
    if (nativeFiles && !activePath.toLowerCase().endsWith(".svg")) {
      // Native Linux: images are real binary files, so load bytes into a Blob URL.
      void nativeFiles
        .read(toDomicilePath(activePath))
        .then((res) => {
          const bytes = res.match({
            Ok: (b) => (b.length > 0 ? b : null),
            Err: () => null,
          });
          if (cancelled || !bytes) return;
          const ext = activePath.split(".").pop()?.toLowerCase() ?? "png";
          const mime =
            ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "gif"
                ? "image/gif"
                : ext === "webp"
                  ? "image/webp"
                  : "image/png";
          objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(bytes)], { type: mime }),
          );
          setImageSrc(objectUrl);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    void bridge.fs.readText(activePath).then((content) => {
      if (cancelled || !content) return;
      if (content.startsWith("data:image/")) {
        setImageSrc(content);
      } else if (activePath.toLowerCase().endsWith(".svg")) {
        setImageSrc(`data:image/svg+xml;utf8,${encodeURIComponent(content)}`);
      } else {
        setImageSrc(content);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activePath, bridge.fs]);

  const activeSrc = croppedDataUrl ?? imageSrc;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
    setZoom((prev) =>
      Math.max(0.15, Math.min(12, Number((prev * factor).toFixed(3)))),
    );
  };

  const applyCrop = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      setCropping(false);
      return;
    }
    const sx = Math.round((cropRect.x / 100) * img.naturalWidth);
    const sy = Math.round((cropRect.y / 100) * img.naturalHeight);
    const sw = Math.max(1, Math.round((cropRect.w / 100) * img.naturalWidth));
    const sh = Math.max(1, Math.round((cropRect.h / 100) * img.naturalHeight));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      try {
        setCroppedDataUrl(canvas.toDataURL("image/png"));
      } catch {
        // ignore tainted canvas
      }
    }
    setCropping(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const resetView = React.useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setCroppedDataUrl(null);
    setCropping(false);
    setCropRect({ x: 15, y: 15, w: 70, h: 70 });
  }, []);

  const canSave = Boolean(
    (croppedDataUrl || rotation !== 0) && activePath.startsWith("/"),
  );

  const handleSave = React.useCallback(async () => {
    const img = imgRef.current;
    if (!img || !activePath.startsWith("/")) return;
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return;

    const normRot = ((rotation % 360) + 360) % 360;
    const swap = normRot === 90 || normRot === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? natH : natW;
    canvas.height = swap ? natW : natH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normRot * Math.PI) / 180);
    ctx.drawImage(img, -natW / 2, -natH / 2, natW, natH);
    try {
      const nextDataUrl = canvas.toDataURL("image/png");
      let ok = false;
      const isBrowser = isBrowserDevRuntime();
      const domicileFiles = !isBrowser
        ? (window as unknown as {
            __PILOTI__?: {
              domicile?: {
                files?: { write: (p: string, d: Uint8Array | string) => Promise<unknown> };
              };
            };
          }).__PILOTI__?.domicile?.files
        : undefined;
      if (domicileFiles) {
        const b64 = nextDataUrl.split(",")[1] ?? "";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) {
          bytes[i] = bin.charCodeAt(i);
        }
        await domicileFiles.write(toDomicilePath(activePath), bytes);
        ok = true;
      } else {
        ok = await bridge.fs.writeText(activePath, nextDataUrl);
      }
      if (ok) {
        setImageSrc(nextDataUrl);
        setCroppedDataUrl(null);
        setRotation(0);
      }
    } catch {
      // ignore tainted canvas
    }
  }, [activePath, bridge.fs, rotation]);

  const viewStateRef = React.useRef({ activePath, zoom, pan, rotation, croppedDataUrl });
  viewStateRef.current = { activePath, zoom, pan, rotation, croppedDataUrl };

  const persistViewStateNow = React.useCallback(() => {
    const cur = viewStateRef.current;
    if (!isLocalImagePath(cur.activePath) || restoredPathRef.current !== cur.activePath) return;
    const key = normalizeVfsPath(cur.activePath);
    const map = readImageViewStateMap();
    const isDefault =
      cur.zoom === 1 && cur.pan.x === 0 && cur.pan.y === 0 && cur.rotation === 0 && !cur.croppedDataUrl;
    if (isDefault) {
      if (!map[key]) return;
      delete map[key];
    } else {
      map[key] = {
        zoom: cur.zoom,
        panX: Math.round(cur.pan.x),
        panY: Math.round(cur.pan.y),
        rotation: cur.rotation,
        ...(cur.croppedDataUrl && cur.croppedDataUrl.length <= MAX_PERSISTED_CROP_CHARS
          ? { unsavedCrop: cur.croppedDataUrl }
          : {}),
        updatedAt: Date.now(),
      };
    }
    const keys = Object.keys(map);
    if (keys.length > MAX_PERSISTED_FILES) {
      keys
        .sort((a, b) => (map[a]?.updatedAt ?? 0) - (map[b]?.updatedAt ?? 0))
        .slice(0, keys.length - MAX_PERSISTED_FILES)
        .forEach((k) => delete map[k]);
    }
    writeVfsStateJson(IMAGE_VIEWER_STATE_PATH, map, false);
  }, []);

  // Debounced: pan/zoom change at pointer/wheel rate.
  React.useEffect(() => {
    if (restoredPathRef.current !== activePath) return;
    const timer = window.setTimeout(persistViewStateNow, 400);
    return () => window.clearTimeout(timer);
  }, [activePath, croppedDataUrl, pan, persistViewStateNow, rotation, zoom]);

  React.useEffect(() => {
    window.addEventListener("beforeunload", persistViewStateNow);
    return () => {
      window.removeEventListener("beforeunload", persistViewStateNow);
      persistViewStateNow();
    };
  }, [persistViewStateNow]);

  const [confirmCloseOpen, setConfirmCloseOpen] = React.useState(false);
  const dirtyRef = React.useRef(false);
  dirtyRef.current = canSave;
  const forceCloseRef = React.useRef(false);
  const performClose = React.useCallback(() => {
    persistViewStateNow();
    if (window.parent === window) {
      emitShellEvent("piloti:request-animated-close", { windowId: windowId });
    } else {
      bridge.closeWindow();
    }
  }, [bridge, persistViewStateNow, windowId]);
  const requestClose = React.useCallback(() => {
    if (dirtyRef.current && !forceCloseRef.current && shouldConfirmUnsavedOnClose()) {
      setConfirmCloseOpen(true);
      return;
    }
    performClose();
  }, [performClose]);

  React.useEffect(() => {
    if (!windowId) return;
    const onBeforeClose = (
      detail: { windowId: string },
      e: CustomEvent<{ windowId: string }>,
    ) => {
      if (detail?.windowId !== windowId) return;
      if (dirtyRef.current && !forceCloseRef.current && shouldConfirmUnsavedOnClose()) {
        e.preventDefault();
        setConfirmCloseOpen(true);
        return;
      }
      persistViewStateNow();
    };
    return onShellEvent("piloti:before-close-window", onBeforeClose);
  }, [persistViewStateNow, windowId]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (canSave) {
          e.preventDefault();
          void handleSave();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(12, Number((z * 1.25).toFixed(2))));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(0.15, Number((z / 1.25).toFixed(2))));
      } else if (e.key === "0") {
        e.preventDefault();
        resetView();
      } else if (e.key === "r") {
        e.preventDefault();
        setRotation((r) => (r + 90) % 360);
      } else if (e.key === "R") {
        e.preventDefault();
        setRotation((r) => (r + 270) % 360);
      } else if (e.key === "Escape" && cropping) {
        e.preventDefault();
        setCropRect({ x: 15, y: 15, w: 70, h: 70 });
        setCropping(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSave, cropping, handleSave, resetView]);

  const fileName = activePath
    ? (activePath.split("/").filter(Boolean).pop() ?? _("Image Viewer"))
    : _("Image Viewer");

  const isRenameableVfsFile =
    Boolean(activePath) &&
    !activePath.startsWith("data:") &&
    !activePath.startsWith("http://") &&
    !activePath.startsWith("https://") &&
    !activePath.startsWith("blob:");

  React.useEffect(() => {
    if (!isRenameableVfsFile) return;
    return subscribeVfsRenamed(({ oldPath, newPath }) => {
      if (normalizeVfsPath(activePath) === normalizeVfsPath(oldPath)) {
        const map = readImageViewStateMap();
        const prev = map[normalizeVfsPath(oldPath)];
        if (prev) {
          delete map[normalizeVfsPath(oldPath)];
          map[normalizeVfsPath(newPath)] = prev;
          writeVfsStateJson(IMAGE_VIEWER_STATE_PATH, map, false);
        }
        setActivePath(newPath);
        const nextName = newPath.split("/").filter(Boolean).pop();
        if (nextName) bridge.setTitle(nextName);
      }
    });
  }, [activePath, bridge, isRenameableVfsFile]);

  const commitTitleRename = React.useCallback(() => {
    setEditingTitle(false);
    if (!isRenameableVfsFile) return;
    const nextName = draftTitle.trim().replace(/[/\\]/g, "");
    if (!nextName || nextName === fileName) return;
    const renamed = renameVfsEntry(activePath, nextName);
    if (renamed) {
      setActivePath(renamed.path);
      bridge.setTitle(renamed.name);
    }
  }, [activePath, bridge, draftTitle, fileName, isRenameableVfsFile]);

  React.useEffect(() => {
    if (!editingTitle) return;
    const onPointerDown = (e: PointerEvent) => {
      if (titleInputRef.current?.contains(e.target as Node)) return;
      commitTitleRename();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [commitTitleRename, editingTitle]);

  return (
    <div
      data-drop-window-id={windowId}
      className="relative flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label select-none"
    >
      {/* Headerbar */}
      <WindowTitlebar
        data-window-drag-region={bridge.isCsd ? "" : undefined}
        className={cn(
          "h-9 shrink-0 justify-between border-b border-adw-separator bg-adw-titlebar px-2.5 select-none",
          !bridge.isCsd && "rounded-t-none",
        )}
      >
        <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
          {windowId && bridge.isCsd && (
            <WindowControls side="left" onClose={requestClose} />
          )}
          {windowId && (
            <WindowMenuButton
              side="left"
              windowId={windowId}
              appId="image-viewer"
              iconName="sparkles"
            />
          )}
        </div>
        <div className="flex min-w-0 items-center justify-center gap-1.5 px-2" data-window-no-drag>
        {editingTitle && isRenameableVfsFile ? (
          <input
            ref={titleInputRef}
            type="text"
            autoFocus
            data-window-no-drag
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitleRename();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            onFocus={(e) => {
              const dot = e.currentTarget.value.lastIndexOf(".");
              if (dot > 0) e.currentTarget.setSelectionRange(0, dot);
              else e.currentTarget.select();
            }}
            className="h-6 w-48 rounded-adw-control border border-adw-accent bg-adw-content px-2 text-center text-adw-body font-semibold text-adw-label outline-none"
          />
        ) : isRenameableVfsFile ? (
          <button
            type="button"
            data-window-no-drag
            onClick={() => {
              setDraftTitle(fileName);
              setEditingTitle(true);
            }}
            className="truncate rounded-adw-control px-2 py-0.5 text-adw-body font-semibold whitespace-nowrap text-adw-label transition-colors hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
          >
            {fileName}
          </button>
        ) : (
          <span className="pointer-events-none truncate text-adw-body font-semibold whitespace-nowrap text-adw-label">
            {fileName}
          </span>
        )}
        </div>
        <div className="flex shrink-0 items-center gap-1" data-window-no-drag>
          {canSave && (
            <button
              type="button"
              aria-label={_("Save Changes")}
              onClick={() => void handleSave()}
              className="flex size-7 items-center justify-center rounded-adw-control bg-adw-accent text-white transition-opacity hover:opacity-90"
            >
              <SaveIcon className="size-4" />
            </button>
          )}
        </div>
      </WindowTitlebar>

      {/* Canvas */}
      <div
        onWheel={handleWheel}
        onPointerDown={(e) => {
          if (cropping || !activeSrc || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          panDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: pan.x,
            origY: pan.y,
          };
          setIsPanning(true);
        }}
        onPointerMove={(e) => {
          const drag = panDragRef.current;
          if (!drag) return;
          setPan({
            x: drag.origX + (e.clientX - drag.startX),
            y: drag.origY + (e.clientY - drag.startY),
          });
        }}
        onPointerUp={() => {
          panDragRef.current = null;
          setIsPanning(false);
        }}
        onPointerCancel={() => {
          panDragRef.current = null;
          setIsPanning(false);
        }}
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/25 dark:bg-black/45",
          !cropping && activeSrc && (isPanning ? "cursor-grabbing" : "cursor-grab"),
        )}
      >
        {activeSrc ? (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            }}
            className={cn(
              "relative will-change-transform",
              !isPanning && "transition-transform duration-75 ease-out",
            )}
          >
            <img
              ref={imgRef}
              src={activeSrc}
              alt={fileName}
              draggable={false}
              className="max-h-[82vh] max-w-[90vw] object-contain shadow-xl"
            />
            {cropping && (
              <div
                onPointerDown={(e) => {
                  const parent = e.currentTarget.parentElement;
                  if (!parent) return;
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  cropDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    rect: parent.getBoundingClientRect(),
                  };
                }}
                onPointerMove={(e) => {
                  const drag = cropDragRef.current;
                  if (!drag || drag.rect.width === 0 || drag.rect.height === 0)
                    return;
                  const x1 = Math.max(
                    0,
                    Math.min(
                      100,
                      ((drag.startX - drag.rect.left) / drag.rect.width) * 100,
                    ),
                  );
                  const y1 = Math.max(
                    0,
                    Math.min(
                      100,
                      ((drag.startY - drag.rect.top) / drag.rect.height) * 100,
                    ),
                  );
                  const x2 = Math.max(
                    0,
                    Math.min(
                      100,
                      ((e.clientX - drag.rect.left) / drag.rect.width) * 100,
                    ),
                  );
                  const y2 = Math.max(
                    0,
                    Math.min(
                      100,
                      ((e.clientY - drag.rect.top) / drag.rect.height) * 100,
                    ),
                  );
                  setCropRect({
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    w: Math.max(5, Math.abs(x2 - x1)),
                    h: Math.max(5, Math.abs(y2 - y1)),
                  });
                }}
                onPointerUp={() => {
                  cropDragRef.current = null;
                }}
                style={{
                  left: `${cropRect.x}%`,
                  top: `${cropRect.y}%`,
                  width: `${cropRect.w}%`,
                  height: `${cropRect.h}%`,
                }}
                className="absolute cursor-crosshair border-2 border-adw-accent bg-adw-accent/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              />
            )}
          </div>
        ) : (
          <div className="text-xs text-adw-dim">
            {_("No image loaded. Open an image from Files.")}
          </div>
        )}

        {/* Bottom Floating RoundRect Overlay Controls */}
        <div
          data-window-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-1/2 z-20 cursor-default flex -translate-x-1/2 items-center gap-1 rounded-adw-group border border-white/15 bg-zinc-900/80 p-1 text-white shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            title={_("Zoom Out")}
            onClick={() =>
              setZoom((z) => Math.max(0.15, Number((z / 1.25).toFixed(2))))
            }
            className="flex size-8 items-center justify-center rounded-adw-item hover-fill:bg-white/15 active:bg-white/25"
          >
            <ZoomOutIcon className="size-4" />
          </button>
          <span className="min-w-10 text-center font-mono text-adw-subheadline tabular-nums opacity-85">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            title={_("Zoom In")}
            onClick={() =>
              setZoom((z) => Math.min(12, Number((z * 1.25).toFixed(2))))
            }
            className="flex size-8 items-center justify-center rounded-adw-item hover-fill:bg-white/15 active:bg-white/25"
          >
            <ZoomInIcon className="size-4" />
          </button>
          <button
            type="button"
            title={_("Fit to Window")}
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="flex size-8 items-center justify-center rounded-adw-item hover-fill:bg-white/15 active:bg-white/25"
          >
            <Maximize2Icon className="size-3.5" />
          </button>
          <div className="mx-0.5 h-4 w-px bg-white/15" />
          <button
            type="button"
            title={_("Rotate 90°")}
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex size-8 items-center justify-center rounded-adw-item hover-fill:bg-white/15 active:bg-white/25"
          >
            <RotateCwIcon className="size-4" />
          </button>
          <button
            type="button"
            title={_("Crop")}
            onClick={() => setCropping((c) => !c)}
            className={cn(
              "flex size-8 items-center justify-center rounded-adw-item transition-colors",
              cropping ? "bg-adw-accent text-white" : "hover-fill:bg-white/15",
            )}
          >
            <CropIcon className="size-4" />
          </button>
          {cropping && (
            <>
              <button
                type="button"
                title={_("Apply Crop")}
                onClick={applyCrop}
                className="flex size-8 items-center justify-center rounded-adw-item bg-emerald-600 text-white hover-fill:bg-emerald-500"
              >
                <CheckIcon className="size-4" />
              </button>
              <button
                type="button"
                title={_("Cancel Crop")}
                onClick={() => {
                  setCropRect({ x: 15, y: 15, w: 70, h: 70 });
                  setCropping(false);
                }}
                className="flex size-8 items-center justify-center rounded-adw-item hover-fill:bg-white/15"
              >
                <XIcon className="size-4" />
              </button>
            </>
          )}
          <div className="mx-0.5 h-4 w-px bg-white/15" />
          <button
            type="button"
            title={_("Reset (0)")}
            onClick={resetView}
            className="flex size-8 items-center justify-center rounded-adw-item hover-fill:bg-white/15 active:bg-white/25"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
        </div>
      </div>
      {confirmCloseOpen && (
        <UnsavedChangesDialog
          onCancel={() => setConfirmCloseOpen(false)}
          onDiscard={() => {
            setConfirmCloseOpen(false);
            forceCloseRef.current = true;
            performClose();
          }}
          onSave={async () => {
            await handleSave();
            setConfirmCloseOpen(false);
            forceCloseRef.current = true;
            performClose();
          }}
        />
      )}
    </div>
  );
};
