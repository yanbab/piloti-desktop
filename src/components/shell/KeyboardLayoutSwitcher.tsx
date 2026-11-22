import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { KeymapChoice } from "@domicile-desktop/sdk/keymap-choice";
import { KeyboardIcon } from "lucide-react";
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
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const [liveLayouts, setLiveLayouts] = React.useState<KeyboardLayoutOption[]>([]);
  const [liveActive, setLiveActive] = React.useState<string>("");

  React.useEffect(() => {
    if (isBrowserRuntime || typeof domicile.keyboard?.keymaps !== "function") {
      return;
    }
    let active = true;
    let stopListening: (() => void) | undefined;
    let reader: ReadableStreamDefaultReader<{
      active: string;
      keymaps: readonly { name: string; description: string | undefined }[];
    }> | null = null;

    void domicile.keyboard
      .keymaps()
      .then(async (res) => {
        if (!active) {
          res.match({ Ok: (l) => l.stop(), Err: () => undefined });
          return;
        }
        const listening = res.match({ Ok: (l) => l, Err: () => null });
        if (!listening) return;
        stopListening = listening.stop;
        reader = listening.items.getReader();
        while (active) {
          const { done, value: next } = await reader.read();
          if (done || !active) break;
          setLiveLayouts(
            next.keymaps.map((km) => ({
              id: km.name,
              short: formatShortLayoutCode(km.name, km.description),
              label: km.description || km.name.toUpperCase(),
            }))
          );
          setLiveActive(next.active);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void reader?.cancel().catch(() => undefined);
      stopListening?.();
    };
  }, [domicile, isBrowserRuntime]);

  const layouts = React.useMemo(() => {
    if (liveLayouts.length > 0) return liveLayouts;
    return fallbackLayouts ?? [];
  }, [fallbackLayouts, liveLayouts]);

  if (layouts.length <= 1) {
    return null;
  }

  const activeId =
    (liveLayouts.length > 0 ? liveActive : value) || layouts[0].id;
  const activeLayout =
    layouts.find((kb) => kb.id === activeId) ?? layouts[0];

  const handleSelect = (nextId: string) => {
    if (liveLayouts.length > 0) {
      setLiveActive(nextId);
    }
    if (!isBrowserRuntime && typeof domicile.keyboard?.selectKeymap === "function") {
      void domicile.keyboard
        .selectKeymap(KeymapChoice.Named(nextId))
        .catch(() => undefined);
    }
    onValueChange?.(nextId);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={_("Keyboard Layout")}
        title={activeLayout.label}
        className={cn(
          "flex h-full shrink-0 cursor-default items-center gap-1 rounded-md px-2 text-[12px] font-medium uppercase outline-none select-none transition-colors hover:bg-black/8 active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12",
          triggerClassName
        )}
      >
        <KeyboardIcon className="size-3.5 opacity-85" />
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
