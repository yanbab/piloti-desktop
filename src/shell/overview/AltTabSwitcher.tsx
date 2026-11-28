import { SparklesIcon } from "lucide-react";
import {
  useApps,
  useWindowManagerSelector,
} from "@/context/DesktopStateContext";
import { cn } from "@/lib/core/utils";
import { AppSquircleIcon } from "@/components/common/AppSymbol";

export function AltTabSwitcher() {
  const { getAppIconUrl } = useApps();
  const {
    altTabOpen,
    altTabIndex,
    mruWindows,
    setAltTabIndex,
    commitAltTab,
    closeAltTab,
  } = useWindowManagerSelector((wm) => ({
    altTabOpen: wm.altTabOpen,
    altTabIndex: wm.altTabIndex,
    mruWindows: wm.mruWindows,
    setAltTabIndex: wm.setAltTabIndex,
    commitAltTab: wm.commitAltTab,
    closeAltTab: wm.closeAltTab,
  }));

  return (
    <div
      aria-hidden={!altTabOpen || undefined}
      className={
        altTabOpen
          ? "fixed inset-0 z-[500] flex items-center justify-center p-6"
          : "hidden"
      }
      onClick={() => closeAltTab()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-w-[90vw] flex-col items-center overflow-hidden rounded-[22px] px-5 py-4 text-ui-label shadow-ui-menu ui-material-menu"
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
                  tabIndex={-1}
                  onPointerEnter={() => setAltTabIndex(index)}
                  onClick={() => commitAltTab(win.id)}
                  className="group relative flex w-[92px] shrink-0 flex-col items-center outline-none focus-visible:outline-none"
                >
                  <div
                    className={cn(
                      "flex size-[80px] items-center justify-center rounded-[18px] p-2",
                      selected
                        ? "bg-black/14 dark:bg-white/16"
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
