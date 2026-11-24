"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/core/utils"

// Flat buttons with translucent fills and medium-weight labels.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-default items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none outline-none focus-visible:adw-focus-ring disabled:pointer-events-none data-disabled:pointer-events-none aria-invalid:adw-focus-ring [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The window's default button: filled with the accent color.
        default:
          "bg-adw-accent text-adw-accent-foreground active:brightness-90 disabled:opacity-45",
        destructive:
          "bg-adw-red text-white active:brightness-90 disabled:opacity-45",
        // The standard secondary push button.
        secondary:
          "bg-adw-control text-adw-label active:bg-adw-control-pressed disabled:bg-adw-control-disabled disabled:text-adw-label-tertiary",
        // An accent-tinted button ("Bordered - Tinted").
        tinted:
          "bg-adw-accent/20 text-adw-accent active:bg-adw-accent/30 disabled:opacity-45",
        // A bordered button without fill, e.g. inside grouped content.
        outline:
          "bg-transparent text-adw-label shadow-[inset_0_0_0_1px_var(--adw-grid)] active:bg-adw-control-pressed disabled:text-adw-label-tertiary",
        // Borderless button, as used in toolbars and title bars.
        ghost:
          "text-adw-label active:bg-adw-control-pressed disabled:text-adw-label-tertiary",
        link: "h-auto px-0 text-adw-link underline-offset-2 active:opacity-75 disabled:opacity-45",
      },
      size: {
        default:
          "h-adw-control-small rounded-adw-control px-4 text-adw-body has-[>svg]:px-3 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-4 gap-1 rounded-[4px] px-[7px] text-adw-footnote [&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-adw-control-mini gap-1 rounded-[5px] px-2.5 text-adw-subheadline [&_svg:not([class*='size-'])]:size-3",
        lg: "h-adw-control-medium rounded-full px-4 text-adw-body [&_svg:not([class*='size-'])]:size-4",
        xl: "h-9 rounded-full px-4 text-adw-body [&_svg:not([class*='size-'])]:size-4",
        icon: "size-adw-control-small rounded-adw-control [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-4 rounded-[4px] [&_svg:not([class*='size-'])]:size-2.5",
        "icon-sm": "size-adw-control-mini rounded-[5px] [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-adw-control-medium rounded-full [&_svg:not([class*='size-'])]:size-4",
        "icon-xl": "size-9 rounded-full [&_svg:not([class*='size-'])]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Base UI's Button. To render a link or another element with the button's
// styles, pass it as `render` (with `nativeButton={false}` when it isn't a
// <button>).
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
