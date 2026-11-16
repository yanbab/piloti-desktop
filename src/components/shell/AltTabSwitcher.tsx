import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { PreviewedWindow } from "@domicile-desktop/sdk/previewed-window";
import { Minimize2Icon, SparklesIcon } from "lucide-react";
import {
  useApps,
  useSettings,
  useWindowManager,
  type DesktopWindowInstance,
} from "@/context/DesktopStateContext";
import { cn } from "@/lib/utils";
import { AppSquircleIcon } from "./AppSymbol";

function WindowMiniPreview({
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
        className="h-full w-full bg-zinc-950 object-contain"
      />
    );
  }

  if (win.appId === "settings") {
    return (
      <div className="flex h-full bg-zinc-900/90 text-[10px]">
        <div className="flex w-1/3 flex-col gap-1.5 border-r border-white/10 bg-white/5 p-2">
          <div className="h-2 w-4/5 rounded-full bg-sky-500/60" />
          <div className="h-2 w-3/4 rounded-full bg-white/20" />
          <div className="h-2 w-2/3 rounded-full bg-white/15" />
          <div className="h-2 w-4/5 rounded-full bg-white/15" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-2.5">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-blue-500" />
            <span className="size-3 rounded-full bg-purple-500" />
            <span className="size-3 rounded-full bg-pink-500" />
            <span className="size-3 rounded-full bg-emerald-500" />
          </div>
          <div className="h-5 rounded-md bg-white/10" />
          <div className="h-5 rounded-md bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-zinc-900 to-zinc-950 p-3 text-center">
      <AppSquircleIcon
        iconName={win.iconName}
        iconUrl={win.iconUrl}
        squircle={Boolean(win.browserWindowId)}
        gradient={win.gradient}
        className="size-9"
        glyphClassName="size-5"
      />
      <span className="max-w-full truncate text-[10px] text-white/70">
        {win.waylandAppId
          ? `Wayland · ${win.waylandAppId}`
          : `${win.size.width}×${win.size.height}`}
      </span>
    </div>
  );
}

export function AltTabSwitcher() {
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const { getAppIconUrl } = useApps();
  const {
    altTabOpen,
    altTabIndex,
    setAltTabIndex,
    mruWindows,
    commitAltTab,
    closeAltTab,
  } = useWindowManager();

  const [previews, setPreviews] = React.useState<Record<string, string>>({});

  // Capture live PNG thumbnails for Wayland windows via `domicile.capture.preview`
  React.useEffect(() => {
    if (!altTabOpen || isBrowserRuntime) return;
    let cancelled = false;

    const waylandWins = mruWindows.filter((w) => Boolean(w.waylandAppId));
    if (waylandWins.length === 0) return;

    Promise.all(
      waylandWins.map(async (w) => {
        if (!w.waylandAppId) return;
        try {
          const res = await domicile.capture.preview(
            PreviewedWindow.App(w.waylandAppId)
          );
          res.match({
            Ok: (dataUrl) => {
              if (!cancelled && dataUrl) {
                setPreviews((prev) => ({ ...prev, [w.id]: dataUrl }));
              }
            },
            Err: () => {},
          });
        } catch {
          // ignore if unavailable
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [altTabOpen, domicile.capture, isBrowserRuntime, mruWindows]);

  if (!altTabOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6"
      onClick={() => closeAltTab()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[82vh] w-full max-w-[820px] flex-col overflow-hidden rounded-adw-menu p-3.5 text-adw-label shadow-adw-menu adw-material-menu animate-in fade-in-0 duration-150 motion-reduce:animate-none"
      >
        {/* Windows Grid */}
        {mruWindows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-adw-label-secondary">
            <SparklesIcon className="mb-2 size-8 text-adw-accent" />
            <p className="text-sm font-medium text-adw-label">
              No open windows
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4">
            {mruWindows.map((win, index) => {
              const selected = index === altTabIndex;
              const resolvedIconUrl =
                win.iconUrl ?? getAppIconUrl(win.appId);
              return (
                <button
                  key={win.id}
                  type="button"
                  onPointerEnter={() => setAltTabIndex(index)}
                  onClick={() => commitAltTab(win.id)}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-adw-item p-2 text-left transition-all duration-150 outline-none motion-reduce:transition-none",
                    selected
                      ? "scale-[1.02] bg-adw-fill-primary ring-2 ring-adw-accent shadow-md"
                      : "bg-adw-fill-tertiary ring-1 ring-adw-border hover:bg-adw-fill-secondary"
                  )}
                >
                  {/* Window Card Header */}
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <AppSquircleIcon
                      iconName={win.iconName}
                      iconUrl={resolvedIconUrl}
                      fallbackIconUrl={
                        win.browserWindowId ? getAppIconUrl("browser") : undefined
                      }
                      squircle={Boolean(win.browserWindowId)}
                      gradient={win.gradient}
                      className="size-5 shrink-0"
                      glyphClassName="size-3"
                    />
                    <span className="truncate text-[12px] font-medium text-adw-label">
                      {win.title}
                    </span>
                    {win.minimized && (
                      <span
                        title="Minimized"
                        className="ml-auto flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-500 dark:text-amber-300"
                      >
                        <Minimize2Icon className="size-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Miniature Window Frame Preview */}
                  <div className="relative h-28 w-full overflow-hidden rounded-[10px] border border-adw-border bg-zinc-950 shadow-inner">
                    <div className="flex h-4 items-center gap-1 border-b border-white/10 bg-zinc-900 px-2">
                      <span className="size-1.5 rounded-full bg-rose-500/80" />
                      <span className="size-1.5 rounded-full bg-amber-400/80" />
                      <span className="size-1.5 rounded-full bg-emerald-500/80" />
                      <span className="ml-auto text-[8px] text-white/40">
                        WS {win.workspace}
                      </span>
                    </div>
                    <div className="h-[calc(100%-16px)] w-full">
                      <WindowMiniPreview
                        win={{ ...win, iconUrl: resolvedIconUrl }}
                        captureUrl={previews[win.id]}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
