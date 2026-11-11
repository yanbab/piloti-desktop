import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  MenuEntryKind,
  ToggleKind,
  type MenuEntry,
  type WatchedMenu,
} from "@domicile-desktop/sdk/dbusmenu";
import type { TrayItem } from "@domicile-desktop/sdk/tray";
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
import { MenubarExtra } from "@/components/ui/menubar";

function renderMenuEntries(
  entries: readonly MenuEntry[],
  watched: WatchedMenu | null
) {
  return entries.map((entry) => {
    if (entry.kind === MenuEntryKind.Separator) {
      return <DropdownMenuSeparator key={`sep-${entry.id}`} />;
    }

    if (entry.submenu && entry.submenu.length > 0) {
      return (
        <DropdownMenuSub key={entry.id}>
          <DropdownMenuSubTrigger>{entry.label}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {renderMenuEntries(entry.submenu, watched)}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }

    if (entry.toggle?.kind === ToggleKind.Checkmark) {
      return (
        <DropdownMenuCheckboxItem
          key={entry.id}
          disabled={!entry.enabled}
          checked={entry.toggle.checked}
          onClick={() => void watched?.click(entry.id)}
        >
          {entry.label}
        </DropdownMenuCheckboxItem>
      );
    }

    if (entry.toggle?.kind === ToggleKind.Radio) {
      return (
        <DropdownMenuRadioGroup
          key={entry.id}
          value={entry.toggle.checked ? String(entry.id) : ""}
        >
          <DropdownMenuRadioItem
            value={String(entry.id)}
            disabled={!entry.enabled}
            onClick={() => void watched?.click(entry.id)}
          >
            {entry.label}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );
    }

    return (
      <DropdownMenuItem
        key={entry.id}
        disabled={!entry.enabled}
        onClick={() => void watched?.click(entry.id)}
      >
        {entry.image && (
          <img src={entry.image} alt="" className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{entry.label}</span>
      </DropdownMenuItem>
    );
  });
}

/**
 * Renders a StatusNotifierItem tray indicator with live DBusMenu support when
 * the application exports a `bus` and `menu` object path.
 */
export function TrayIndicatorButton({ item }: { item: TrayItem }) {
  const domicile = useDomicile();
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<readonly MenuEntry[]>([]);
  const watchedRef = React.useRef<WatchedMenu | null>(null);
  const hasMenu = Boolean(item.bus && item.menu);

  React.useEffect(() => {
    if (!hasMenu || !item.bus || !item.menu) return;
    const watched = domicile.tray.menu(
      { bus: item.bus, path: item.menu },
      (res) => {
        res.match({
          Ok: (list) => setEntries(list),
          Err: () => {},
        });
      }
    );
    watchedRef.current = watched;
    return () => {
      watched.stop();
      watchedRef.current = null;
    };
  }, [domicile.tray, hasMenu, item.bus, item.menu]);

  const iconEl = item.icon ? (
    <img src={item.icon} alt={item.title} className="size-3.5" />
  ) : (
    <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
  );

  if (!hasMenu) {
    return (
      <MenubarExtra
        title={item.title}
        onClick={() => domicile.tray.activate(item.id, "primary")}
        className="px-2"
      >
        {iconEl}
      </MenubarExtra>
    );
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void watchedRef.current?.aboutToShow(0);
        }
      }}
    >
      <DropdownMenuTrigger
        title={item.title}
        onClick={(e) => {
          if (!item.itemIsMenu) {
            e.preventDefault();
            domicile.tray.activate(item.id, "primary");
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
          void watchedRef.current?.aboutToShow(0);
        }}
        className="flex h-5 cursor-default items-center rounded-full px-2 outline-none select-none hover:bg-white/12 data-popup-open:bg-white/15"
      >
        {iconEl}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        {entries.length === 0 ? (
          <DropdownMenuItem disabled>No menu actions</DropdownMenuItem>
        ) : (
          renderMenuEntries(entries, watchedRef.current)
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
