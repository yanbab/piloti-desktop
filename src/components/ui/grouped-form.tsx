import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon } from "@/components/ui/symbols";

import { cn } from "@/lib/core/utils"

// The grouped form layout of System Settings: section titles above rounded
// groups of rows, each row a label on the left and a control on the right.
function GroupedForm({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grouped-form"
      className={cn(
        "ui-form",
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
      className={cn("ui-form-section", className)}
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
        "ui-form-section-title",
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
        "ui-form-group",
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
        "ui-form-row",
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
      className={cn("ui-form-row-label", className)}
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
      className={cn("ui-form-row-title", className)}
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
        "ui-form-row-description",
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
      className={cn("ui-form-row-control", className)}
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
      className={cn("ui-form-row", className)}
    >
      <GroupedFormRowLabel>
        <GroupedFormRowTitle>{title}</GroupedFormRowTitle>
        {description && (
          <GroupedFormRowDescription>{description}</GroupedFormRowDescription>
        )}
      </GroupedFormRowLabel>
      <GroupedFormRowControl>
        {expanded ? (
          <ChevronDownIcon className="size-4 text-ui-label-secondary" />
        ) : (
          <ChevronRightIcon className="size-4 text-ui-label-secondary" />
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
