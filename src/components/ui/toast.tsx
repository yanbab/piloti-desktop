"use client"

import * as React from "react"
import { XIcon } from "@/components/ui/symbols";
import { Toast as ToastPrimitive } from "@base-ui/react/toast"

import { cn } from "@/lib/core/utils"

export type ToastViewportPosition = "top-right"

const VIEWPORT_POSITION_CLASSES: Record<ToastViewportPosition, string> = {
  "top-right": "top-10 right-3",
}

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastViewport({
  className,
  position = "top-right",
  ...props
}: ToastPrimitive.Viewport.Props & {
  position?: ToastViewportPosition
}) {
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        data-slot="toast-viewport"
        data-position={position}
        className={cn(
          "pointer-events-none fixed z-[450] flex w-[380px] max-w-[calc(100vw-24px)] flex-col gap-2 outline-none",
          VIEWPORT_POSITION_CLASSES[position],
          className
        )}
        {...props}
      />
    </ToastPrimitive.Portal>
  )
}

function ToastRoot({
  className,
  style,
  swipeDirection = ["up", "right"],
  ...props
}: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      swipeDirection={swipeDirection}
      style={{
        transform:
          "translate3d(var(--toast-swipe-movement-x, 0px), var(--toast-swipe-movement-y, 0px), 0)",
        ...style,
      }}
      className={cn(
        "pointer-events-auto relative flex w-full flex-col gap-1.5 rounded-ui-box p-3 text-ui-label shadow-ui-menu ui-material-menu select-none",
        "transition-[opacity,transform] duration-200 ease-out",
        "data-starting-style:opacity-0",
        "data-ending-style:opacity-0",
        "data-limited:hidden",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-ui-body font-semibold leading-snug text-ui-label", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn(
        "text-ui-body leading-relaxed text-ui-label-secondary",
        className
      )}
      {...props}
    />
  )
}

function ToastAction({ className, ...props }: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        "inline-flex h-6 items-center justify-center rounded-[7px] bg-black/8 px-2.5 text-ui-small font-medium text-ui-label transition-colors hover-fill:bg-black/14 dark:bg-white/10 dark:hover-fill:bg-white/18",
        className
      )}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Dismiss notification banner"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full bg-black/8 text-ui-label-secondary transition-colors hover-fill:bg-black/14 hover-fill:text-ui-label dark:bg-white/12 dark:hover-fill:bg-white/20",
        className
      )}
      {...props}
    >
      {children ?? <XIcon className="size-3" />}
    </ToastPrimitive.Close>
  )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export {
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  createToastManager,
  useToastManager,
}
