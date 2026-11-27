import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePiloti } from "@/lib/engine/piloti";
import { PreviewedWindow } from "@domicile-desktop/sdk/previewed-window";
import { SparklesIcon } from "lucide-react";
import {
  useApps,
  useSettings,
  useWindowManager,
  type DesktopWindowInstance,
} from "@/context/DesktopStateContext";
import { cn } from "@/lib/core/utils";
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
        className="h-full w-full bg-ui-hud-dark object-contain"
      />
    );
  }

  if (win.appId === "settings") {
    return (
      <div className="flex h-full bg-ui-hud-dark text-ui-caption">
        <div className="flex w-1/3 flex-col gap-1.5 border-r border-white/10 bg-white/5 p-2">
          <div className="h-2 w-4/5 rounded-full bg-ui-accent/60" />
          <div className="h-2 w-3/4 rounded-full bg-white/20" />
          <div className="h-2 w-2/3 rounded-full bg-white/15" />
          <div className="h-2 w-4/5 rounded-full bg-white/15" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-2.5">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-ui-blue" />
            <span className="size-3 rounded-full bg-ui-purple" />
            <span className="size-3 rounded-full bg-ui-pink" />
            <span className="size-3 rounded-full bg-ui-green" />
          </div>
          <div className="h-5 rounded-ui-control bg-white/10" />
          <div className="h-5 rounded-ui-control bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-ui-hud-dark p-3 text-center">
      <AppSquircleIcon
        iconName={win.iconName}
        iconUrl={win.iconUrl}
        squircle={Boolean(win.browserWindowId)}
        className="size-9"
        glyphClassName="size-5"
      />
      <span className="max-w-full truncate text-ui-caption text-white/70">
        {win.waylandAppId
          ? `Wayland · ${win.waylandAppId}`
          : `${win.size.width}×${win.size.height}`}
      </span>
    </div>
  );
}

export function AltTabSwitcher() {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
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
    if (!altTabOpen || !systemServices) return;
    let cancelled = false;

    const waylandWins = mruWindows.filter((w) => Boolean(w.waylandAppId));
    if (waylandWins.length === 0) return;

    Promise.all(
      waylandWins.map(async (w) => {
        if (!w.waylandAppId) return;
        try {
          const res = await piloti.capture.preview(
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
  }, [altTabOpen, piloti.capture, systemServices, mruWindows]);

  if (!altTabOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6"
      onClick={() => closeAltTab()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-w-[90vw] flex-col items-center overflow-hidden rounded-[22px] px-5 py-4 text-ui-label shadow-ui-menu ui-material-menu animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
      >
        {mruWindows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-4 text-center text-ui-label-secondary">
            <SparklesIcon className="mb-2 size-7 text-ui-accent" />
            <p className="text-ui-body font-medium text-ui-label">
              No open windows
            </p>
          </div>
        ) : (
          <div
            role="listbox"
            aria-label="Window switcher"
            aria-activedescendant={mruWindows[altTabIndex]?.id ? `alttab-${mruWindows[altTabIndex].id}` : undefined}
            className="flex max-w-full items-start gap-3 overflow-x-auto px-4 pt-1 pb-8"
          >
            {mruWindows.map((win, index) => {
              const selected = index === altTabIndex;
              const resolvedIconUrl =
                win.iconUrl ?? getAppIconUrl(win.appId);
              return (
                <button
                  key={win.id}
                  id={`alttab-${win.id}`}
                  role="option"
                  aria-selected={selected}
                  type="button"
                  onPointerEnter={() => setAltTabIndex(index)}
                  onClick={() => commitAltTab(win.id)}
                  className="group relative flex w-[92px] shrink-0 flex-col items-center outline-none"
                >
                  <div
                    className={cn(
                      "flex size-[80px] items-center justify-center rounded-[18px] p-2 transition-all duration-100 motion-reduce:transition-none",
                      selected
                        ? "bg-black/14 ring-2 ring-ui-accent dark:bg-white/16"
                        : "bg-transparent hover-fill:bg-black/6 dark:hover-fill:bg-white/8",
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
                      className="size-16"
                      glyphClassName="size-8"
                    />
                  </div>
                  {selected && (
                    <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-ui-body font-medium text-ui-label-secondary">
                      {win.title}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
