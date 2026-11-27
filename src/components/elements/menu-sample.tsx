import * as React from "react";
import { CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuBadge,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MENU_BADGE_CLASS,
  MENU_CHECK_ITEM_CLASS,
  MENU_ITEM_CLASS,
  MENU_LABEL_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
  MENU_SHORTCUT_CLASS,
  MENU_SUB_TRIGGER_CLASS,
} from "@/components/ui/menu-styles";
import { CheckIcon, ChevronRightIcon, FolderIcon, InfoIcon, SaveIcon } from "@/components/ui/symbols";

const CHECK_SLOT = "pointer-events-none absolute left-[10px] flex size-3.5 items-center justify-center";

/**
 * Every menu item type, drawn in the page with the menus' classes (a real menu
 * only exists while open), then a button that opens the same items for real.
 */
export function InlineMenuSample() {
  const [hidden, setHidden] = React.useState(true);
  const [sort, setSort] = React.useState("name");
  const [hover, setHover] = React.useState<string | null>(null);

  const item = (id: string, className = MENU_ITEM_CLASS) => ({
    className,
    "data-highlighted": hover === id ? "" : undefined,
    onPointerEnter: () => setHover(id),
    onPointerLeave: () => setHover(null),
  });
  const radio = (id: string, label: string) => (
    <div role="menuitemradio" aria-checked={sort === id} onClick={() => setSort(id)} {...item(id, MENU_CHECK_ITEM_CLASS)}>
      <span className={CHECK_SLOT}>{sort === id && <CircleIcon className="size-1.5 fill-current" />}</span>
      {label}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="menu" className={`${MENU_POPUP_CLASS} w-56`}>
        <div data-slot="dropdown-menu-label" className={MENU_LABEL_CLASS}>Label</div>
        <div role="menuitem" {...item("plain")}>Item</div>
        <div role="menuitem" {...item("folder")}><FolderIcon />New Folder</div>
        <div role="menuitem" {...item("save")}>
          <SaveIcon />Save<span data-slot="dropdown-menu-shortcut" className={MENU_SHORTCUT_CLASS}>⌘S</span>
        </div>
        <div role="menuitem" {...item("badge")}>
          <InfoIcon />Updates<span data-slot="dropdown-menu-badge" className={MENU_BADGE_CLASS}>2</span>
        </div>
        <div role="menuitem" {...item("sub", MENU_SUB_TRIGGER_CLASS)}>
          Submenu<ChevronRightIcon className="ml-auto size-3.5" />
        </div>
        <div role="menuitem" {...item("inset")} data-inset="">Inset item</div>
        <div role="menuitem" aria-disabled className={MENU_ITEM_CLASS} data-disabled="">Disabled item</div>
        <div role="separator" className={MENU_SEPARATOR_CLASS} />
        <div role="menuitemcheckbox" aria-checked={hidden} onClick={() => setHidden((v) => !v)} {...item("check", MENU_CHECK_ITEM_CLASS)}>
          <span className={CHECK_SLOT}>{hidden && <CheckIcon className="size-3.5" strokeWidth={2.5} />}</span>
          Show Hidden Files
        </div>
        <div role="separator" className={MENU_SEPARATOR_CLASS} />
        {radio("name", "Sort by Name")}
        {radio("kind", "Sort by Kind")}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" />}>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56">
          <DropdownMenuLabel>Label</DropdownMenuLabel>
          <DropdownMenuItem>Item</DropdownMenuItem>
          <DropdownMenuItem><FolderIcon />New Folder</DropdownMenuItem>
          <DropdownMenuItem>
            <SaveIcon />Save<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <InfoIcon />Updates<DropdownMenuBadge>2</DropdownMenuBadge>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem inset>Inset item</DropdownMenuItem>
          <DropdownMenuItem disabled>Disabled item</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={hidden} onCheckedChange={(v) => setHidden(Boolean(v))}>
            Show Hidden Files
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(String(v))}>
            <DropdownMenuRadioItem value="name">Sort by Name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="kind">Sort by Kind</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const MENU_CODE = `<DropdownMenuContent>
  <DropdownMenuLabel>Label</DropdownMenuLabel>
  <DropdownMenuItem>Item</DropdownMenuItem>
  <DropdownMenuItem><FolderIcon />New Folder</DropdownMenuItem>
  <DropdownMenuItem>
    <SaveIcon />Save
    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
  </DropdownMenuItem>
  <DropdownMenuItem>
    <InfoIcon />Updates<DropdownMenuBadge>2</DropdownMenuBadge>
  </DropdownMenuItem>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
    <DropdownMenuSubContent>…</DropdownMenuSubContent>
  </DropdownMenuSub>
  <DropdownMenuItem inset>Inset item</DropdownMenuItem>
  <DropdownMenuItem disabled>Disabled item</DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuCheckboxItem checked={hidden}>
    Show Hidden Files
  </DropdownMenuCheckboxItem>
  <DropdownMenuRadioGroup value={sort}>
    <DropdownMenuRadioItem value="name">
      Sort by Name
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</DropdownMenuContent>`;

const ICON_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h4l1.5 1.5H14V13H2z"/></svg>`;

export const MENU_HTML = `<div class="ui-menu ui-material-menu" role="menu" style="width: 14rem">
  <div class="ui-menu-label">Label</div>
  <div class="ui-menu-item" role="menuitem">Item</div>
  <div class="ui-menu-item" role="menuitem">${ICON_SVG}New Folder</div>
  <div class="ui-menu-item" role="menuitem" data-highlighted>Save<span class="ui-menu-shortcut">⌘S</span></div>
  <div class="ui-menu-item" role="menuitem">Updates<span class="ui-menu-badge">2</span></div>
  <div class="ui-menu-item ui-menu-subtrigger" role="menuitem">Submenu<span style="margin-left: auto">›</span></div>
  <div class="ui-menu-item" role="menuitem" data-inset>Inset item</div>
  <div class="ui-menu-item" role="menuitem" data-disabled>Disabled item</div>
  <div class="ui-menu-separator" role="separator"></div>
  <div class="ui-menu-item ui-menu-check-item" role="menuitemcheckbox" aria-checked="true"><span style="position: absolute; left: 10px">✓</span>Show Hidden Files</div>
  <div class="ui-menu-item ui-menu-check-item" role="menuitemradio" aria-checked="true"><span style="position: absolute; left: 12px">•</span>Sort by Name</div>
</div>`;
