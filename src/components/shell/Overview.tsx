import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";
import {
  useApps,
  useSettings,
  useWindowManager,
  type DesktopWindowInstance,
} from "@/context/DesktopStateContext";
import { computeOverviewWindowLayouts } from "@/lib/overview-layout";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AppSquircleIcon } from "./AppSymbol";
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";
import { WindowControlButton } from "@/components/ui/window";

export { computeOverviewColumns } from "@/lib/overview-layout";

function OverviewWorkspacesBar({
  windows,
  draggingWindowId,
  onClearDrag,
  overviewOpen,
}: {
  windows: readonly DesktopWindowInstance[];
  draggingWindowId: string | null;
  onClearDrag: () => void;
  overviewOpen: boolean;
}) {
  const { settings, updateSettings } = useSettings();
  const { moveWindowToWorkspace, removeWorkspace, setOverviewOpen } =
    useWindowManager();
  const [hoveredTarget, setHoveredTarget] = React.useState<number | "new" | null>(
    null
  );

  const screenW = typeof window !== "undefined" ? Math.max(800, window.innerWidth) : 1440;
  const screenH = typeof window !== "undefined" ? Math.max(600, window.innerHeight) : 900;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      className={cn(
        "relative flex w-full shrink-0 items-center justify-center px-6 pt-[42px] pb-3 adw-material-hud animate-in fade-in-0 duration-200 motion-reduce:animate-none",
        !overviewOpen && "-translate-y-full",
      )}
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
                  aria-label={_("Desktop %d", ws)}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    window.dispatchEvent(
                      new CustomEvent("piloti:workspace-zoom-from-thumb", {
                        detail: {
                          left: rect.left,
                          top: rect.top,
                          width: rect.width,
                          height: rect.height,
                        },
                      }),
                    );
                    updateSettings({ activeWorkspace: ws });
                    setOverviewOpen(false);
                  }}
                  className={cn(
                    "relative h-[68px] w-[114px] overflow-hidden rounded-[8px] outline-none",
                    active
                      ? "ring-2 ring-white"
                      : "opacity-85 ring-1 ring-white/25",
                    dropActive && "ring-2 ring-adw-accent opacity-100"
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
                  <WindowControlButton
                    aria-label={_("Close Desktop %d", ws)}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWorkspace(ws);
                    }}
                    className="absolute -top-2 -left-2 bg-adw-window/85 opacity-0 shadow-md backdrop-blur-md transition-opacity group-hover:opacity-100"
                  >
                    <XIcon strokeWidth={2.25} />
                  </WindowControlButton>
                )}
              </div>
            );
          }
        )}

        {/* Grey screen thumbnail with + next to workspaces */}
        <button
          type="button"
          aria-label={_("Add Desktop")}
          title={_("Add Desktop")}
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
            "flex h-[68px] w-[114px] shrink-0 items-center justify-center rounded-[8px] bg-black/15 text-adw-label ring-1 ring-black/15 outline-none dark:bg-white/15 dark:text-white/90 dark:ring-white/20",
            draggingWindowId &&
              hoveredTarget === "new" &&
              "bg-adw-accent/80 ring-2 ring-white"
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
  const { settings } = useSettings();
  const { getAppIconUrl } = useApps();
  const {
    windows,
    overviewOpen,
    setOverviewOpen,
    focusWindow,
    closeWindow,
  } = useWindowManager();

  const [draggingWindowId, setDraggingWindowId] = React.useState<string | null>(
    null
  );

  const activeWindows = React.useMemo(
    () => windows.filter((w) => w.workspace === settings.activeWorkspace),
    [windows, settings.activeWorkspace]
  );

  const layouts = React.useMemo(() => {
    if (typeof window === "undefined") return new Map();
    return computeOverviewWindowLayouts(
      activeWindows,
      window.innerWidth,
      window.innerHeight - 30,
    );
  }, [activeWindows]);

  return (
    <div
      role="dialog"
      aria-label="Overview"
      onClick={() => setOverviewOpen(false)}
      className={cn(
        "fixed inset-0 z-[90] flex flex-col overflow-hidden transition-opacity duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] animate-in fade-in motion-reduce:animate-none",
        !overviewOpen && "pointer-events-none opacity-0",
      )}
    >
      <OverviewWorkspacesBar
        windows={windows}
        draggingWindowId={draggingWindowId}
        onClearDrag={() => setDraggingWindowId(null)}
        overviewOpen={overviewOpen}
      />

      {/* Transparent interactive hit overlays aligned with scaled real windows */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeWindows.map((win) => {
          const layout = layouts.get(win.id);
          if (!layout) return null;
          const resolvedIconUrl = win.iconUrl ?? getAppIconUrl(win.appId);
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
              style={{
                left: `${layout.targetX}px`,
                top: `${layout.targetY - 114}px`,
                width: `${layout.scaledWidth}px`,
                height: `${layout.scaledHeight}px`,
              }}
              className="group absolute flex cursor-default flex-col items-center rounded-[10px] ring-2 ring-transparent hover:ring-white/85 select-none"
            >
              <WindowControlButton
                aria-label={`Close ${win.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeWindow(win.id);
                }}
                className="absolute -top-2 -left-2 bg-adw-window/85 opacity-0 shadow-md backdrop-blur-md transition-opacity group-hover:opacity-100"
              >
                <XIcon strokeWidth={2.25} />
              </WindowControlButton>

              <div className="pointer-events-none absolute -bottom-11 flex flex-col items-center">
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
                  className="size-12"
                  glyphClassName="size-7"
                />
                <span className="mt-1 max-w-[200px] truncate px-2 text-[12px] font-medium text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                  {win.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
