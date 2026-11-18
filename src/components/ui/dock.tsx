"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

export type DockSide = "bottom" | "left" | "right"

const DockPositionContext = React.createContext<DockSide>("bottom")

// The desktop Dock: a shelf of app icons anchored to the bottom, left, or right
// edge of the screen like a flush tab. `size` is the tile size; artwork fills ~80%
// of each tile. `magnification` grows tiles near the pointer, and `autoHide`
// slides the Dock away until the pointer reaches the edge of its container.
function Dock({
  className,
  style,
  ref,
  size = 51,
  position = "bottom",
  magnification,
  autoHide = false,
  revealed = false,
  hidden = false,
  resizing = false,
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: React.ComponentProps<"div"> & {
  size?: number
  position?: DockSide
  magnification?: number
  autoHide?: boolean
  revealed?: boolean
  hidden?: boolean
  resizing?: boolean
}) {
  const element = React.useRef<HTMLDivElement | null>(null)
  const centers = React.useRef<number[] | null>(null)
  const [nearEdge, setNearEdge] = React.useState(false)
  const shown = !hidden && (!autoHide || revealed || nearEdge || resizing)
  const isVertical = position === "left" || position === "right"

  // Auto-hide: show the Dock when the pointer touches its screen edge,
  // hide it again when the pointer moves well away from it.
  React.useEffect(() => {
    if (!autoHide) return
    function onMove(event: PointerEvent) {
      const node = element.current
      if (!node) return
      const area = (node.offsetParent ?? document.documentElement).getBoundingClientRect()
      const dock = node.getBoundingClientRect()
      if (position === "left") {
        const insideY = event.clientY >= area.top && event.clientY <= area.bottom
        if (insideY && event.clientX <= area.left + 6 && event.clientX >= area.left) {
          setNearEdge(true)
        } else if (event.clientX > area.left + dock.width + 48 || !insideY) {
          setNearEdge(false)
        }
      } else if (position === "right") {
        const insideY = event.clientY >= area.top && event.clientY <= area.bottom
        if (insideY && event.clientX >= area.right - 6 && event.clientX <= area.right) {
          setNearEdge(true)
        } else if (event.clientX < area.right - dock.width - 48 || !insideY) {
          setNearEdge(false)
        }
      } else {
        const insideX = event.clientX >= area.left && event.clientX <= area.right
        if (insideX && event.clientY >= area.bottom - 6 && event.clientY <= area.bottom) {
          setNearEdge(true)
        } else if (event.clientY < area.bottom - dock.height - 48 || !insideX) {
          setNearEdge(false)
        }
      }
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [autoHide, position])

  // Magnification: icons grow with their distance to the pointer. Centers are
  // measured once when the pointer enters, so growing icons don't feed back.
  function items() {
    return Array.from(
      element.current?.querySelectorAll<HTMLElement>('[data-slot="dock-item"]') ?? []
    )
  }

  function magnify(pointerCoord: number) {
    const node = element.current
    if (!node || !magnification) return
    const scale =
      (isVertical
        ? node.getBoundingClientRect().height / node.offsetHeight
        : node.getBoundingClientRect().width / node.offsetWidth) || 1
    const list = items()
    centers.current ??= list.map((item) => {
      const rect = item.getBoundingClientRect()
      return isVertical
        ? rect.top + rect.height / 2
        : rect.left + rect.width / 2
    })
    // Tiles up to four places away grow.
    const range = size * 4
    list.forEach((item, index) => {
      const distance = Math.abs(pointerCoord - (centers.current?.[index] ?? 0)) / scale
      const curve = distance >= range ? 0 : (1 + Math.cos((Math.PI * distance) / range)) / 2
      item.style.setProperty("--dock-item-size", `${size + (magnification - size) * curve}px`)
    })
  }

  function reset() {
    centers.current = null
    for (const item of items()) item.style.removeProperty("--dock-item-size")
  }

  React.useEffect(() => {
    if (resizing) {
      reset()
    }
  }, [resizing])

  const positionClass =
    position === "left"
      ? "flex-col w-[calc(var(--dock-size)+14px)] h-fit items-start rounded-r-[18px] rounded-l-none border border-l-0 px-[7px] py-[10px] data-[state=hidden]:-translate-x-[calc(100%+24px)]"
      : position === "right"
        ? "flex-col w-[calc(var(--dock-size)+14px)] h-fit items-end rounded-l-[18px] rounded-r-none border border-r-0 px-[7px] py-[10px] data-[state=hidden]:translate-x-[calc(100%+24px)]"
        : "flex-row h-[calc(var(--dock-size)+14px)] w-fit items-end rounded-t-[18px] rounded-b-none border border-b-0 px-[10px] py-[7px] data-[state=hidden]:translate-y-[calc(100%+24px)]"

  return (
    <DockPositionContext.Provider value={position}>
      <TooltipPrimitive.Provider delay={0}>
        <div
          ref={(node) => {
            element.current = node
            if (typeof ref === "function") return ref(node)
            if (ref) ref.current = node
          }}
          data-slot="dock"
          data-position={position}
          data-state={shown ? "visible" : "hidden"}
          data-resizing={resizing || undefined}
          role="toolbar"
          aria-label="Dock"
          className={cn(
            "group/dock flex gap-2 border-black/10 bg-white/60 text-adw-label shadow-[0_6px_20px_rgb(0_0_0/0.16)] backdrop-blur-md transition-[translate,opacity] duration-300 ease-out data-[state=hidden]:pointer-events-none data-[state=hidden]:opacity-0 dark:border-white/10 dark:bg-black/40 dark:shadow-[0_8px_24px_rgb(0_0_0/0.38)]",
            positionClass,
            className
          )}
          style={{ "--dock-size": `${size}px`, ...style } as React.CSSProperties}
          onPointerMove={(event) => {
            onPointerMove?.(event)
            if (!resizing) magnify(isVertical ? event.clientY : event.clientX)
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
    </DockPositionContext.Provider>
  )
}

// One tile in the Dock. `label` is shown alongside it on hover, `runningCount`
// renders one indicator dot per open window, and `badge` shows a red count.
function DockItem({
  className,
  style,
  label,
  running = false,
  runningCount,
  launching = false,
  badge,
  tileRef,
  tileProps,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  label?: React.ReactNode
  running?: boolean
  runningCount?: number
  launching?: boolean
  badge?: React.ReactNode
  tileRef?: React.Ref<HTMLDivElement>
  tileProps?: React.HTMLAttributes<HTMLDivElement> &
    Record<`data-${string}`, string | undefined>
}) {
  const position = React.useContext(DockPositionContext)
  const resolvedCount = runningCount ?? (running ? 1 : 0)
  const dotCount = Math.min(Math.max(0, resolvedCount), 5)

  const button = (
    <button
      type="button"
      aria-label={typeof label === "string" ? label : undefined}
      className="absolute inset-0 cursor-default rounded-[22%] outline-none focus-visible:adw-focus-ring"
      {...props}
    />
  )

  const {
    className: tileClassName,
    style: tileStyle,
    ...restTileProps
  } = tileProps ?? {}

  const tooltipSide =
    position === "left" ? "right" : position === "right" ? "left" : "top"

  const dotsContainerClass =
    position === "left"
      ? "-left-[5px] top-1/2 -translate-y-1/2 flex-col"
      : position === "right"
        ? "-right-[5px] top-1/2 -translate-y-1/2 flex-col"
        : "-bottom-[5px] left-1/2 -translate-x-1/2 flex-row"

  return (
    <div
      ref={tileRef}
      data-slot="dock-item"
      data-running={dotCount > 0 || undefined}
      data-launching={launching || undefined}
      {...restTileProps}
      className={cn(
        // A size container, so the badge scales with the tile and the icon matches `--dock-size` exactly.
        "@container relative flex size-[var(--dock-item-size,var(--dock-size))] shrink-0 items-center justify-center transition-[width,height] duration-200 ease-out group-data-[resizing]/dock:transition-none has-[>button:active]:brightness-75 data-[launching]:animate-[dock-launch-pulse_0.8s_ease-in-out_infinite] [&>img]:size-full [&>svg]:size-full",
        tileClassName,
        className
      )}
      style={{ ...tileStyle, ...style }}
    >
      {children}
      {dotCount > 0 && (
        <span
          aria-hidden="true"
          data-slot="dock-running-dots"
          className={cn(
            "pointer-events-none absolute flex items-center justify-center gap-[3px]",
            dotsContainerClass
          )}
        >
          {Array.from({ length: dotCount }, (_, i) => (
            <span
              key={i}
              className="size-1 rounded-full bg-black/55 dark:bg-white/65"
            />
          ))}
        </span>
      )}
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
            <TooltipPrimitive.Positioner
              side={tooltipSide}
              sideOffset={9}
              className="z-[400]"
            >
              <TooltipPrimitive.Popup className="flex h-[26px] items-center rounded-[9px] px-3 text-[12.5px] font-medium text-adw-label shadow-adw-dock-label adw-material-dock-label dark:text-white/95">
                {label}
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
        "flex size-full items-center justify-center overflow-hidden rounded-[22.5%] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.2)] [&>svg]:size-[62%]",
        className
      )}
      {...props}
    />
  )
}

// The divider between apps and minimized windows, folders and the Trash.
// When `resizable` is set, dragging perpendicular to the Dock resizes it.
function DockSeparator({
  className,
  resizable = false,
  resizeSize = 52,
  minSize = 24,
  maxSize = 72,
  onResize,
  onResizeCommit,
  onResizingChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: React.ComponentProps<"div"> & {
  resizable?: boolean
  resizeSize?: number
  minSize?: number
  maxSize?: number
  onResize?: (nextSize: number) => void
  onResizeCommit?: (finalSize: number) => void
  onResizingChange?: (resizing: boolean) => void
}) {
  const position = React.useContext(DockPositionContext)
  const isVertical = position === "left" || position === "right"

  const dragRef = React.useRef<{
    pointerId: number
    startCoord: number
    startSize: number
    latestSize: number
  } | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event)
    if (!resizable || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startCoord: isVertical ? event.clientX : event.clientY,
      startSize: resizeSize,
      latestSize: resizeSize,
    }
    setDragging(true)
    onResizingChange?.(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event)
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    const delta =
      position === "left"
        ? event.clientX - drag.startCoord
        : position === "right"
          ? drag.startCoord - event.clientX
          : drag.startCoord - event.clientY
    const next = Math.max(
      minSize,
      Math.min(maxSize, Math.round(drag.startSize + delta))
    )
    if (next !== drag.latestSize) {
      drag.latestSize = next
      onResize?.(next)
    }
  }

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const finalSize = drag.latestSize
    dragRef.current = null
    setDragging(false)
    onResizingChange?.(false)
    onResizeCommit?.(finalSize)
  }

  if (!resizable) {
    return (
      <div
        data-slot="dock-separator"
        role="separator"
        aria-orientation={isVertical ? "horizontal" : "vertical"}
        className={cn(
          isVertical
            ? "my-[11px] h-px w-(--dock-size) shrink-0 self-center bg-black/15 dark:bg-white/30"
            : "mx-[11px] h-(--dock-size) w-px shrink-0 self-center bg-black/15 dark:bg-white/30",
          className
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        {...props}
      />
    )
  }

  return (
    <div
      data-slot="dock-separator"
      data-resizing={dragging || undefined}
      role="separator"
      aria-orientation={isVertical ? "horizontal" : "vertical"}
      aria-label="Drag to resize Dock"
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      aria-valuenow={resizeSize}
      className={cn(
        isVertical
          ? "group/sep my-[2px] flex h-[19px] w-(--dock-size) shrink-0 touch-none items-center justify-center self-center select-none cursor-ew-resize"
          : "group/sep mx-[2px] flex h-(--dock-size) w-[19px] shrink-0 touch-none items-center justify-center self-center select-none cursor-ns-resize",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => {
        onPointerUp?.(e)
        finishDrag(e)
      }}
      onPointerCancel={(e) => {
        onPointerCancel?.(e)
        finishDrag(e)
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          isVertical ? "h-px w-full" : "h-full w-px",
          "bg-black/15 group-hover/sep:bg-black/40 group-data-[resizing]/sep:bg-black/55 dark:bg-white/30 dark:group-hover/sep:bg-white/60 dark:group-data-[resizing]/sep:bg-white/75"
        )}
      />
    </div>
  )
}

export { Dock, DockIcon, DockItem, DockSeparator }
