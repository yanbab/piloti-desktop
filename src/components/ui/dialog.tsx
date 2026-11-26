"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/core/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[450] bg-ui-scrim data-open:animate-in data-open:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

// A modal dialog panel with a close button in the header.
function DialogContent({
  className,
  children,
  showCloseButton = true,
  showBackdrop = true,
  variant = "window",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  showBackdrop?: boolean
  variant?: "window" | "menu"
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay
        className={cn(
          !showBackdrop && "bg-transparent",
          variant === "menu" && "data-closed:animate-none data-open:animate-none"
        )}
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-[450] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] text-ui-label outline-none sm:max-w-md",
          variant === "menu"
            ? "gap-0 overflow-hidden rounded-ui-box p-0 shadow-ui-menu ui-material-menu duration-150 data-open:animate-in data-open:fade-in-0 motion-reduce:animate-none"
            : "gap-4 rounded-ui-window bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl p-5 shadow-ui-window duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.92),inset_0_0_0_1px_var(--ui-window-rim),0_18px_54px_rgb(0_0_0/0.57)]",
          showCloseButton && "pt-12",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="group/close absolute top-[19px] left-[19px] flex size-3.5 items-center justify-center rounded-full [background:var(--ui-traffic-close)] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.12)] outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-ui-accent/50"
          >
            <XIcon
              className="size-2 text-black/60 opacity-0 group-hover/close:opacity-100 group-focus-visible/close:opacity-100"
              strokeWidth={3}
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="secondary" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-ui-title font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-ui-body text-ui-label-secondary", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
