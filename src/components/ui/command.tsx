"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { CheckIcon, SearchIcon } from "@/components/ui/symbols";

import { cn } from "@/lib/core/utils"
import { InlineCompletionInput } from "@/components/ui/inline-completion-input"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// cmdk keeps the highlighted item in view with scrollIntoView, which also
// scrolls the page when the palette sits below the fold (it runs on mount).
// Items and group headings scroll only their list instead.
function scrollInList(node: HTMLElement | null | undefined) {
  if (!node) return
  node.scrollIntoView = () => {
    const list = node.closest<HTMLElement>("[cmdk-list]")
    if (!list) return
    const inset = parseFloat(getComputedStyle(list).scrollPaddingTop) || 0
    const item = node.getBoundingClientRect()
    const box = list.getBoundingClientRect()
    if (item.top < box.top + inset) list.scrollTop -= box.top + inset - item.top
    else if (item.bottom > box.bottom - inset) list.scrollTop += item.bottom - box.bottom + inset
  }
}

function listScrollRef(ref: React.Ref<HTMLDivElement> | undefined, target = (node: HTMLDivElement): HTMLElement | null => node) {
  return (node: HTMLDivElement | null) => {
    if (node) scrollInList(target(node))
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }
}

// A command palette in the style of Spotlight: a large search field over a
// list of results; uses the same background and material as menus.
function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden text-ui-body text-ui-label",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Launcher",
  description = "Search for an app, window, or action...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        variant="menu"
        showBackdrop={false}
        showCloseButton={showCloseButton}
        className={cn(
          "top-[36px] right-2.5 left-auto translate-x-0 translate-y-0 w-full max-w-[calc(100vw-20px)] sm:w-[340px] sm:max-w-[340px]",
          className
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  completion,
  completionHint,
  onAcceptCompletion,
  value,
  ref,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  completion?: string
  completionHint?: string
  onAcceptCompletion?: (completed: string) => void
}) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-12 shrink-0 items-center gap-2.5 border-b border-ui-grid px-4">
      <SearchIcon className="size-[18px] shrink-0 text-ui-label-secondary" strokeWidth={2.25} />
      <InlineCompletionInput
        // Not with `props`: the completion input's own ref would replace it.
        ref={ref}
        value={typeof value === "string" ? value : ""}
        completion={completion}
        completionHint={completionHint}
        onAcceptCompletion={onAcceptCompletion}
        className={className}
        renderInput={(inputProps) => (
          <CommandPrimitive.Input
            data-slot="command-input"
            {...(props as React.ComponentProps<typeof CommandPrimitive.Input>)}
            {...(inputProps as React.ComponentProps<typeof CommandPrimitive.Input>)}
          />
        )}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-80 scroll-py-1.5 overflow-x-hidden overflow-y-auto p-1.5 outline-none",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-ui-body text-ui-label-secondary", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      ref={listScrollRef(ref, (node) => node.querySelector<HTMLElement>("[cmdk-group-heading]"))}
      data-slot="command-group"
      className={cn(
        "overflow-hidden text-ui-label **:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-ui-small **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-ui-label-secondary",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      aria-hidden="true"
      data-slot="command-separator"
      className={cn("mx-2.5 my-1.5 h-px bg-ui-grid", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      ref={listScrollRef(ref)}
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex h-8 cursor-default items-center gap-2.5 rounded-ui-control px-2.5 text-ui-body outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-ui-menu-highlight data-[selected=true]:text-ui-label [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-ui-label-secondary data-[selected=true]:*:[svg]:text-ui-label",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon
        className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-ui-body tracking-normal text-ui-label-secondary",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
