import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePiloti } from "@/lib/engine/piloti";
import { KeyboardIcon } from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettings } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { selectKeymap, useKeymaps } from "@/lib/engine/keyboard";

export interface KeyboardLayoutOption {
  id: string;
  short: string;
  label: string;
}

function formatShortLayoutCode(name: string, description?: string): string {
  const clean = name.trim();
  if (clean) {
    return clean.slice(0, 2).toLowerCase();
  }
  return (description ?? "kb").trim().slice(0, 2).toLowerCase() || "kb";
}

export interface KeyboardLayoutSwitcherProps {
  /** Fallback layouts when compositor keymaps are unavailable (e.g. browser greeter preview). */
  fallbackLayouts?: readonly KeyboardLayoutOption[];
  /** Optional controlled active layout ID (used by fallback/greeter state). */
  value?: string;
  /** Called whenever the user picks a layout. */
  onValueChange?: (layoutId: string) => void;
  /** Optional trigger button classes. */
  triggerClassName?: string;
  /** Dropdown alignment. */
  align?: "start" | "end" | "center";
  /** Dropdown side offset. */
  sideOffset?: number;
}

export function KeyboardLayoutSwitcher({
  fallbackLayouts,
  value,
  onValueChange,
  triggerClassName,
  align = "end",
  sideOffset = 4,
}: KeyboardLayoutSwitcherProps) {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
  const live = useKeymaps();
  const [picked, setPicked] = React.useState("");
  React.useEffect(() => setPicked(""), [live]);
  const liveLayouts = React.useMemo<KeyboardLayoutOption[]>(
    () =>
      live.keymaps.map((km) => ({
        id: km.name,
        short: formatShortLayoutCode(km.name, km.description),
        label: km.description || km.name.toUpperCase(),
      })),
    [live],
  );

  const layouts = React.useMemo(() => {
    if (liveLayouts.length > 0) return liveLayouts;
    return fallbackLayouts ?? [];
  }, [fallbackLayouts, liveLayouts]);

  if (layouts.length <= 1) {
    return null;
  }

  const activeId =
    (liveLayouts.length > 0 ? picked || live.active : value) || layouts[0].id;
  const activeLayout =
    layouts.find((kb) => kb.id === activeId) ?? layouts[0];

  const handleSelect = (nextId: string) => {
    setPicked(nextId);
    if (systemServices) selectKeymap(piloti, nextId);
    onValueChange?.(nextId);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={_("Keyboard Layout")}
        title={activeLayout.label}
        className={cn(
          "flex h-full shrink-0 cursor-default items-center gap-1 rounded-ui-control px-2 text-ui-body font-medium uppercase outline-none select-none transition-colors hover-fill:bg-black/8 active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:hover-fill:bg-white/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12",
          triggerClassName
        )}
      >
        <SymbolicIcon name="input-keyboard" fallback={KeyboardIcon} className="size-3.5 opacity-85" />
        <span>{activeLayout.short}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={sideOffset} className="w-48">
        <DropdownMenuLabel>{_("Keyboard Layout")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={activeId} onValueChange={handleSelect}>
          {layouts.map((kb) => (
            <DropdownMenuRadioItem key={kb.id} value={kb.id}>
              {kb.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
