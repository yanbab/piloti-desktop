import * as React from "react"
import { InfoIcon } from "@/ui/components/ui/symbols";

import { _ } from "@/core/util/i18n"
import { cn } from "@/core/util/utils"
import { PanelResizeHandle, usePanelWidth } from "@/ui/components/ui/resizable-panel"

/**
 * The right-hand info pane (Folders' "Get Info", App Store details): a
 * resizable side panel using the sidebar's resize code, and its toggle.
 * Dragging it narrower than `collapseBelow` closes it.
 */
export function useInfoPane(
  id: string,
  /** Keeps open and width for the next window, e.g. in the app's settings. */
  remember?: {
    read: () => { open: boolean; width: number }
    write: (patch: { open?: boolean; width?: number }) => void
  },
) {
  const [open, setOpen] = React.useState(() => remember?.read().open ?? false)
  const rememberRef = React.useRef(remember)
  rememberRef.current = remember
  React.useEffect(() => {
    rememberRef.current?.write({ open })
  }, [open])
  const panel = usePanelWidth({
    storage: remember && {
      read: () => ({ width: remember.read().width, collapsed: false }),
      write: ({ width }) => remember.write({ width }),
    },
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
          "flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto border-l border-ui-separator bg-ui-sidebar/70 p-3 text-ui-label",
          className
        )}
      >
        {children}
      </aside>
    </div>
  )
}

/** The headerbar button that shows or hides the info pane: (i), or `icon`. */
export function InfoPaneToggle({
  pane,
  icon: Icon = InfoIcon,
}: {
  pane: ReturnType<typeof useInfoPane>
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <button
      type="button"
      aria-label={_("Toggle Info Pane")}
      title={_("Get Info")}
      aria-pressed={pane.open}
      onClick={() => pane.setOpen((v) => !v)}
      className={cn(
        "flex size-7 items-center justify-center rounded-ui-control transition-colors",
        pane.open
          ? "bg-black/10 text-ui-label dark:bg-white/15"
          : "text-ui-label-secondary hover-fill:bg-black/8 hover-fill:text-ui-label dark:hover-fill:bg-white/10"
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
