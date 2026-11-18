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
        className="flex max-w-[90vw] flex-col items-center overflow-hidden rounded-[22px] px-5 py-4 text-adw-label shadow-adw-menu adw-material-menu animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
      >
        {mruWindows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-4 text-center text-adw-label-secondary">
            <SparklesIcon className="mb-2 size-7 text-adw-accent" />
            <p className="text-sm font-medium text-adw-label">
              No open windows
            </p>
          </div>
        ) : (
          <div className="flex max-w-full items-start gap-3 overflow-x-auto px-1 py-1">
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
                  className="group flex w-[84px] shrink-0 flex-col items-center gap-2 outline-none"
                >
                  <div
                    className={cn(
                      "flex size-[68px] items-center justify-center rounded-[16px] p-2 transition-all duration-100 motion-reduce:transition-none",
                      selected
                        ? "bg-black/14 ring-2 ring-adw-accent dark:bg-white/16"
                        : "bg-transparent hover:bg-black/6 dark:hover:bg-white/8",
                      win.minimized && "opacity-65"
                    )}
                  >
                    <AppSquircleIcon
                      iconName={win.iconName}
                      iconUrl={resolvedIconUrl}
                      fallbackIconUrl={
                        win.browserWindowId ? getAppIconUrl("browser") : undefined
                      }
                      squircle={Boolean(win.browserWindowId)}
                      gradient={win.gradient}
                      className="size-13"
                      glyphClassName="size-7"
                    />
                  </div>
                  <span
                    className={cn(
                      "line-clamp-2 max-w-full rounded px-1.5 py-0.5 text-center text-[11.5px] leading-tight font-medium transition-opacity",
                      selected
                        ? "bg-adw-accent text-white opacity-100"
                        : "text-adw-label-secondary opacity-0"
                    )}
                  >
                    {win.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
