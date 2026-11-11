import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { usePortalRequests } from "@domicile-desktop/react/portals";
import {
  CastSource,
  CastSourceKind,
  PortalAnswer,
  PortalKind,
  type PortalRequest,
} from "@domicile-desktop/sdk/portal";
import {
  CameraIcon,
  MonitorIcon,
  PipetteIcon,
  ShieldCheckIcon,
  VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ScreenshotPortalOverlay({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.Screenshot }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const { frame, width, height, windows } = request.body;
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [dragEnd, setDragEnd] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [copyToClipboard, setCopyToClipboard] = React.useState(false);

  const selectionRect = React.useMemo(() => {
    if (!dragStart || !dragEnd) return null;
    const x = Math.min(dragStart.x, dragEnd.x);
    const y = Math.min(dragStart.y, dragEnd.y);
    const w = Math.abs(dragEnd.x - dragStart.x);
    const h = Math.abs(dragEnd.y - dragStart.y);
    return w > 8 && h > 8 ? { x, y, w, h } : null;
  }, [dragStart, dragEnd]);

  const mapToFrameCoords = (rect: { x: number; y: number; w: number; h: number }) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0, width, height };
    const bounds = img.getBoundingClientRect();
    const scaleX = width / (bounds.width || 1);
    const scaleY = height / (bounds.height || 1);
    return {
      x: Math.max(0, Math.round((rect.x - bounds.left) * scaleX)),
      y: Math.max(0, Math.round((rect.y - bounds.top) * scaleY)),
      width: Math.max(1, Math.min(width, Math.round(rect.w * scaleX))),
      height: Math.max(1, Math.min(height, Math.round(rect.h * scaleY))),
    };
  };

  return (
    <div className="fixed inset-0 z-[800] flex flex-col items-center justify-center bg-black/85 select-none">
      <div className="relative flex max-h-[82vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-xl border border-white/20 shadow-2xl">
        <img
          ref={imgRef}
          src={frame}
          alt="Desktop Screenshot Preview"
          draggable={false}
          onPointerDown={(e) => {
            setDragStart({ x: e.clientX, y: e.clientY });
            setDragEnd({ x: e.clientX, y: e.clientY });
          }}
          onPointerMove={(e) => {
            if (dragStart) setDragEnd({ x: e.clientX, y: e.clientY });
          }}
          onPointerUp={() => {
            // Keep selection visible until confirmed
          }}
          className="max-h-[80vh] max-w-[88vw] cursor-crosshair object-contain"
        />
        {selectionRect && (
          <div
            style={{
              left: `${selectionRect.x}px`,
              top: `${selectionRect.y}px`,
              width: `${selectionRect.w}px`,
              height: `${selectionRect.h}px`,
            }}
            className="pointer-events-none fixed border-2 border-sky-400 bg-sky-400/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          />
        )}
      </div>

      {/* Floating Capture Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-full bg-zinc-900/95 px-4 py-2 text-xs text-white shadow-xl ring-1 ring-white/15">
        <CameraIcon className="size-4 text-sky-400" />
        <span className="font-medium">Drag to select area</span>

        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-white/80">
          <input
            type="checkbox"
            checked={copyToClipboard}
            onChange={(e) => setCopyToClipboard(e.target.checked)}
          />
          Copy to Clipboard
        </label>

        {selectionRect && (
          <Button
            size="sm"
            onClick={() =>
              onAnswer(
                PortalAnswer.Screenshot(
                  mapToFrameCoords(selectionRect),
                  copyToClipboard
                )
              )
            }
          >
            Capture Selection
          </Button>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onAnswer(
              PortalAnswer.Screenshot(
                { x: 0, y: 0, width, height },
                copyToClipboard
              )
            )
          }
        >
          Entire Screen
        </Button>

        {windows.slice(0, 3).map((w) => (
          <Button
            key={w.id}
            size="sm"
            variant="secondary"
            onClick={() =>
              onAnswer(PortalAnswer.ScreenshotWindow(w.id, copyToClipboard))
            }
          >
            {w.title || w.appId || "Window"}
          </Button>
        ))}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAnswer(PortalAnswer.Canceled())}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ScreenCastPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.ScreenCast }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const [selected, setSelected] = React.useState<Set<number>>(
    () => new Set(request.body.sources.length > 0 ? [0] : [])
  );

  const toggleIndex = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(request.body.multiple ? prev : []);
      if (prev.has(idx) && request.body.multiple) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[460px] rounded-mac-menu p-5 text-mac-label shadow-mac-menu mac-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <VideoIcon className="size-5 text-mac-accent" />
          <div>
            <h3 className="text-[14px] font-bold">Share Screen or Window</h3>
            <p className="text-[11px] text-mac-label-secondary">
              Requested by {request.appId || "Application"}
            </p>
          </div>
        </div>

        <div className="max-h-64 space-y-1.5 overflow-y-auto py-1">
          {request.body.sources.map((src, idx) => {
            const active = selected.has(idx);
            const label =
              src.kind === CastSourceKind.Monitor
                ? `Display: ${src.description || src.name}`
                : src.kind === CastSourceKind.Window
                  ? `Window: ${src.title || src.appId || src.id}`
                  : src.kind === CastSourceKind.BrowserWindow
                    ? `Browser: ${src.title}`
                    : "Selected Region";

            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleIndex(idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-mac-item px-3 py-2 text-left text-xs transition-colors",
                  active
                    ? "bg-mac-accent text-white"
                    : "bg-mac-fill-tertiary hover:bg-mac-fill-secondary"
                )}
              >
                <MonitorIcon className="size-4 shrink-0" />
                <span className="truncate font-medium">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={() => {
              const chosen: CastSource[] = Array.from(selected)
                .map((i) => request.body.sources[i])
                .filter(Boolean);
              onAnswer(PortalAnswer.ScreenCast(chosen));
            }}
          >
            Share Selected
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Human-readable label for portal kinds rendered by the fallback dialog.
 */
function describePortalKind(req: PortalRequest): string {
  switch (req.kind) {
    case PortalKind.AppChooser:
      return "an application chooser";
    case PortalKind.FileChooser:
      return "a file chooser";
    case PortalKind.Print:
      return "a print dialog";
    case PortalKind.RemoteDesktop:
      return "remote desktop access";
    case PortalKind.DynamicLauncher:
      return "a launcher installation";
    case PortalKind.GlobalShortcuts:
      return "global shortcut bindings";
    case PortalKind.Unknown:
      return `an unsupported portal (${req.wireKind})`;
    default:
      return "a desktop portal dialog";
  }
}

/**
 * Renders interactive XDG Desktop Portal dialogs pushed by Domicile
 * (Screenshots, ScreenCast source pickers, PickColor, Access, Account, Wallpaper).
 * Non-interactive state entries like `PortalKind.Inhibit` are ignored because the
 * compositor keeps them open until the app releases its inhibitor lock.
 */
export function PortalDialogs() {
  const domicile = useDomicile();
  const requests = usePortalRequests();
  const [dismissedIds, setDismissedIds] = React.useState<Set<number>>(
    () => new Set()
  );

  React.useEffect(() => {
    if (!requests) return;
    setDismissedIds((prev) => {
      if (prev.size === 0) return prev;
      const activeIds = new Set(requests.map((r) => r.id));
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (activeIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [requests]);

  const current = requests?.find(
    (r) => r.kind !== PortalKind.Inhibit && !dismissedIds.has(r.id)
  );

  if (!current) return null;

  const answer = (ans: PortalAnswer) => {
    domicile.portals.answer(current.id, ans);
  };

  const dismissFallback = () => {
    setDismissedIds((prev) => new Set(prev).add(current.id));
    answer(
      current.kind === PortalKind.Unknown
        ? PortalAnswer.Refused()
        : PortalAnswer.Canceled()
    );
  };

  if (current.kind === PortalKind.Screenshot) {
    return <ScreenshotPortalOverlay request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.ScreenCast) {
    return <ScreenCastPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.PickColor) {
    return (
      <div
        className="fixed inset-0 z-[800] flex cursor-crosshair items-center justify-center bg-black/20"
        onClick={(e) => {
          answer(
            PortalAnswer.PickColor({
              x: Math.max(0, Math.round(e.clientX)),
              y: Math.max(0, Math.round(e.clientY)),
            })
          );
        }}
      >
        <div className="pointer-events-none flex items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 text-xs font-medium text-white shadow-xl">
          <PipetteIcon className="size-4 text-sky-400" />
          <span>Click anywhere to sample pixel color (Esc to cancel)</span>
        </div>
      </div>
    );
  }

  if (
    current.kind === PortalKind.Access ||
    current.kind === PortalKind.Account ||
    current.kind === PortalKind.Wallpaper ||
    current.kind === PortalKind.InputCapture ||
    current.kind === PortalKind.Usb
  ) {
    const title =
      current.kind === PortalKind.Wallpaper
        ? "Set Desktop Wallpaper?"
        : current.kind === PortalKind.Account
          ? "Share Account Information?"
          : current.kind === PortalKind.Usb
            ? "Allow USB Device Access?"
            : "Permission Request";

    return (
      <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-[380px] rounded-mac-menu p-5 text-mac-label shadow-mac-menu mac-material-menu">
          <div className="mb-3 flex items-center gap-2.5">
            <ShieldCheckIcon className="size-5 text-mac-accent" />
            <div>
              <h3 className="text-[14px] font-bold">{title}</h3>
              <p className="text-[11px] text-mac-label-secondary">
                {current.appId || "System Application"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => answer(PortalAnswer.Canceled())}
            >
              Deny
            </Button>
            <Button
              size="sm"
              onClick={() =>
                answer(
                  current.kind === PortalKind.InputCapture
                    ? PortalAnswer.InputCapture()
                    : PortalAnswer.Access()
                )
              }
            >
              Allow
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unhandled portal request kinds (e.g. AppChooser / FileChooser / Print)
  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[380px] rounded-mac-menu p-5 text-mac-label shadow-mac-menu mac-material-menu">
        <h3 className="text-[14px] font-bold">Application Portal Request</h3>
        <p className="mt-1 text-xs text-mac-label-secondary">
          {current.appId || "Application"} requested{" "}
          {describePortalKind(current)}.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={dismissFallback}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

