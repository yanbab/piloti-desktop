"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from "lucide-react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import {
  MENU_CHECK_ITEM_CLASS,
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
} from "./menu-styles"

// Pass `items` (value → label, or a list of { value, label }) so that
// SelectValue shows the label of the chosen item rather than its value.
const Select = SelectPrimitive.Root

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("text-left", className)}
      {...props}
    />
  )
}

// A pop-up select button. `default` is a bordered button with up/down
// chevrons; `borderless` is the compact System Settings style.
function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default" | "lg"
  variant?: "default" | "borderless"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      className={cn(
        "group/select-trigger flex w-fit cursor-default items-center justify-between font-medium whitespace-nowrap text-adw-label outline-none select-none focus-visible:adw-focus-ring data-disabled:cursor-not-allowed data-disabled:text-adw-label-tertiary aria-invalid:adw-focus-ring data-[placeholder]:text-adw-label-secondary *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        variant === "default" &&
          "gap-0 bg-adw-control active:bg-adw-control-pressed data-disabled:bg-adw-control-disabled data-[size=default]:h-6 data-[size=default]:rounded-[6px] data-[size=default]:pl-3 data-[size=default]:text-adw-body data-[size=lg]:h-7 data-[size=lg]:rounded-full data-[size=lg]:pl-3.5 data-[size=lg]:text-adw-body data-[size=sm]:h-5 data-[size=sm]:rounded-[5px] data-[size=sm]:pl-2.5 data-[size=sm]:text-adw-subheadline",
        variant === "borderless" &&
          "h-5 gap-3 rounded-full bg-transparent pl-1 text-adw-body hover:*:data-[slot=select-chip]:bg-adw-control-pressed",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          variant === "borderless" ? (
          <span
            data-slot="select-chip"
            className="flex size-5 items-center justify-center rounded-full bg-adw-control text-adw-label"
          >
            <ChevronsUpDownIcon className="size-3" strokeWidth={2.25} />
          </span>
          ) : (
          <span
            data-slot="select-chevrons"
            className="flex aspect-square h-full items-center justify-center"
          >
            <ChevronsUpDownIcon
              className="size-3 group-data-[size=sm]/select-trigger:size-2.5"
              strokeWidth={2.5}
            />
          </span>
          )
        }
      />
    </SelectPrimitive.Trigger>
  )
}

// The popup menu for a select trigger; opens aligned over the trigger by default
// (set alignItemWithTrigger={false} to drop it below instead).
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-[400]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative z-50 max-h-(--available-height) min-w-[max(8rem,var(--anchor-width))] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-adw-menu text-adw-label shadow-adw-menu adw-material-menu outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-[6px]">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(MENU_LABEL_CLASS, className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        MENU_CHECK_ITEM_CLASS,
        "w-full *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-1.5",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute left-[10px] flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5" strokeWidth={2.5} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none", MENU_SEPARATOR_CLASS, className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: SelectPrimitive.ScrollUpArrow.Props) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "absolute inset-x-0 z-10 flex h-4 cursor-default items-center justify-center data-[direction=up]:top-0 data-[direction=down]:bottom-0",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-3" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: SelectPrimitive.ScrollDownArrow.Props) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "absolute inset-x-0 z-10 flex h-4 cursor-default items-center justify-center data-[direction=up]:top-0 data-[direction=down]:bottom-0",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-3" />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
