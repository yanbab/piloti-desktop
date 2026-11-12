"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar"

import { cn } from "@/lib/utils"

// The macOS menu bar: the Apple menu, the app name in bold, the app's
// menus, and status items with the clock on the right (MenubarExtras).
function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "flex h-[30px] w-full items-center gap-0 pr-[7px] pl-[5px] pb-0.5 text-mac-body text-mac-label select-none",
        className
      )}
      {...props}
    />
  )
}

// One menu in the bar: its title (MenubarTrigger) and its items.
function MenubarMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="menubar-menu" {...props} />
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
        "flex h-5 cursor-default items-center rounded-full px-2.5 outline-none select-none data-[app]:font-bold data-highlighted:bg-black/8 data-popup-open:bg-black/8 focus-visible:bg-black/8 dark:data-highlighted:bg-white/12 dark:data-popup-open:bg-white/12 dark:focus-visible:bg-white/12 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
  side = "bottom",
  sideOffset = 6,
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
        className="isolate z-[400] outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="menubar-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-[12rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-mac-menu p-[5px] text-mac-label shadow-mac-menu mac-material-menu outline-none data-open:animate-in data-open:fade-in-0 motion-reduce:animate-none",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
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
      className={cn(
        "relative flex h-6 cursor-default items-center gap-2 rounded-mac-item pr-[14px] pl-[11px] text-mac-body font-normal outline-hidden select-none data-highlighted:bg-mac-menu-highlight data-highlighted:text-white data-disabled:pointer-events-none data-disabled:text-mac-label-tertiary data-[inset]:pl-[27px] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-current",
        className
      )}
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
      className={cn(
        "relative flex h-6 cursor-default items-center gap-2 rounded-mac-item pr-[14px] pl-[27px] text-mac-body font-normal outline-hidden select-none data-highlighted:bg-mac-menu-highlight data-highlighted:text-white data-disabled:pointer-events-none data-disabled:text-mac-label-tertiary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-[11px] flex size-3 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-3" strokeWidth={3} />
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
      className={cn(
        "relative flex h-6 cursor-default items-center gap-2 rounded-mac-item pr-[14px] pl-[27px] text-mac-body font-normal outline-hidden select-none data-highlighted:bg-mac-menu-highlight data-highlighted:text-white data-disabled:pointer-events-none data-disabled:text-mac-label-tertiary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-[11px] flex size-3 items-center justify-center">
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
      className={cn(
        "px-[11px] pt-[5px] pb-1 text-mac-subheadline font-semibold text-mac-label-secondary data-[inset]:pl-[27px]",
        className
      )}
      {...props}
    />
  )
}

function MenubarSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="menubar-separator"
      className={cn("mx-[11px] my-[5px] h-px bg-mac-grid", className)}
      {...props}
    />
  )
}

function MenubarShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "ml-auto pl-4 text-mac-body font-medium tracking-wider text-mac-label-tertiary in-data-highlighted:text-white/75",
        className
      )}
      {...props}
    />
  )
}

// A capsule on the right of an item, e.g. "2 updates".
function MenubarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-badge"
      className={cn(
        "-mr-[3px] ml-auto flex h-[15px] shrink-0 items-center rounded-full bg-black/6 px-2 text-[10px] font-semibold text-mac-label in-data-highlighted:bg-white/20 in-data-highlighted:text-white dark:bg-white/10",
        className
      )}
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
      className={cn(
        "flex h-6 cursor-default items-center gap-2 rounded-mac-item pr-[14px] pl-[11px] text-mac-body font-normal outline-hidden select-none data-highlighted:bg-mac-menu-highlight data-highlighted:text-white data-popup-open:bg-mac-menu-highlight data-popup-open:text-white data-[inset]:pl-[27px] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-current",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3" strokeWidth={2.5} />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function MenubarSubContent({
  className,
  align = "start",
  alignOffset = -5,
  side = "right",
  sideOffset = 0,
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
        className="isolate z-[400] outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="menubar-sub-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-mac-menu p-[5px] text-mac-label shadow-mac-menu mac-material-menu outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

// Status items on the right of the menu bar: icons, then the clock.
function MenubarExtras({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="menubar-extras"
      className={cn(
        "ml-auto flex h-full items-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function MenubarExtra({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      role="menuitem"
      data-slot="menubar-extra"
      className={cn(
        "flex h-5 min-w-6 cursor-default items-center justify-center rounded-full px-[10px] outline-none hover:bg-black/8 focus-visible:bg-black/8 dark:hover:bg-white/15 dark:focus-visible:bg-white/15",
        className
      )}
      {...props}
    />
  )
}

export {
  Menubar,
  MenubarBadge,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarExtra,
  MenubarExtras,
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
