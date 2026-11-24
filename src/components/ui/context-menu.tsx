"use client"

import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

import { cn } from "@/lib/core/utils"
import { PopupSurfaceScope, usePopupSurfaceState } from "@/lib/shell/popup-layer"
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

// The menu a right-click opens, where the pointer is.

// One surface on the popup layer at a time (see popup-layer.ts).
function ContextMenu({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: ContextMenuPrimitive.Root.Props) {
  const state = usePopupSurfaceState({ open, defaultOpen, onOpenChange })
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} {...state} />
}

function ContextMenuPortal({ ...props }: ContextMenuPrimitive.Portal.Props) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuContent({
  className,
  align = "start",
  alignOffset = 2,
  side = "right",
  sideOffset = 2,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<ContextMenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <PopupSurfaceScope>
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[610] outline-none"
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(MENU_POPUP_CLASS, className)}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
    </PopupSurfaceScope>
  )
}

// Items are the DropdownMenu ones (Base UI menu items work in any menu
// root): one implementation and the same `data-slot` names everywhere.
const ContextMenuGroup = DropdownMenuGroup
const ContextMenuItem = DropdownMenuItem
const ContextMenuCheckboxItem = DropdownMenuCheckboxItem
const ContextMenuRadioGroup = DropdownMenuRadioGroup
const ContextMenuRadioItem = DropdownMenuRadioItem
const ContextMenuLabel = DropdownMenuLabel
const ContextMenuSeparator = DropdownMenuSeparator
const ContextMenuShortcut = DropdownMenuShortcut
const ContextMenuBadge = DropdownMenuBadge
const ContextMenuSub = DropdownMenuSub
const ContextMenuSubTrigger = DropdownMenuSubTrigger
const ContextMenuSubContent = DropdownMenuSubContent

export {
  ContextMenu,
  ContextMenuBadge,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
}
