import { isCloseOnLeft, WINDOW_CONTROL_CLASS } from "@/components/ui/window";
import { cn } from "@/lib/core/utils";
import * as React from "react";
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
  useChromeSettings,
  useWindowActions,
  useWindowManagerSelector,
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
  const { settings } = useChromeSettings();
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
        onClick={() => setOpen((v) => !v)}
        // Same round button as Close; mx-0.5 keeps it centred 23px from the
        // edge, above the sidebar icons.
        className={cn(
          WINDOW_CONTROL_CLASS,
          "mx-0.5 shrink-0 cursor-default select-none data-popup-open:bg-black/14 dark:data-popup-open:bg-white/18"
        )}
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
 * The symbolic version of the window's app icon, drawn in the text colour;
 * a centred dot when the icon theme has none.
 */
function WindowMenuIcon({ windowId }: { windowId?: string }) {
  const appId = useWindowManagerSelector(
    (wm) => wm.windows.find((w) => w.id === windowId)?.appId
  );
  const load = useOptionalApps()?.loadSymbolicAppIcon;
  const [url, setUrl] = React.useState<string>();

  React.useEffect(() => {
    let stale = false;
    void (appId ? load?.(appId) : undefined)?.then((next) => {
      if (!stale) setUrl(next);
    });
    return () => {
      stale = true;
    };
  }, [appId, load]);

  if (!url) {
    return <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />;
  }
  const mask = `url("${url}") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      data-slot="window-menu-icon"
      className="size-3.5 bg-current"
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
