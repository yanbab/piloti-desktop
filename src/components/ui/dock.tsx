"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

// The macOS Dock: a Liquid Glass shelf of app icons along the bottom of the
// screen. `size` is the size of a tile, as set in Desktop & Dock settings;
// the icon artwork fills 80.5% of it, like Apple's icon grid.
// `magnification` grows tiles near the pointer, and `autoHide` slides the
// Dock away until the pointer reaches the bottom edge of its container.
// Position it yourself, e.g. `absolute bottom-2 left-1/2 -translate-x-1/2`.
function Dock({
  className,
  style,
  ref,
  size = 51,
  magnification,
  autoHide = false,
  revealed = false,
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: React.ComponentProps<"div"> & {
  size?: number
  magnification?: number
  autoHide?: boolean
  revealed?: boolean
}) {
  const element = React.useRef<HTMLDivElement | null>(null)
  const centers = React.useRef<number[] | null>(null)
  const [nearEdge, setNearEdge] = React.useState(false)
  const shown = !autoHide || revealed || nearEdge

  // Auto-hide: show the Dock when the pointer touches the bottom edge of the
  // Dock's container, hide it again when the pointer moves well above it.
  React.useEffect(() => {
    if (!autoHide) return
    function onMove(event: PointerEvent) {
      const node = element.current
      if (!node) return
      const area = (node.offsetParent ?? document.documentElement).getBoundingClientRect()
      const dock = node.getBoundingClientRect()
      const insideX = event.clientX >= area.left && event.clientX <= area.right
      if (insideX && event.clientY >= area.bottom - 6 && event.clientY <= area.bottom) {
        setNearEdge(true)
      } else if (event.clientY < area.bottom - dock.height - 48 || !insideX) {
        setNearEdge(false)
      }
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [autoHide])

  // Magnification: icons grow with their distance to the pointer. Centers are
  // measured once when the pointer enters, so growing icons don't feed back.
  function items() {
    return Array.from(
      element.current?.querySelectorAll<HTMLElement>('[data-slot="dock-item"]') ?? []
    )
  }

  function magnify(clientX: number) {
    const node = element.current
    if (!node || !magnification) return
    const scale = node.getBoundingClientRect().width / node.offsetWidth || 1
    const list = items()
    centers.current ??= list.map((item) => {
      const rect = item.getBoundingClientRect()
      return rect.left + rect.width / 2
    })
    // Tiles up to four places away grow.
    const range = size * 4
    list.forEach((item, index) => {
      const distance = Math.abs(clientX - (centers.current?.[index] ?? 0)) / scale
      const curve = distance >= range ? 0 : (1 + Math.cos((Math.PI * distance) / range)) / 2
      item.style.setProperty("--dock-item-size", `${size + (magnification - size) * curve}px`)
    })
  }

  function reset() {
    centers.current = null
    for (const item of items()) item.style.removeProperty("--dock-item-size")
  }

  return (
    <TooltipPrimitive.Provider delay={0}>
      <div
        ref={(node) => {
          element.current = node
          if (typeof ref === "function") return ref(node)
          if (ref) ref.current = node
        }}
        data-slot="dock"
        data-state={shown ? "visible" : "hidden"}
        role="toolbar"
        aria-label="Dock"
        className={cn(
          // The shelf keeps its height; magnified icons rise above it.
          "flex h-[calc(var(--dock-size)+18px)] w-fit items-end gap-0.5 rounded-[24px] p-[9px] text-mac-label shadow-mac-dock mac-material-dock transition-[translate,opacity] duration-300 ease-out data-[state=hidden]:pointer-events-none data-[state=hidden]:translate-y-[calc(100%+24px)] data-[state=hidden]:opacity-0",
          className
        )}
        style={{ "--dock-size": `${size}px`, ...style } as React.CSSProperties}
        onPointerMove={(event) => {
          onPointerMove?.(event)
          magnify(event.clientX)
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event)
          reset()
        }}
        {...props}
      >
        {children}
      </div>
    </TooltipPrimitive.Provider>
  )
}

// One tile in the Dock. `label` is shown above it on hover, `running` adds
// the dot below it and `badge` a red count. Pass a ref to use the item as
// the target that a
// window minimizes into. The button is laid over the icon rather than
// wrapped around it, so an item can show live content, such as a
// miniature of a minimized window, that has buttons of its own.
function DockItem({
  className,
  style,
  label,
  running = false,
  badge,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  label?: React.ReactNode
  running?: boolean
  badge?: React.ReactNode
}) {
  const button = (
    <button
      type="button"
      aria-label={typeof label === "string" ? label : undefined}
      className="absolute inset-0 cursor-default rounded-[22%] outline-none focus-visible:mac-focus-ring"
      {...props}
    />
  )

  return (
    <div
      data-slot="dock-item"
      data-running={running || undefined}
      className={cn(
        // A size container, so the badge scales with the tile.
        "@container relative flex size-[var(--dock-item-size,var(--dock-size))] shrink-0 items-center justify-center transition-[width,height] duration-150 ease-out has-[>button:active]:brightness-75 [&>img]:size-[80.5%] [&>svg]:size-[80.5%]",
        // The running indicator below the tile.
        "after:absolute after:-bottom-[5px] after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-black/50 after:opacity-0 data-[running]:after:opacity-100 dark:after:bg-white/55",
        className
      )}
      style={style}
    >
      {children}
      {badge != null && badge !== false ? (
        <span
          data-slot="dock-badge"
          className="pointer-events-none absolute top-[2cqw] right-[1cqw] flex h-[37cqw] min-w-[37cqw] items-center justify-center rounded-full bg-[#ec3830] px-[4cqw] text-[19.6cqw] leading-none font-medium text-white tabular-nums shadow-[0_0.5px_1.5px_rgb(0_0_0/0.3)]"
        >
          {badge}
        </span>
      ) : null}
      {label ? (
        <TooltipPrimitive.Root disableHoverablePopup>
          <TooltipPrimitive.Trigger render={button} />
          <TooltipPrimitive.Portal>
            {/* 3px between the arrow's tip and the tile. */}
            <TooltipPrimitive.Positioner side="top" sideOffset={9} className="z-[400]">
              <TooltipPrimitive.Popup className="flex h-[26px] items-center rounded-full px-3.5 text-[14px] text-mac-label shadow-mac-dock-label mac-material-dock-label dark:text-white/90">
                {label}
                <TooltipPrimitive.Arrow className="top-full block h-1.5 w-4 mac-material-dock-label [clip-path:polygon(0_0,100%_0,59%_100%,41%_100%)]" />
              </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      ) : (
        button
      )}
    </div>
  )
}

// A squircle app icon on the icon grid. Give it a background and put a
// symbol or image inside.
function DockIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dock-icon"
      className={cn(
        "flex size-[80.5%] items-center justify-center overflow-hidden rounded-[22.5%] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.2)] [&>svg]:size-[62%]",
        className
      )}
      {...props}
    />
  )
}

// The divider between apps and minimized windows, folders and the Trash.
function DockSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dock-separator"
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "mx-[11px] h-(--dock-size) w-px shrink-0 self-center bg-black/15 dark:bg-white/30",
        className
      )}
      {...props}
    />
  )
}

export { Dock, DockIcon, DockItem, DockSeparator }
