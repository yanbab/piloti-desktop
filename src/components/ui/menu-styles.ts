/**
 * Shared Tailwind class presets for GNOME Adwaita / Libadwaita native-style menus
 * (Menubar, DropdownMenu, ContextMenu, and Select popovers).
 */

export const MENU_POPUP_CLASS =
  "z-50 max-h-(--available-height) min-w-[10rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-adw-menu p-[6px] text-adw-label shadow-adw-menu adw-material-menu outline-none data-open:animate-in data-open:fade-in-0 motion-reduce:animate-none"

export const MENU_ITEM_CLASS =
  "relative flex min-h-[30px] cursor-default items-center gap-2 whitespace-nowrap rounded-adw-item px-[12px] py-1 text-[13.5px] leading-[18px] font-normal text-adw-label outline-hidden select-none data-highlighted:bg-adw-menu-highlight data-highlighted:text-adw-label data-disabled:pointer-events-none data-disabled:text-adw-label-tertiary data-[inset]:pl-[30px] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-current"

export const MENU_CHECK_ITEM_CLASS =
  "relative flex min-h-[30px] cursor-default items-center gap-2 whitespace-nowrap rounded-adw-item py-1 pr-[12px] pl-[30px] text-[13.5px] leading-[18px] font-normal text-adw-label outline-hidden select-none data-highlighted:bg-adw-menu-highlight data-highlighted:text-adw-label data-disabled:pointer-events-none data-disabled:text-adw-label-tertiary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export const MENU_LABEL_CLASS =
  "px-[12px] pt-[6px] pb-1 text-adw-subheadline font-semibold whitespace-nowrap text-adw-label-secondary data-[inset]:pl-[30px]"

export const MENU_SEPARATOR_CLASS = "mx-0 my-[5px] h-px bg-adw-separator"

export const MENU_SHORTCUT_CLASS =
  "ml-auto shrink-0 pl-6 text-[13px] font-normal tracking-normal whitespace-nowrap text-adw-label-secondary in-data-disabled:text-adw-label-tertiary"

export const MENU_BADGE_CLASS =
  "-mr-[2px] ml-auto flex h-[17px] shrink-0 items-center rounded-full bg-black/6 px-2 text-[10.5px] font-semibold text-adw-label dark:bg-white/10"

export const MENU_SUB_TRIGGER_CLASS =
  "flex min-h-[30px] cursor-default items-center gap-2 whitespace-nowrap rounded-adw-item px-[12px] py-1 text-[13.5px] leading-[18px] font-normal text-adw-label outline-hidden select-none data-highlighted:bg-adw-menu-highlight data-highlighted:text-adw-label data-popup-open:bg-adw-menu-highlight data-popup-open:text-adw-label data-[inset]:pl-[30px] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-current"

