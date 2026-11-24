import * as React from "react"
import { InfoIcon } from "lucide-react"

import { _ } from "@/lib/core/i18n"
import { cn } from "@/lib/core/utils"
import { PanelResizeHandle, usePanelWidth } from "@/components/ui/resizable-panel"

/**
 * The right-hand info pane (Folders' "Get Info", App Store details): a
 * resizable side panel using the sidebar's resize code, and its (i) toggle.
 * Dragging it narrower than `collapseBelow` closes it.
 */
export function useInfoPane(id: string) {
  const [open, setOpen] = React.useState(false)
  const panel = usePanelWidth({
    id,
    side: "left",
    defaultWidth: 240,
    min: 200,
    max: 420,
    collapseBelow: 150,
    onCollapsedChange: (collapsed) => {
      if (collapsed) setOpen(false)
    },
  })
  const { setCollapsed } = panel
  React.useEffect(() => {
    if (open) setCollapsed(false)
  }, [open, setCollapsed])
  return { open, setOpen, panel }
}

export function InfoPane({
  pane,
  label,
  className,
  children,
}: {
  pane: ReturnType<typeof useInfoPane>
  label?: string
  className?: string
  children: React.ReactNode
}) {
  if (!pane.open) return null
  const { panel } = pane
  return (
    <div
      data-slot="info-pane"
      className={cn(
        "relative flex shrink-0",
        // TODO: use the shared motion library once it lands.
        !panel.dragging && "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
      )}
      style={{ width: panel.width }}
    >
      <PanelResizeHandle
        side="left"
        dragging={panel.dragging}
        handleProps={panel.handleProps}
        label={_("Resize info pane")}
        style={{ left: -4 }}
      />
      <aside
        aria-label={label ?? _("Info Pane")}
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto border-l border-adw-separator bg-adw-sidebar/70 p-3 text-adw-label",
          className
        )}
      >
        {children}
      </aside>
    </div>
  )
}

/** The (i) headerbar button that shows or hides the info pane. */
export function InfoPaneToggle({ pane }: { pane: ReturnType<typeof useInfoPane> }) {
  return (
    <button
      type="button"
      aria-label={_("Toggle Info Pane")}
      title={_("Get Info")}
      aria-pressed={pane.open}
      onClick={() => pane.setOpen((v) => !v)}
      className={cn(
        "flex size-7 items-center justify-center rounded-adw-control transition-colors",
        pane.open
          ? "bg-black/10 text-adw-label dark:bg-white/15"
          : "text-adw-label-secondary hover-fill:bg-black/8 hover-fill:text-adw-label dark:hover-fill:bg-white/10"
      )}
    >
      <InfoIcon className="size-4" />
    </button>
  )
}
