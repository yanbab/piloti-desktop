"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/core/utils"
import {
  MENU_CHECK_ITEM_CLASS,
  MENU_LABEL_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
} from "./menu-styles"

/**
 * Popup menu button: a text button with up/down chevrons that opens one of
 * our regular menus below it, with a check on the chosen item. Built on the
 * same Base UI Menu as DropdownMenu (not a native-select style overlay).
 *
 * Pass `items` (value → label, or a list of { value, label }) so that
 * SelectValue can show the label of the chosen item.
 */

type SelectItems =
  | Record<string, React.ReactNode>
  | ReadonlyArray<{ value: unknown; label: React.ReactNode }>

type SelectContextValue = {
  value: unknown
  setValue: (value: unknown) => void
  items?: SelectItems
  disabled: boolean
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(part: string) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error(`<${part}> must be used inside <Select>`)
  return ctx
}

function labelFor(items: SelectItems | undefined, value: unknown) {
  if (!items) return undefined
  if (Array.isArray(items)) {
    return items.find((item) => Object.is(item.value, value))?.label
  }
  return (items as Record<string, React.ReactNode>)[String(value)]
}

function Select<Value>({
  value: valueProp,
  defaultValue,
  onValueChange,
  items,
  disabled = false,
  open,
  onOpenChange,
  children,
}: {
  value?: Value
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  items?: SelectItems
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  /** Accepted for API compatibility; menus are never modal. */
  modal?: boolean
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const value = valueProp !== undefined ? valueProp : uncontrolled

  const ctx = React.useMemo<SelectContextValue>(
    () => ({
      value,
      items,
      disabled,
      setValue: (next) => {
        if (valueProp === undefined) setUncontrolled(next as Value)
        onValueChange?.(next as Value)
      },
    }),
    [value, items, disabled, valueProp, onValueChange]
  )

  return (
    <SelectContext.Provider value={ctx}>
      <MenuPrimitive.Root
        modal={false}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
      >
        {children}
      </MenuPrimitive.Root>
    </SelectContext.Provider>
  )
}

function SelectGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  className,
  placeholder,
  children,
}: {
  className?: string
  placeholder?: React.ReactNode
  children?: React.ReactNode
}) {
  const { value, items } = useSelectContext("SelectValue")
  const label = children ?? labelFor(items, value) ?? (value != null ? String(value) : null)
  return (
    <span
      data-slot="select-value"
      data-placeholder={label == null ? "" : undefined}
      className={cn("min-w-0 truncate text-left", className)}
    >
      {label ?? placeholder}
    </span>
  )
}

// Same look as the font pickers in Settings: plain text, up/down chevrons,
// a soft hover fill. `size` only changes the height.
function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: MenuPrimitive.Trigger.Props & {
  size?: "sm" | "default" | "lg"
  /** Kept for API compatibility; both variants share the same look. */
  variant?: "default" | "borderless"
}) {
  return (
    <MenuPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      className={cn(
        "inline-flex max-w-full min-w-0 cursor-default items-center justify-between gap-1.5 rounded-shell-item px-2.5 text-shell-body font-medium whitespace-nowrap text-shell-label outline-none select-none transition-colors hover-fill:bg-black/6 focus-visible:shell-focus-ring data-popup-open:bg-black/8 data-disabled:cursor-not-allowed data-disabled:text-shell-label-tertiary data-disabled:hover-fill:bg-transparent dark:hover-fill:bg-white/10 dark:data-popup-open:bg-white/12",
        size === "sm" && "h-shell-control-small px-2 text-shell-subheadline",
        size === "default" && "h-shell-control-medium",
        size === "lg" && "h-shell-control-large",
        className
      )}
      {...props}
    >
      {children}
      <ChevronsUpDownIcon
        aria-hidden
        className="size-3.5 shrink-0 text-shell-label-secondary"
      />
    </MenuPrimitive.Trigger>
  )
}

// The menu for a select trigger; drops below the trigger like other menus.
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "end",
  alignOffset = 0,
  alignItemWithTrigger: _alignItemWithTrigger,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & {
    /** Accepted for API compatibility; the menu always drops below. */
    alignItemWithTrigger?: boolean
  }) {
  const { value, setValue } = useSelectContext("SelectContent")
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        // Above portal dialogs (z-800) so selects work inside them; below the lock screen.
        className="isolate z-[850] outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="select-content"
          className={cn(
            MENU_POPUP_CLASS,
            "min-w-[max(10rem,var(--anchor-width))]",
            className
          )}
          {...props}
        >
          <MenuPrimitive.RadioGroup
            value={value}
            onValueChange={(next) => setValue(next)}
          >
            {children}
          </MenuPrimitive.RadioGroup>
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn(MENU_LABEL_CLASS, className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  closeOnClick = true,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="select-item"
      closeOnClick={closeOnClick}
      className={cn(MENU_CHECK_ITEM_CLASS, "w-full", className)}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="pointer-events-none absolute left-[10px] flex size-3.5 items-center justify-center"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon className="size-3.5" strokeWidth={2.5} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function SelectSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none", MENU_SEPARATOR_CLASS, className)}
      {...props}
    />
  )
}

// Menus scroll natively; these stay exported for API compatibility.
function SelectScrollUpButton() {
  return null
}

function SelectScrollDownButton() {
  return null
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
