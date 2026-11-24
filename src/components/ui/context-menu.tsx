"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

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

function ContextMenuGroup({ ...props }: ContextMenuPrimitive.Group.Props) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(MENU_ITEM_CLASS, className)}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: ContextMenuPrimitive.CheckboxItem.Props) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(MENU_CHECK_ITEM_CLASS, className)}
      closeOnClick
      {...props}
    >
      <span className="pointer-events-none absolute left-[10px] flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-3.5" strokeWidth={2.5} />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioGroup({ ...props }: ContextMenuPrimitive.RadioGroup.Props) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ContextMenuPrimitive.RadioItem.Props) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(MENU_CHECK_ITEM_CLASS, className)}
      closeOnClick
      {...props}
    >
      <span className="pointer-events-none absolute left-[10px] flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.RadioItemIndicator>
          <CircleIcon className="size-1.5 fill-current" />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

// A section heading. Unlike Base UI's GroupLabel it works outside a
// group too.
function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
}) {
  return (
    <div
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(MENU_LABEL_CLASS, className)}
      {...props}
    />
  )
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn(MENU_SEPARATOR_CLASS, className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(MENU_SHORTCUT_CLASS, className)}
      {...props}
    />
  )
}

// A capsule on the right of an item, e.g. "2 updates".
function ContextMenuBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-badge"
      className={cn(MENU_BADGE_CLASS, className)}
      {...props}
    />
  )
}

function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) {
  return <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(MENU_SUB_TRIGGER_CLASS, className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3.5" strokeWidth={2.25} />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}

function ContextMenuSubContent({
  className,
  align = "start",
  alignOffset = -6,
  side = "right",
  sideOffset = 2,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<ContextMenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[610] outline-none"
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-sub-content"
          className={cn(MENU_POPUP_CLASS, className)}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

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
