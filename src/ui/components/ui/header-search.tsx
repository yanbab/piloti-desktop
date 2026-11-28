import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";

import { _ } from "@/core/util/i18n"
import { cn } from "@/core/util/utils"

/**
 * The headerbar search: a magnifying-glass toggle that reveals a search field
 * next to it. Escape clears the text, then closes the field. Folders, App
 * Store and Settings › Permissions use it.
 */
export function HeaderSearch({
  open,
  onOpenChange,
  query,
  onQueryChange,
  placeholder,
  inputRef,
  showToggle = true,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  placeholder?: string
  /** For apps that focus the field themselves (type-to-search). */
  inputRef?: React.RefObject<HTMLInputElement | null>
  /** False hides the toggle (the field can still be open). */
  showToggle?: boolean
  className?: string
}) {
  const ownRef = React.useRef<HTMLInputElement | null>(null)
  const ref = inputRef ?? ownRef
  const label = placeholder ?? _("Search")

  const toggle = () => {
    const next = !open
    if (next) requestAnimationFrame(() => ref.current?.focus())
    else onQueryChange("")
    onOpenChange(next)
  }

  return (
    <div data-slot="header-search" className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {/* The field gives way first when the headerbar is narrow. */}
      {open && (
        <div className="relative flex min-w-0 shrink items-center">
          <SymbolicIcon name="system-search" fallback={SearchIcon} className="pointer-events-none absolute left-2 size-3.5 text-ui-label-secondary" />
          <input
            ref={ref}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return
              e.preventDefault()
              e.stopPropagation()
              if (query.length > 0) onQueryChange("")
              else onOpenChange(false)
            }}
            placeholder={label}
            aria-label={label}
            className="h-7 w-44 min-w-16 shrink rounded-ui-control border border-ui-separator bg-black/6 pr-6 pl-7 text-ui-body text-ui-label placeholder:text-ui-label-secondary focus:border-ui-accent focus:outline-none dark:bg-white/10 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label={_("Clear search")}
              onClick={() => {
                onQueryChange("")
                ref.current?.focus()
              }}
              className="absolute right-1 flex size-4.5 items-center justify-center rounded-full bg-black/10 text-ui-label-secondary dark:bg-white/15"
            >
              <SymbolicIcon name="window-close" fallback={XIcon} className="size-2.5" strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}
      {showToggle && (
        <button
          type="button"
          aria-label={_("Search")}
          data-slot="header-search-toggle"
          title={`${_("Search")} (Ctrl+F)`}
          aria-pressed={open}
          onClick={toggle}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-ui-control transition-colors",
            open
              ? "bg-black/10 text-ui-label dark:bg-white/15"
              : "text-ui-label-secondary hover-fill:bg-black/8 hover-fill:text-ui-label dark:hover-fill:bg-white/10"
          )}
        >
          <SymbolicIcon name="system-search" fallback={SearchIcon} className="size-4" />
        </button>
      )}
    </div>
  )
}
