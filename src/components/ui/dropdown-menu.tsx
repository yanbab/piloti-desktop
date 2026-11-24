"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/core/utils"
import { PopupSurfaceScope, usePopupSurfaceState } from "@/lib/shell/popup-layer"
import {
  MENU_BADGE_CLASS,
  MENU_CHECK_ITEM_CLASS,
  MENU_ITEM_CLASS,
  MENU_LABEL_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
  MENU_SHORTCUT_CLASS,
  MENU_SUB_TRIGGER_CLASS,
} from "./menu-styles"

// A pull-down menu using Adwaita popover surface and accent highlight.

// One surface on the popup layer at a time (see popup-layer.ts).
function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: MenuPrimitive.Root.Props) {
  const state = usePopupSurfaceState({ open, defaultOpen, onOpenChange })
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} {...state} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  anchor,
  collisionAvoidance,
  initialFocus,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor" | "collisionAvoidance"
  > & {
    initialFocus?: boolean | React.RefObject<HTMLElement | null>;
  }) {
  return (
    <PopupSurfaceScope>
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
        collisionAvoidance={collisionAvoidance}
        className="isolate z-[610] outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(MENU_POPUP_CLASS, className)}
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

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(MENU_ITEM_CLASS, className)}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(MENU_CHECK_ITEM_CLASS, className)}
      closeOnClick
      {...props}
    >
      <span className="pointer-events-none absolute left-[10px] flex size-3.5 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-3.5" strokeWidth={2.5} />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(MENU_CHECK_ITEM_CLASS, className)}
      closeOnClick
      {...props}
    >
      <span className="pointer-events-none absolute left-[10px] flex size-3.5 items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <CircleIcon className="size-1.5 fill-current" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

// A section heading. Unlike Base UI's GroupLabel it works outside a
// group too.
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
}) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(MENU_LABEL_CLASS, className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(MENU_SEPARATOR_CLASS, className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(MENU_SHORTCUT_CLASS, className)}
      {...props}
    />
  )
}

// A capsule on the right of an item, e.g. "2 updates".
function DropdownMenuBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-badge"
      className={cn(MENU_BADGE_CLASS, className)}
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(MENU_SUB_TRIGGER_CLASS, className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3.5" strokeWidth={2.25} />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  align = "start",
  alignOffset = -6,
  side = "right",
  sideOffset = 2,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[610] outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(MENU_POPUP_CLASS, className)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuBadge,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
