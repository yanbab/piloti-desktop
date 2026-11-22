import * as React from "react";
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
import { WindowControls } from "@/components/ui/window";
import { useIsolatedAppBridge } from "@/lib/engine/app-bridge";
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
  const [savedFlash, setSavedFlash] = React.useState(false);
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

  React.useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedDataUrl(null);
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
      const ok = await bridge.fs.writeText(activePath, nextDataUrl);
      if (ok) {
        setImageSrc(nextDataUrl);
        setCroppedDataUrl(null);
        setRotation(0);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1800);
      }
    } catch {
      // ignore tainted canvas
    }
  }, [activePath, bridge.fs, rotation]);

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
      {/* Translucent Headerbar revealed when hovering the top headerbar zone or dragging the window */}
      <div className="group/header absolute inset-x-0 top-0 z-20 h-10">
        <div
          data-window-drag-region=""
          className={cn(
            "flex h-9 items-center justify-between border-b border-adw-separator/60 bg-adw-titlebar/85 px-2.5 backdrop-blur-md transition-opacity duration-150 group-hover/header:opacity-100 group-data-[dragging]/window:opacity-100",
            dragRegionHovered || editingTitle ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
            {windowId && bridge.isCsd && <WindowControls side="left" />}
            {windowId && (
              <WindowMenuButton
                side="left"
                windowId={windowId}
                appId="image-viewer"
                iconName="sparkles"
              />
            )}
          </div>
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
              className="h-6 w-48 rounded-md border border-adw-accent bg-adw-content px-2 text-center text-adw-body font-semibold text-adw-label outline-none"
            />
          ) : isRenameableVfsFile ? (
            <button
              type="button"
              data-window-no-drag
              title={_("Click to rename")}
              onClick={() => {
                setDraftTitle(fileName);
                setEditingTitle(true);
              }}
              className="truncate rounded-md px-2 py-0.5 text-adw-body font-semibold whitespace-nowrap text-adw-label transition-colors hover:bg-black/8 dark:hover:bg-white/10"
            >
              {fileName}
            </button>
          ) : (
            <span className="pointer-events-none truncate text-adw-body font-semibold whitespace-nowrap text-adw-label">
              {fileName}
            </span>
          )}
          <div className="flex shrink-0 items-center gap-1" data-window-no-drag>
            {windowId && (
              <WindowMenuButton
                side="right"
                windowId={windowId}
                appId="image-viewer"
                iconName="sparkles"
              />
            )}
            {windowId && bridge.isCsd && <WindowControls side="right" />}
          </div>
        </div>
      </div>

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
          className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/15 bg-zinc-900/80 p-1 text-white shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            title={_("Zoom Out")}
            onClick={() =>
              setZoom((z) => Math.max(0.15, Number((z / 1.25).toFixed(2))))
            }
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <ZoomOutIcon className="size-4" />
          </button>
          <span className="min-w-10 text-center font-mono text-[11px] tabular-nums opacity-85">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            title={_("Zoom In")}
            onClick={() =>
              setZoom((z) => Math.min(12, Number((z * 1.25).toFixed(2))))
            }
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <ZoomInIcon className="size-4" />
          </button>
          <button
            type="button"
            title={_("Fit to Window")}
            onClick={() => setZoom(1)}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <Maximize2Icon className="size-3.5" />
          </button>
          <div className="mx-0.5 h-4 w-px bg-white/15" />
          <button
            type="button"
            title={_("Rotate 90°")}
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <RotateCwIcon className="size-4" />
          </button>
          <button
            type="button"
            title={_("Crop")}
            onClick={() => setCropping((c) => !c)}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              cropping ? "bg-adw-accent text-white" : "hover:bg-white/15",
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
                className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
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
                className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15"
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
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
          {canSave && (
            <>
              <div className="mx-0.5 h-4 w-px bg-white/15" />
              <button
                type="button"
                title={_("Save Changes (Ctrl+S)")}
                onClick={() => void handleSave()}
                className="flex size-8 items-center justify-center rounded-lg bg-adw-accent text-white hover:opacity-90"
              >
                <SaveIcon className="size-3.5" />
              </button>
            </>
          )}
          {savedFlash && (
            <span className="px-2 text-[11px] font-medium text-emerald-400">
              {_("Saved")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
