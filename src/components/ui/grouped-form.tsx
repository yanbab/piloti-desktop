import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/core/utils"

// The grouped form layout of System Settings: section titles above rounded
// groups of rows, each row a label on the left and a control on the right.
function GroupedForm({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grouped-form"
      className={cn(
        "flex flex-col gap-2.5 px-5 pt-[11px] pb-5 text-adw-body text-adw-label",
        className
      )}
      {...props}
    />
  )
}

function GroupedFormSection({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="grouped-form-section"
      className={cn("flex flex-col gap-2.5 not-first:mt-5", className)}
      {...props}
    />
  )
}

function GroupedFormSectionTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="grouped-form-section-title"
      className={cn(
        "px-[11px] text-adw-body font-semibold text-adw-label",
        className
      )}
      {...props}
    />
  )
}

// One rounded box of rows.
function GroupedFormGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grouped-form-group"
      className={cn(
        "flex flex-col rounded-adw-group bg-adw-group px-2.5",
        className
      )}
      {...props}
    />
  )
}

function GroupedFormRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grouped-form-row"
      className={cn(
        "flex min-h-9 items-center justify-between gap-4 py-2 not-first:min-h-[37px] has-[[data-slot=grouped-form-row-description]]:py-2.5 not-first:border-t not-first:border-adw-separator has-[[data-slot=select-trigger]]:min-h-[37.5px] not-first:has-[[data-slot=select-trigger]]:min-h-[38.5px]",
        className
      )}
      {...props}
    />
  )
}

// The left side of a row: a title with an optional description below it.
function GroupedFormRowLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grouped-form-row-label"
      className={cn("flex min-w-0 flex-col gap-0.5", className)}
      {...props}
    />
  )
}

function GroupedFormRowTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grouped-form-row-title"
      className={cn("text-adw-body text-adw-label", className)}
      {...props}
    />
  )
}

function GroupedFormRowDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="grouped-form-row-description"
      className={cn(
        "text-adw-subheadline text-adw-label-secondary",
        className
      )}
      {...props}
    />
  )
}

// The right side of a row: a switch, pop-up button, checkboxes and so on.
function GroupedFormRowControl({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grouped-form-row-control"
      className={cn("flex shrink-0 items-center gap-3", className)}
      {...props}
    />
  )
}

// A full-row clickable expander row (Adwaita/macOS style) with only a chevron on the right.
function GroupedFormExpanderRow({
  title,
  description,
  expanded,
  onToggle,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      data-slot="grouped-form-row"
      className={cn(
        "flex w-full min-h-9 cursor-default items-center justify-between gap-4 py-2 text-left transition-colors outline-none not-first:min-h-[37px] not-first:border-t not-first:border-adw-separator",
        expanded
          ? "bg-black/6 hover:bg-black/8 dark:bg-white/8 dark:hover:bg-white/10"
          : "hover:bg-black/3 active:bg-black/5 dark:hover:bg-white/4 dark:active:bg-white/7",
        description && "py-2.5",
        className
      )}
    >
      <GroupedFormRowLabel>
        <GroupedFormRowTitle>{title}</GroupedFormRowTitle>
        {description && (
          <GroupedFormRowDescription>{description}</GroupedFormRowDescription>
        )}
      </GroupedFormRowLabel>
      <GroupedFormRowControl>
        {expanded ? (
          <ChevronDownIcon className="size-4 text-adw-label-secondary" />
        ) : (
          <ChevronRightIcon className="size-4 text-adw-label-secondary" />
        )}
      </GroupedFormRowControl>
    </button>
  )
}

export {
  GroupedForm,
  GroupedFormExpanderRow,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowDescription,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
}
