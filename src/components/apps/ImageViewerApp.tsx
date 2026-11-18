import * as React from "react";
import {
  CheckIcon,
  CropIcon,
  Maximize2Icon,
  RotateCcwIcon,
  RotateCwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useIsolatedAppBridge } from "@/lib/app-bridge";
import { cn } from "@/lib/utils";

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
  const bridge = useIsolatedAppBridge(windowId, propIsCsd);
  const resolvedPath = React.useMemo(() => {
    if (initialPath) return initialPath;
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("path") ?? "";
    }
    return "";
  }, [initialPath]);

  const [imageSrc, setImageSrc] = React.useState<string>("");
  const [zoom, setZoom] = React.useState(1);
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
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const cropDragRef = React.useRef<{
    startX: number;
    startY: number;
    rect: DOMRect;
  } | null>(null);

  React.useEffect(() => {
    if (!resolvedPath) return;
    if (
      resolvedPath.startsWith("data:") ||
      resolvedPath.startsWith("http://") ||
      resolvedPath.startsWith("https://") ||
      resolvedPath.startsWith("blob:")
    ) {
      setImageSrc(resolvedPath);
      return;
    }
    let cancelled = false;
    void bridge.fs.readText(resolvedPath).then((content) => {
      if (cancelled || !content) return;
      if (content.startsWith("data:image/")) {
        setImageSrc(content);
      } else if (resolvedPath.toLowerCase().endsWith(".svg")) {
        setImageSrc(`data:image/svg+xml;utf8,${encodeURIComponent(content)}`);
      } else {
        setImageSrc(content);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bridge.fs, resolvedPath]);

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

  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setCroppedDataUrl(null);
    setCropping(false);
    setCropRect({ x: 15, y: 15, w: 70, h: 70 });
  };

  const fileName = resolvedPath
    ? (resolvedPath.split("/").filter(Boolean).pop() ?? "Image Viewer")
    : "Image Viewer";

  return (
    <div className="group/viewer relative flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label select-none">
      {/* Translucent Headerbar revealed on hover / moving up to drag */}
      <div
        data-window-drag-region=""
        className="absolute inset-x-0 top-0 z-20 flex h-9 items-center justify-between border-b border-adw-separator/60 bg-adw-titlebar/85 px-3 opacity-0 backdrop-blur-md transition-opacity duration-150 group-hover/viewer:opacity-100"
      >
        <div className="w-6" />
        <span className="pointer-events-none truncate text-adw-body font-semibold whitespace-nowrap text-adw-label">
          {fileName}
        </span>
        <button
          type="button"
          data-window-no-drag
          aria-label="Close window"
          onClick={() => bridge.closeWindow()}
          className="flex size-6 items-center justify-center rounded-full bg-adw-fill-secondary text-adw-label-secondary transition-colors hover:bg-adw-fill-primary hover:text-adw-label"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Canvas */}
      <div
        onWheel={handleWheel}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/25 dark:bg-black/45"
      >
        {activeSrc ? (
          <div
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            className="relative transition-transform duration-75 ease-out"
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
            No image loaded. Open an image from Files.
          </div>
        )}

        {/* Bottom Floating RoundRect Overlay Controls */}
        <div
          data-window-no-drag
          className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/15 bg-zinc-900/80 p-1 text-white shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            title="Zoom Out"
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
            title="Zoom In"
            onClick={() =>
              setZoom((z) => Math.min(12, Number((z * 1.25).toFixed(2))))
            }
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <ZoomInIcon className="size-4" />
          </button>
          <button
            type="button"
            title="Fit to Window"
            onClick={() => setZoom(1)}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <Maximize2Icon className="size-3.5" />
          </button>
          <div className="mx-0.5 h-4 w-px bg-white/15" />
          <button
            type="button"
            title="Rotate 90°"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <RotateCwIcon className="size-4" />
          </button>
          <button
            type="button"
            title="Crop"
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
                title="Apply Crop"
                onClick={applyCrop}
                className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <CheckIcon className="size-4" />
              </button>
              <button
                type="button"
                title="Cancel Crop"
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
            title="Reset"
            onClick={resetView}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
