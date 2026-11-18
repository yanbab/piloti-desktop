import * as React from "react";
import { MoreVerticalIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWindowManager } from "@/context/DesktopStateContext";
import { _ } from "@/lib/i18n";

export type WindowVisualEffect =
  | "normal"
  | "invert"
  | "grayscale"
  | "translucent";

export interface WindowVisualModifier {
  effect: WindowVisualEffect;
  alwaysOnTop: boolean;
}

const windowModifiers = new Map<string, WindowVisualModifier>();
const modifierListeners = new Set<() => void>();
let modifierSnapshot: ReadonlyMap<string, WindowVisualModifier> = new Map();

function emitModifierChange() {
  modifierSnapshot = new Map(windowModifiers);
  for (const listener of modifierListeners) {
    listener();
  }
}

export function setWindowVisualEffect(
  windowId: string,
  effect: WindowVisualEffect,
) {
  const prev = windowModifiers.get(windowId) ?? {
    effect: "normal",
    alwaysOnTop: false,
  };
  windowModifiers.set(windowId, { ...prev, effect });
  emitModifierChange();
}

export function toggleWindowAlwaysOnTop(windowId: string) {
  const prev = windowModifiers.get(windowId) ?? {
    effect: "normal",
    alwaysOnTop: false,
  };
  windowModifiers.set(windowId, { ...prev, alwaysOnTop: !prev.alwaysOnTop });
  emitModifierChange();
}

export function useWindowVisualModifiers(): ReadonlyMap<
  string,
  WindowVisualModifier
> {
  return React.useSyncExternalStore(
    (cb) => {
      modifierListeners.add(cb);
      return () => modifierListeners.delete(cb);
    },
    () => modifierSnapshot,
    () => modifierSnapshot,
  );
}

export function WindowMenuButton({
  windowId,
  extraItems,
}: {
  windowId?: string;
  appId?: string;
  iconUrl?: string;
  iconName?: string;
  gradient?: string;
  isWebApp?: boolean;
  extraItems?: React.ReactNode;
}) {
  const {
    windows,
    minimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
    closeWindow,
  } = useWindowManager();
  const modifiers = useWindowVisualModifiers();

  const win = windowId ? windows.find((w) => w.id === windowId) : undefined;
  const mod = (windowId ? modifiers.get(windowId) : undefined) ?? {
    effect: "normal" as WindowVisualEffect,
    alwaysOnTop: false,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={_("Window menu")}
        className="group/wmenu flex size-7 shrink-0 cursor-default items-center justify-center rounded-md outline-none select-none active:bg-black/12 data-popup-open:bg-black/10 dark:active:bg-white/16 dark:data-popup-open:bg-white/14"
      >
        <MoreVerticalIcon className="size-4 opacity-75 group-hover/wmenu:opacity-100 group-active/wmenu:opacity-100 group-data-popup-open/wmenu:opacity-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {extraItems && (
          <>
            {extraItems}
            {windowId && <DropdownMenuSeparator />}
          </>
        )}
        {windowId && (
          <>
            <DropdownMenuItem onClick={() => minimizeWindow(windowId)}>
              {_("Minimize")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleMaximizeWindow(windowId)}>
              {win?.maximized ? _("Restore") : _("Maximize")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tileWindow(windowId, "left")}>
              {_("Tile Left")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tileWindow(windowId, "right")}>
              {_("Tile Right")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {_("Effects")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuCheckboxItem
                  checked={mod.alwaysOnTop}
                  onClick={() => toggleWindowAlwaysOnTop(windowId)}
                >
                  {_("Always on Top")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={mod.effect}
                  onValueChange={(val) =>
                    setWindowVisualEffect(windowId, val as WindowVisualEffect)
                  }
                >
                  <DropdownMenuRadioItem value="normal">
                    {_("Normal")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="invert">
                    {_("Night Reader (Invert)")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="grayscale">
                    {_("Grayscale")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="translucent">
                    {_("Translucent (85%)")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => closeWindow(windowId)}>
              {_("Close")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
