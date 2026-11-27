"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar"

import { cn } from "@/lib/core/utils"
import { PopupSurfaceScope, usePopupSurfaceState } from "@/lib/windows/popup-layer"
import { MENU_POPUP_CLASS } from "./menu-styles"
import {
  DropdownMenuBadge,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./dropdown-menu"

// The left-aligned application menu bar strip.
function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "flex h-full items-center gap-0.5 text-ui-body text-ui-label select-none",
        className
      )}
      {...props}
    />
  )
}

// One menu in the bar: its title (MenubarTrigger) and its items.
// One surface on the popup layer at a time (see popup-layer.ts).
function MenubarMenu({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: MenuPrimitive.Root.Props) {
  const state = usePopupSurfaceState({ open, defaultOpen, onOpenChange })
  return <MenuPrimitive.Root data-slot="menubar-menu" {...props} {...state} />
}

// A menu title. `app` renders the bold application name.
function MenubarTrigger({
  className,
  app = false,
  ...props
}: MenuPrimitive.Trigger.Props & {
  app?: boolean
}) {
  return (
    <MenuPrimitive.Trigger
      data-slot="menubar-trigger"
      data-app={app || undefined}
      className={cn(
        "flex h-full shrink-0 cursor-default items-center rounded-ui-control px-2 outline-none select-none data-[app]:font-extrabold active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function MenubarPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="menubar-portal" {...props} />
}

function MenubarContent({
  className,
  align = "start",
  alignOffset = 0,
  anchor,
  side = "bottom",
  // Popups float clear of the bar by the same gap the first one keeps from the screen edge.
  sideOffset = 6,
  initialFocus,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
  > & {
    /** Base UI MenuPopup forwards `initialFocus` to FloatingFocusManager at runtime. */
    initialFocus?: boolean | React.RefObject<HTMLElement | null>;
  }) {
  return (
    <PopupSurfaceScope>
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[610] outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="menubar-content"
          className={cn(MENU_POPUP_CLASS, "min-w-[12rem]", className)}
          {...(initialFocus !== undefined
            ? ({ initialFocus } as Record<string, unknown>)
            : {})}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
    </PopupSurfaceScope>
  )
}

// Items are the DropdownMenu ones: Base UI menu items work in either root,
// so the menu bar and every other menu share one implementation and the
// same `data-slot` names (`dropdown-menu-item`, …).
const MenubarGroup = DropdownMenuGroup
const MenubarItem = DropdownMenuItem
const MenubarCheckboxItem = DropdownMenuCheckboxItem
const MenubarRadioGroup = DropdownMenuRadioGroup
const MenubarRadioItem = DropdownMenuRadioItem
const MenubarLabel = DropdownMenuLabel
const MenubarSeparator = DropdownMenuSeparator
const MenubarShortcut = DropdownMenuShortcut
const MenubarBadge = DropdownMenuBadge
const MenubarSub = DropdownMenuSub
const MenubarSubTrigger = DropdownMenuSubTrigger
const MenubarSubContent = DropdownMenuSubContent

export {
  Menubar,
  MenubarBadge,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
}
