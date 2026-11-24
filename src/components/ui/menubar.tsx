"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar"

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

// The left-aligned application menu bar strip.
function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "flex h-full items-center gap-0.5 text-adw-body text-adw-label select-none",
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
        "flex h-full shrink-0 cursor-default items-center rounded-adw-control px-2 outline-none select-none data-[app]:font-extrabold active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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

function MenubarGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="menubar-group" {...props} />
}

function MenubarItem({
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
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(MENU_ITEM_CLASS, className)}
      {...props}
    />
  )
}

function MenubarCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
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

function MenubarRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
}

function MenubarRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menubar-radio-item"
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
function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
}) {
  return (
    <div
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(MENU_LABEL_CLASS, className)}
      {...props}
    />
  )
}

function MenubarSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="menubar-separator"
      className={cn(MENU_SEPARATOR_CLASS, className)}
      {...props}
    />
  )
}

function MenubarShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(MENU_SHORTCUT_CLASS, className)}
      {...props}
    />
  )
}

// A capsule on the right of an item, e.g. "2 updates".
function MenubarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-badge"
      className={cn(MENU_BADGE_CLASS, className)}
      {...props}
    />
  )
}

function MenubarSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="menubar-sub" {...props} />
}

function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(MENU_SUB_TRIGGER_CLASS, className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3.5" strokeWidth={2.25} />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function MenubarSubContent({
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
          data-slot="menubar-sub-content"
          className={cn(MENU_POPUP_CLASS, className)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

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
