import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon } from "@/components/ui/symbols";

import { cn } from "@/lib/core/utils"

/**
 * A list view (table) with sortable column headers: Folders' list view, the
 * System Monitor apps list. Click a header to sort by it; click it again to
 * flip the direction.
 */

export type SortDirection = "asc" | "desc"

export interface ListViewSort<K extends string = string> {
  by: K
  dir: SortDirection
}

export interface ListViewColumn<K extends string = string> {
  id: K
  label: React.ReactNode
  /** Visible name when `label` is empty (e.g. an icon-only column). */
  ariaLabel?: string
  align?: "left" | "right"
  /** Fixed width (CSS length), e.g. "72px". */
  width?: string
  /** False for columns that don't sort (default: true). */
  sortable?: boolean
  className?: string
}

/** Next sort after clicking `column`: flip on the same column, else `defaultDir`. */
export function nextListViewSort<K extends string>(
  current: ListViewSort<K>,
  column: K,
  defaultDir: SortDirection = "asc"
): ListViewSort<K> {
  return current.by === column
    ? { by: column, dir: current.dir === "asc" ? "desc" : "asc" }
    : { by: column, dir: defaultDir }
}

function ListView({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="list-view"
      className={cn("w-full border-collapse text-left text-ui-body", className)}
      {...props}
    />
  )
}

function ListViewHeader<K extends string>({
  columns,
  sort,
  onSort,
}: {
  columns: ListViewColumn<K>[]
  sort?: ListViewSort<K>
  onSort?: (column: K) => void
}) {
  return (
    <thead>
      <tr
        data-slot="list-view-header"
        className="border-b border-ui-separator text-ui-small font-semibold text-ui-label-secondary"
      >
        {columns.map((col) => {
          const active = sort?.by === col.id
          const canSort = col.sortable !== false && Boolean(onSort)
          const Arrow = sort?.dir === "desc" ? ChevronDownIcon : ChevronUpIcon
          return (
            <th
              key={col.id}
              scope="col"
              aria-label={col.ariaLabel}
              aria-sort={
                active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined
              }
              style={col.width ? { width: col.width } : undefined}
              className={cn("p-0 font-[inherit]", col.className)}
            >
              {canSort ? (
                <button
                  type="button"
                  data-slot="list-view-sort"
                  data-active={active || undefined}
                  onClick={() => onSort?.(col.id)}
                  className={cn(
                    "flex w-full items-center gap-1 px-3 py-1.5 outline-none data-[active]:text-ui-label",
                    col.align === "right" && "flex-row-reverse"
                  )}
                >
                  <span className="truncate">{col.label}</span>
                  {active && <Arrow className="size-3 shrink-0" strokeWidth={2.5} />}
                </button>
              ) : (
                <span
                  className={cn(
                    "block px-3 py-1.5",
                    col.align === "right" && "text-right"
                  )}
                >
                  {col.label}
                </span>
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

function ListViewRow({
  className,
  selected = false,
  ...props
}: React.ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      data-slot="list-view-row"
      data-selected={selected || undefined}
      className={cn(
        "group cursor-default border-b border-ui-separator/40 transition-colors",
        selected
          ? "bg-ui-accent/20 text-ui-label"
          : "hover-fill:bg-black/4 dark:hover-fill:bg-white/5",
        className
      )}
      {...props}
    />
  )
}

function ListViewCell({
  className,
  align,
  ...props
}: React.ComponentProps<"td"> & { align?: "left" | "right" }) {
  return (
    <td
      data-slot="list-view-cell"
      className={cn("px-3 py-1.5", align === "right" && "text-right", className)}
      {...props}
    />
  )
}

export { ListView, ListViewCell, ListViewHeader, ListViewRow }
