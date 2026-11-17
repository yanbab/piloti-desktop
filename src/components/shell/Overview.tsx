import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { PreviewedWindow } from "@domicile-desktop/sdk/previewed-window";
import { PlusIcon, XIcon } from "lucide-react";
import {
  useApps,
  useSettings,
  useWindowManager,
  type DesktopWindowInstance,
} from "@/context/DesktopStateContext";
import { cn } from "@/lib/utils";
import { AppSquircleIcon } from "./AppSymbol";
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";

/**
 * Pure helper picking a balanced column count for Overview's window spread.
 */
export function computeOverviewColumns(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

function getPreviewTarget(win: DesktopWindowInstance): PreviewedWindow | null {
  if (win.waylandAppId) return PreviewedWindow.App(win.waylandAppId);
  if (win.browserWindowId !== undefined) {
    return PreviewedWindow.Browser(String(win.browserWindowId));
  }
  return null;
}

function sortOverviewWindows(
  list: readonly DesktopWindowInstance[]
): DesktopWindowInstance[] {
  return [...list].sort((a, b) => {
    if (a.minimized !== b.minimized) return a.minimized ? 1 : -1;
    const rowA = Math.round(a.position.y / 140);
    const rowB = Math.round(b.position.y / 140);
    if (rowA !== rowB) return rowA - rowB;
    return a.position.x - b.position.x;
  });
}

function OverviewThumbnailBody({
  win,
  captureUrl,
}: {
  win: DesktopWindowInstance;
  captureUrl?: string;
}) {
  if (captureUrl) {
    return (
      <img
        src={captureUrl}
        alt={win.title}
        draggable={false}
        className="h-full w-full bg-zinc-950 object-cover object-top"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-900/95">
      <div className="flex h-5 shrink-0 items-center gap-1.5 border-b border-white/10 bg-zinc-800/90 px-2.5">
        <span className="size-2 rounded-full bg-white/25" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="ml-2 truncate text-[10px] text-white/55">
          {win.title}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 text-center">
        <AppSquircleIcon
          iconName={win.iconName}
          iconUrl={win.iconUrl}
          squircle={Boolean(win.browserWindowId)}
          gradient={win.gradient}
          className="size-11 opacity-85"
          glyphClassName="size-6"
        />
        <span className="max-w-full truncate text-[11px] text-white/55">
          {win.waylandAppId ?? `${win.size.width}×${win.size.height}`}
        </span>
      </div>
    </div>
  );
}

function OverviewWorkspacesBar({
  windows,
  draggingWindowId,
  onClearDrag,
}: {
  windows: readonly DesktopWindowInstance[];
  draggingWindowId: string | null;
  onClearDrag: () => void;
}) {
  const { settings, updateSettings } = useSettings();
  const { moveWindowToWorkspace, removeWorkspace } = useWindowManager();
  const [hoveredTarget, setHoveredTarget] = React.useState<number | "new" | null>(
    null
  );

  const screenW = typeof window !== "undefined" ? Math.max(800, window.innerWidth) : 1440;
  const screenH = typeof window !== "undefined" ? Math.max(600, window.innerHeight) : 900;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="relative flex w-full shrink-0 items-center justify-center border-b border-black/10 bg-white/60 px-6 py-3 backdrop-blur-md dark:border-white/10 dark:bg-black/40"
    >
      <div className="flex max-w-full items-center gap-4 overflow-x-auto px-3 py-2.5">
        {Array.from({ length: settings.workspaceCount }, (_, idx) => idx + 1).map(
          (ws) => {
            const active = settings.activeWorkspace === ws;
            const wsWins = windows.filter((w) => w.workspace === ws && !w.minimized);
            const dropActive = draggingWindowId !== null && hoveredTarget === ws;

            return (
              <div
                key={ws}
                onDragOver={(e) => {
                  if (!draggingWindowId) return;
                  e.preventDefault();
                  setHoveredTarget(ws);
                }}
                onDragLeave={() => {
                  if (hoveredTarget === ws) setHoveredTarget(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedId =
                    e.dataTransfer.getData("text/piloti-window") || draggingWindowId;
                  if (droppedId) {
                    moveWindowToWorkspace(droppedId, ws);
                  }
                  setHoveredTarget(null);
                  onClearDrag();
                }}
                className="group relative flex shrink-0 items-center"
              >
                <button
                  type="button"
                  aria-label={`Desktop ${ws}`}
                  onClick={() => updateSettings({ activeWorkspace: ws })}
                  className={cn(
                    "relative h-[68px] w-[114px] overflow-hidden rounded-[8px] shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition-all duration-150 outline-none",
                    active
                      ? "ring-2 ring-white"
                      : "opacity-85 ring-1 ring-white/25 hover:opacity-100",
                    dropActive && "scale-105 ring-2 ring-adw-accent opacity-100"
                  )}
                >
                  <DesktopBackgroundLayers />
                  {wsWins.map((w) => {
                    const leftPct = Math.max(0, Math.min(82, (w.position.x / screenW) * 100));
                    const topPct = Math.max(6, Math.min(80, (w.position.y / screenH) * 100));
                    const widthPct = Math.max(
                      12,
                      Math.min(100 - leftPct, (w.size.width / screenW) * 100)
                    );
                    const heightPct = Math.max(
                      14,
                      Math.min(92 - topPct, (w.size.height / screenH) * 100)
                    );
                    return (
                      <span
                        key={w.id}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        className="pointer-events-none absolute rounded-[2px] border border-white/30 bg-zinc-900/80 shadow-xs"
                      />
                    );
                  })}
                </button>

                {settings.workspaceCount > 1 && (
                  <button
                    type="button"
                    aria-label={`Close Desktop ${ws}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWorkspace(ws);
                    }}
                    className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-zinc-800/95 text-white opacity-0 shadow-md ring-1 ring-white/25 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </div>
            );
          }
        )}

        {/* Grey screen thumbnail with + next to workspaces */}
        <button
          type="button"
          aria-label="Add Desktop"
          title="Add Desktop"
          onDragOver={(e) => {
            if (!draggingWindowId) return;
            e.preventDefault();
            setHoveredTarget("new");
          }}
          onDragLeave={() => {
            if (hoveredTarget === "new") setHoveredTarget(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const nextWs = settings.workspaceCount + 1;
            const droppedId =
              e.dataTransfer.getData("text/piloti-window") || draggingWindowId;
            updateSettings({ workspaceCount: nextWs });
            if (droppedId) {
              moveWindowToWorkspace(droppedId, nextWs);
            }
            setHoveredTarget(null);
            onClearDrag();
          }}
          onClick={() =>
            updateSettings({
              workspaceCount: settings.workspaceCount + 1,
              activeWorkspace: settings.workspaceCount + 1,
            })
          }
          className={cn(
            "flex h-[68px] w-[114px] shrink-0 items-center justify-center rounded-[8px] bg-black/15 text-adw-label shadow-[0_6px_18px_rgba(0,0,0,0.25)] ring-1 ring-black/15 transition-all duration-150 outline-none hover:bg-black/22 dark:bg-white/15 dark:text-white/90 dark:ring-white/20 dark:hover:bg-white/22",
            draggingWindowId &&
              hoveredTarget === "new" &&
              "scale-105 bg-adw-accent/80 ring-2 ring-white"
          )}
        >
          <PlusIcon className="size-6" />
        </button>
      </div>
    </div>
  );
}

/**
 * Overview overlay:
 * - Top workspaces strip with wallpaper thumbnails, mini window layouts, add/remove,
 *   and drag-to-move windows across workspaces
 * - Spread-out active-workspace window previews with overlapping app icon badge
 *   and title below
 */
export function Overview() {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings } = useSettings();
  const { getAppIconUrl } = useApps();
  const {
    windows,
    overviewOpen,
    setOverviewOpen,
    focusWindow,
    closeWindow,
  } = useWindowManager();

  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [draggingWindowId, setDraggingWindowId] = React.useState<string | null>(
    null
  );

  const activeWindows = React.useMemo(
    () =>
      sortOverviewWindows(
        windows.filter((w) => w.workspace === settings.activeWorkspace)
      ),
    [windows, settings.activeWorkspace]
  );

  // Capture live window thumbnails when Overview opens in Domicile runtime
  React.useEffect(() => {
    if (!overviewOpen || isBrowserRuntime) return;
    let cancelled = false;

    const capturable = windows
      .map((w) => ({ w, target: getPreviewTarget(w) }))
      .filter((item): item is { w: DesktopWindowInstance; target: PreviewedWindow } =>
        Boolean(item.target)
      );

    if (capturable.length === 0) return;

    Promise.all(
      capturable.map(async ({ w, target }) => {
        try {
          const res = await domicile.capture.preview(target);
          res.match({
            Ok: (dataUrl) => {
              if (!cancelled && dataUrl) {
                setPreviews((prev) => ({ ...prev, [w.id]: dataUrl }));
              }
            },
            Err: () => {},
          });
        } catch {
          // fallback card renders cleanly when preview capture is unavailable
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [domicile.capture, overviewOpen, isBrowserRuntime, windows]);

  if (!overviewOpen) return null;

  const cols = computeOverviewColumns(activeWindows.length);

  return (
    <div
      role="dialog"
      aria-label="Overview"
      onClick={() => setOverviewOpen(false)}
      className="fixed inset-x-0 top-[30px] bottom-0 z-[90] flex flex-col overflow-hidden"
    >
      <OverviewWorkspacesBar
        windows={windows}
        draggingWindowId={draggingWindowId}
        onClearDrag={() => setDraggingWindowId(null)}
      />

      {/* Frosted tint + spread-out window grid below the spaces strip */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-black/26 backdrop-blur-md" />
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-10 pt-6 pb-24">
          {activeWindows.length === 0 ? null : (
            <div
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
              className="grid w-full max-w-[1160px] place-items-center gap-x-10 gap-y-8"
            >
              {activeWindows.map((win) => {
                const resolvedIconUrl = win.iconUrl ?? getAppIconUrl(win.appId);
                const aspect = Math.max(
                  0.8,
                  Math.min(1.85, win.size.width / Math.max(1, win.size.height))
                );

                return (
                  <div
                    key={win.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/piloti-window", win.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingWindowId(win.id);
                    }}
                    onDragEnd={() => setDraggingWindowId(null)}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        e.stopPropagation();
                        closeWindow(win.id);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverviewOpen(false);
                      focusWindow(win.id);
                    }}
                    className="group relative flex w-full max-w-[360px] cursor-default flex-col items-center select-none"
                  >
                    {/* Scaled preview frame */}
                    <div
                      style={{ aspectRatio: String(aspect) }}
                      className={cn(
                        "relative max-h-[34vh] w-full overflow-hidden rounded-[11px] bg-zinc-950 shadow-[0_16px_40px_rgba(0,0,0,0.48)] ring-2 ring-transparent transition-all duration-150 group-hover:scale-[1.02] group-hover:ring-white/85",
                        win.minimized && "opacity-75"
                      )}
                    >
                      <OverviewThumbnailBody
                        win={{ ...win, iconUrl: resolvedIconUrl }}
                        captureUrl={previews[win.id]}
                      />

                      {win.minimized && (
                        <span className="absolute top-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur-xs">
                          Minimized
                        </span>
                      )}

                      <button
                        type="button"
                        aria-label={`Close ${win.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          closeWindow(win.id);
                        }}
                        className="absolute top-2 left-2 flex size-6 items-center justify-center rounded-full bg-zinc-900/85 text-white opacity-0 shadow-md ring-1 ring-white/25 transition-opacity group-hover:opacity-100 hover:bg-rose-500"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>

                    {/* Bottom-center overlapping badge */}
                    <div className="relative z-10 -mt-5">
                      <AppSquircleIcon
                        iconName={win.iconName}
                        iconUrl={resolvedIconUrl}
                        fallbackIconUrl={
                          win.browserWindowId
                            ? getAppIconUrl("browser")
                            : undefined
                        }
                        squircle={Boolean(win.browserWindowId)}
                        gradient={win.gradient}
                        className="size-10"
                        glyphClassName="size-6"
                      />
                    </div>

                    {/* Title label centered beneath badge */}
                    <span className="mt-1.5 max-w-full truncate px-2 text-[13px] font-medium text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)]">
                      {win.title}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

