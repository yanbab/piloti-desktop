import { isCloseOnLeft } from "@/components/ui/window";
import * as React from "react";
import { AppWindowIcon } from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import { countRender } from "@/lib/core/render-stats";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useWindowActions,
  useWindowManagerSelector,
  useDesktopSettings,
} from "@/context/DesktopStateContext";
import { useOptionalApps } from "@/context/AppsContext";
import { _ } from "@/lib/core/i18n";
import {
  getWindowMenuItems,
  subscribeWindowPresentation,
} from "@/lib/shell/window-presentation";

export const WindowMenuButton = React.memo(function WindowMenuButton({
  windowId,
  side,
  extraItems,
}: {
  windowId?: string;
  /** Draws only when this is the side opposite the window controls. */
  side?: "left" | "right";
  appId?: string;
  iconUrl?: string;
  iconName?: string;
  gradient?: string;
  isWebApp?: boolean;
  extraItems?: React.ReactNode;
}) {
  countRender("WindowMenuButton");
  const settings = useDesktopSettings(["showWindowMenu", "windowButtonLayout"]);
  const [open, setOpen] = React.useState(false);

  if (!settings.showWindowMenu) {
    return null;
  }
  const menuSide = isCloseOnLeft(settings.windowButtonLayout) ? "right" : "left";
  if (side && side !== menuSide) {
    return null;
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen && eventDetails?.reason === "trigger-press") {
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <DropdownMenuTrigger
        aria-label={_("Window menu")}
        data-window-menu=""
        onClick={() => setOpen((v) => !v)}
        // A bare symbol in the sidebar icons' colour, focused window or not,
        // full when pressed or open. Sized like Close; mx-0.5
        // keeps it centred 23px from the edge, above the sidebar icons.
        className="mx-0.5 flex size-6 shrink-0 cursor-default select-none items-center justify-center rounded-full text-[color-mix(in_oklab,var(--ui-label)_85%,transparent)] outline-none *:opacity-85 active:*:opacity-100 data-popup-open:*:opacity-100 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-ui-accent/50 active:text-black data-popup-open:text-black dark:active:text-white dark:data-popup-open:text-white"
      >
        <WindowMenuIcon windowId={windowId} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={menuSide === "left" ? "start" : "end"}>
        {extraItems && (
          <>
            {extraItems}
            {windowId && <DropdownMenuSeparator />}
          </>
        )}
        {windowId && (
          <WindowMenuItems windowId={windowId} onSelect={() => setOpen(false)} />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

/**
 * The symbolic version of the window's app icon, drawn in the text colour; a
 * generic app symbol when the icon theme has none, nothing while it loads.
 */
function WindowMenuIcon({ windowId }: { windowId?: string }) {
  const appId = useWindowManagerSelector(
    (wm) => wm.windows.find((w) => w.id === windowId)?.appId
  );
  const load = useOptionalApps()?.loadSymbolicAppIcon;
  // undefined while loading, null when there is none.
  const [url, setUrl] = React.useState<string | null>();

  React.useEffect(() => {
    let stale = false;
    void Promise.resolve(appId ? load?.(appId) : undefined).then((next) => {
      if (!stale) setUrl(next ?? null);
    });
    return () => {
      stale = true;
    };
  }, [appId, load]);

  if (!url) {
    return url === null ? (
      <SymbolicIcon name="application-x-executable" fallback={AppWindowIcon} className="size-4" />
    ) : (
      <span className="size-4" />
    );
  }
  const mask = `url("${url}") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      data-slot="window-menu-icon"
      className="size-4 bg-current"
      style={{ mask, WebkitMask: mask }}
    />
  );
}

/**
 * The window's own entries: Minimize, Maximize, Tile, plugin entries (after
 * a separator), Close. One list for the ⋮ button and the titlebar
 * right-click menu, so they always match.
 */
export function WindowMenuItems({
  windowId,
  onSelect,
}: {
  windowId: string;
  /** Called after any entry runs (e.g. to close a controlled menu). */
  onSelect?: () => void;
}) {
  const { minimizeWindow, toggleMaximizeWindow, tileWindow, closeWindow } =
    useWindowActions();
  // Only re-render when *this* window's maximized state changes.
  const maximized = useWindowManagerSelector(
    (wm) => wm.windows.find((w) => w.id === windowId)?.maximized ?? false
  );
  const pluginItems = React.useSyncExternalStore(
    subscribeWindowPresentation,
    getWindowMenuItems,
    getWindowMenuItems,
  );
  const visiblePluginItems = pluginItems.filter(
    (item) => item.visible?.(windowId) ?? true
  );
  const run = (fn: () => void) => () => {
    fn();
    onSelect?.();
  };

  return (
    <>
      <DropdownMenuItem onClick={run(() => minimizeWindow(windowId))}>
        {_("Minimize")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={run(() => toggleMaximizeWindow(windowId))}>
        {maximized ? _("Restore") : _("Maximize")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={run(() => tileWindow(windowId, "left"))}>
        {_("Left Side")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={run(() => tileWindow(windowId, "right"))}>
        {_("Right Side")}
      </DropdownMenuItem>
      {visiblePluginItems.length > 0 && <DropdownMenuSeparator />}
      {visiblePluginItems.map((item) => (
        <DropdownMenuCheckboxItem
          key={item.id}
          checked={item.checked?.(windowId) ?? false}
          onCheckedChange={run(() => item.onSelect(windowId))}
        >
          {item.label}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={run(() => closeWindow(windowId))}>
        {_("Close")}
      </DropdownMenuItem>
    </>
  );
}
