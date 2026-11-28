"use client"

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/core/util/utils"

// The look is plain CSS: styles/components/button.css.
type ButtonVariant =
  | "default"
  | "destructive"
  | "secondary"
  | "tinted"
  | "outline"
  | "ghost"
  | "link"
// Small, Medium (default) and Large, as CupertinoUI names them.
type ButtonSize =
  | "default"
  | "sm"
  | "lg"
  | "icon"
  | "icon-sm"
  | "icon-lg"

// Base UI's Button. To render a link or another element with the button's
// styles, pass it as `render` (with `nativeButton={false}` when it isn't a
// <button>).
//
// `data-label` marks buttons with a text label: the Piloti theme hides their
// icons (macOS buttons are text only). `keepIcon` keeps it, e.g. an "Add"
// button's plus.
function Button({
  className,
  variant = "default",
  size = "default",
  shape,
  keepIcon = false,
  ...props
}: ButtonPrimitive.Props & {
  variant?: ButtonVariant
  size?: ButtonSize
  // "round": pill ends, or a circle for the icon sizes.
  shape?: "round"
  keepIcon?: boolean
}) {
  const hasLabel = React.Children.toArray(props.children).some(
    (child) =>
      (typeof child === "string" || typeof child === "number") &&
      String(child).trim() !== ""
  )
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      data-label={hasLabel || undefined}
      data-keep-icon={keepIcon || undefined}
      className={
        typeof className === "function"
          ? (state) => cn("ui-button", className(state))
          : cn("ui-button", className)
      }
      {...props}
    />
  )
}

export { Button }
