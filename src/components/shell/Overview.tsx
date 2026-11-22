import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LayersIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import {
  useApps,
  useSettings,
  useWindowManager,
  type DesktopWindowInstance,
} from "@/context/DesktopStateContext";
import { computeOverviewWindowLayouts } from "@/lib/shell/overview-layout";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { AppSquircleIcon } from "./AppSymbol";
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";
import { WindowControlButton } from "@/components/ui/window";

export { computeOverviewColumns } from "@/lib/shell/overview-layout";

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
 * macOS Finder Gallery View-style window switcher for Touch Mode.
 * Renders a centered large active window card/preview + horizontal bottom strip
 * of window cards/icons, with horizontal wheel, touch/pointer swipe, and keyboard
 * navigation.
 */
function TouchGalleryWindowSwitcher() {
  const { getAppIconUrl } = useApps();
  const {
    windows,
    focusedWindowId,
    overviewOpen,
    setOverviewOpen,
    focusWindow,
    closeWindow,
  } = useWindowManager();

  const [selectedIndex, setSelectedIndex] = React.useState(() => {
    const idx = windows.findIndex((w) => w.id === focusedWindowId);
    return idx >= 0 ? idx : 0;
  });

  // Sync selection to focused window when opening
  React.useEffect(() => {
    if (!overviewOpen) return;
    const idx = windows.findIndex((w) => w.id === focusedWindowId);
    setSelectedIndex(idx >= 0 ? idx : 0);
  }, [overviewOpen, focusedWindowId, windows]);

  // Clamp index if windows are closed while switcher is open
  React.useEffect(() => {
    if (windows.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= windows.length) {
      setSelectedIndex(windows.length - 1);
    }
  }, [selectedIndex, windows.length]);

  const clampedIndex =
    windows.length > 0 ? Math.min(selectedIndex, windows.length - 1) : 0;
  const activeWin = windows[clampedIndex];

  const stepSelection = React.useCallback(
    (delta: number) => {
      if (windows.length <= 1) return;
      setSelectedIndex((prev) =>
        Math.max(0, Math.min(windows.length - 1, prev + delta))
      );
    },
    [windows.length]
  );

  const activateWindow = React.useCallback(
    (winId: string) => {
      setOverviewOpen(false);
      focusWindow(winId);
    },
    [focusWindow, setOverviewOpen]
  );

  // Keyboard navigation
  React.useEffect(() => {
    if (!overviewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepSelection(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepSelection(1);
      } else if (e.key === "Enter" && activeWin) {
        e.preventDefault();
        activateWindow(activeWin.id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOverviewOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeWin, activateWindow, overviewOpen, setOverviewOpen, stepSelection]);

  // Auto-scroll selected card into view in the bottom strip
  const stripItemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  React.useEffect(() => {
    if (!activeWin) return;
    stripItemRefs.current
      .get(activeWin.id)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeWin]);

  // Horizontal wheel navigation
  const wheelAccumRef = React.useRef(0);
  const handleWheel = React.useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const primaryDelta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (primaryDelta === 0) return;
      wheelAccumRef.current += primaryDelta;
      const threshold = 48;
      if (Math.abs(wheelAccumRef.current) >= threshold) {
        const steps = Math.trunc(wheelAccumRef.current / threshold);
        wheelAccumRef.current -= steps * threshold;
        stepSelection(steps);
      }
    },
    [stepSelection]
  );

  // Touch / pointer swipe navigation
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const swipedRef = React.useRef(false);
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    swipedRef.current = false;
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      const steps = Math.max(1, Math.round(Math.abs(dx) / 120));
      stepSelection(dx < 0 ? steps : -steps);
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };
  const handlePointerUp = () => {
    pointerStartRef.current = null;
  };

  return (
    <div
      role="dialog"
      aria-label={_("Window Switcher")}
      onClick={() => {
        if (swipedRef.current) {
          swipedRef.current = false;
          return;
        }
        setOverviewOpen(false);
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "fixed inset-0 z-[90] flex flex-col overflow-hidden bg-black/55 pt-[30px] backdrop-blur-2xl transition-opacity duration-300 ease-out select-none",
        !overviewOpen && "pointer-events-none opacity-0"
      )}
    >
      {/* Centered large active window card/preview */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-4">
        {windows.length === 0 || !activeWin ? (
          <div className="flex flex-col items-center gap-3 text-center text-white/80">
            <LayersIcon className="size-12 opacity-60" />
            <div className="text-base font-medium">{_("No open windows")}</div>
          </div>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[min(84vw,720px)] items-center justify-center gap-3"
          >
            <button
              type="button"
              aria-label={_("Previous Window")}
              disabled={clampedIndex <= 0}
              onClick={() => stepSelection(-1)}
              className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/22 disabled:opacity-25 sm:flex"
            >
              <ChevronLeftIcon className="size-5" />
            </button>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (swipedRef.current) {
                  swipedRef.current = false;
                  return;
                }
                activateWindow(activeWin.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activateWindow(activeWin.id);
                }
              }}
              className="group relative flex aspect-[16/10] max-h-[56vh] w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-adw-window/92 shadow-2xl ring-1 ring-white/10 transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              {/* Preview Headerbar */}
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/10 bg-black/5 px-3.5 dark:border-white/10 dark:bg-white/5">
                <div className="flex min-w-0 items-center gap-2">
                  <AppSquircleIcon
                    iconName={activeWin.iconName}
                    iconUrl={activeWin.iconUrl ?? getAppIconUrl(activeWin.appId)}
                    fallbackIconUrl={
                      activeWin.browserWindowId
                        ? getAppIconUrl("browser")
                        : undefined
                    }
                    squircle={Boolean(activeWin.browserWindowId)}
                    gradient={activeWin.gradient}
                    className="size-5 shrink-0"
                    glyphClassName="size-3.5"
                  />
                  <span className="truncate text-[13px] font-semibold text-adw-label">
                    {activeWin.title}
                  </span>
                </div>
                <WindowControlButton
                  aria-label={_("Close %s", activeWin.title)}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(activeWin.id);
                  }}
                  className="bg-black/10 dark:bg-white/15"
                >
                  <XIcon strokeWidth={2.25} />
                </WindowControlButton>
              </div>

              {/* Preview Body */}
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <AppSquircleIcon
                  iconName={activeWin.iconName}
                  iconUrl={activeWin.iconUrl ?? getAppIconUrl(activeWin.appId)}
                  fallbackIconUrl={
                    activeWin.browserWindowId
                      ? getAppIconUrl("browser")
                      : undefined
                  }
                  squircle={Boolean(activeWin.browserWindowId)}
                  gradient={activeWin.gradient}
                  className="size-20 shadow-lg sm:size-24"
                  glyphClassName="size-12"
                />
                <div className="max-w-md space-y-1">
                  <div className="truncate text-lg font-semibold text-adw-label">
                    {activeWin.title}
                  </div>
                  <div className="text-xs text-adw-label-secondary">
                    {activeWin.minimized
                      ? _("Minimized")
                      : activeWin.maximized
                        ? _("Maximized")
                        : `${Math.round(activeWin.size.width)} × ${Math.round(activeWin.size.height)}`}
                    {" · "}
                    {_("Tap to focus")}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              aria-label={_("Next Window")}
              disabled={clampedIndex >= windows.length - 1}
              onClick={() => stepSelection(1)}
              className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/22 disabled:opacity-25 sm:flex"
            >
              <ChevronRightIcon className="size-5" />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal bottom strip of window cards/icons */}
      {windows.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex w-full shrink-0 items-center justify-center px-4 pb-6 pt-2"
        >
          <div className="flex max-w-full items-center gap-2.5 overflow-x-auto rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5 backdrop-blur-xl">
            {windows.map((win, idx) => {
              const selected = idx === clampedIndex;
              const resolvedIconUrl = win.iconUrl ?? getAppIconUrl(win.appId);
              return (
                <button
                  key={win.id}
                  ref={(el) => {
                    if (el) stripItemRefs.current.set(win.id, el);
                    else stripItemRefs.current.delete(win.id);
                  }}
                  type="button"
                  onClick={() => {
                    if (swipedRef.current) {
                      swipedRef.current = false;
                      return;
                    }
                    if (selected) {
                      activateWindow(win.id);
                    } else {
                      setSelectedIndex(idx);
                    }
                  }}
                  className={cn(
                    "group relative flex w-28 shrink-0 flex-col items-center gap-1.5 rounded-xl px-2.5 py-2 text-center transition-all duration-150 sm:w-32",
                    selected
                      ? "scale-[1.03] bg-white/22 text-white ring-2 ring-white shadow-md"
                      : "bg-white/8 text-white/75 hover:bg-white/14 hover:text-white"
                  )}
                >
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
                  <span className="w-full truncate text-[11.5px] font-medium">
                    {win.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Overview overlay:
 * - Top workspaces strip with wallpaper thumbnails, mini window layouts, add/remove,
 *   and drag-to-move windows across workspaces
 * - Spread-out active-workspace window previews with overlapping app icon badge
 *   and title below
 * - In Touch Mode, renders a macOS Finder gallery view-style window switcher
 */
export function Overview() {
  const { settings } = useSettings();
  if (settings.touchMode) {
    return <TouchGalleryWindowSwitcher />;
  }
  return <WorkspaceOverview />;
}

function WorkspaceOverview() {
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
