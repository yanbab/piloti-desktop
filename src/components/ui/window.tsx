"use client"

import { installPopupPressThrough } from "@/lib/shell/popup-layer"
import * as React from "react"
import { MinusIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/core/utils"

type WindowPosition = { x: number; y: number }

type WindowSize = { width: number; height: number }

type WindowInsets = { top?: number; right?: number; bottom?: number; left?: number }

type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw"

type WindowHandle = {
  startMove: (clientX: number, clientY: number, pointerId?: number) => void
  startResize: (edge: ResizeEdge, clientX: number, clientY: number, pointerId?: number) => void
}

// Invisible resize strips placed mostly outside the frame (3px inward on edges,
// 4px inward on corners) so they remain easy to grab without stealing clicks
// from client-side headerbar buttons near window corners.
const RESIZE_HANDLES: Record<ResizeEdge, string> = {
  n: "inset-x-3 -top-[9px] h-[12px] cursor-ns-resize",
  s: "inset-x-3 -bottom-[9px] h-[12px] cursor-ns-resize",
  e: "inset-y-3 -right-[9px] w-[12px] cursor-ew-resize",
  w: "inset-y-3 -left-[9px] w-[12px] cursor-ew-resize",
  nw: "-top-[8px] -left-[8px] size-3 cursor-nwse-resize",
  ne: "-top-[8px] -right-[8px] size-3 cursor-nesw-resize",
  se: "-right-[8px] -bottom-[8px] size-3 cursor-nwse-resize",
  sw: "-bottom-[8px] -left-[8px] size-3 cursor-nesw-resize",
}

const RESIZE_CURSORS: Record<ResizeEdge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
}

const OPPOSITE = { n: "s", s: "n", e: "w", w: "e" } as const

type WindowControlKind = "minimize" | "maximize" | "close"

function parseWindowButtonLayout(layout?: string): {
  left: WindowControlKind[]
  right: WindowControlKind[]
} {
  const raw = (layout ?? ":close").trim()
  const colonIdx = raw.indexOf(":")
  const leftPart = colonIdx >= 0 ? raw.slice(0, colonIdx) : ""
  const rightPart = colonIdx >= 0 ? raw.slice(colonIdx + 1) : raw
  const parseSide = (part: string): WindowControlKind[] =>
    part
      .split(",")
      .map((token) => token.trim().toLowerCase())
      .filter(
        (token): token is WindowControlKind =>
          token === "minimize" || token === "maximize" || token === "close"
      )
  return {
    left: parseSide(leftPart),
    right: parseSide(rightPart),
  }
}

/** True when the button layout puts Close on the left (`close,…:`). */
function isCloseOnLeft(layout?: string): boolean {
  return parseWindowButtonLayout(layout).left.includes("close")
}

type WindowContextValue = {
  onClose?: () => void
  onMinimize?: () => void
  onZoom?: () => void
  maximized: boolean
  resizing: boolean
  buttonLayout: string
}

// Lets the traffic lights anywhere inside a window reach its handlers.
const WindowContext = React.createContext<WindowContextValue | null>(null)

function useWindowContext() {
  return React.useContext(WindowContext)
}

// Where a draggable window can be grabbed: the title bar, the toolbar, the
// strip above the sidebar, or anything marked with data-window-drag-region.
const DRAG_REGION =
  '[data-slot="window-titlebar"], [data-slot="toolbar"], [data-slot="ui-sidebar-header"], [data-window-drag-region]'

// Controls inside a drag region that should never start a window drag (text inputs, sliders).
const STRICT_NO_DRAG =
  'input, textarea, select, [role="slider"], [contenteditable="true"]'

// Interactive controls inside a drag region that work on click, but still allow
// dragging the window if the pointer moves past the drag threshold (GNOME behavior).
const INTERACTIVE_DRAG_CONTROL =
  'button, a, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [data-window-no-drag]'

// Controls inside a drag region keep working instead of moving the window on double-click.
const DOUBLE_CLICK_NO_ZOOM =
  'button, input, textarea, select, a, [role="button"], [role="tab"], [role="switch"], [role="slider"], [role="menuitem"], [contenteditable="true"]'
const NO_DRAG = `${STRICT_NO_DRAG}, ${INTERACTIVE_DRAG_CONTROL}`

// A drag can start even while a menu is open (it closes the menu).
if (typeof window !== "undefined") {
  installPopupPressThrough(DRAG_REGION, `${STRICT_NO_DRAG}, ${INTERACTIVE_DRAG_CONTROL}`)
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reducedMotion === "true")

type Point = [x: number, y: number]

// The matrix3d() that maps a width x height box onto the quadrilateral
// `quad` (top-left, top-right, bottom-right, bottom-left), with a
// transform-origin of 0 0. This is the square-to-quad projective mapping.
function quadToMatrix(width: number, height: number, quad: [Point, Point, Point, Point]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  const det = dx1 * dy2 - dx2 * dy1 || 1e-9
  const g = (dx3 * dy2 - dx2 * dy3) / det
  const h = (dx1 * dy3 - dx3 * dy1) / det
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + h * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + h * y3
  return `matrix3d(${a / width}, ${d / width}, 0, ${g / width}, ${b / height}, ${e / height}, 0, ${h / height}, 0, 0, 1, 0, ${x0}, ${y0}, 0, 1)`
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (from: number, to: number, t: number) => from + (to - from) * t

// The keyframes that shrink a window into `target` (e.g. its Dock tile).
// "genie" pulls the edge nearest the target into it first, narrowing the
// window into a funnel, then lets the far edge follow; "scale" simply
// scales it down. Played in reverse to restore.
function minimizeAnimation(
  element: HTMLElement,
  target: Element | null | undefined,
  effect: "genie" | "scale"
) {
  const rect = element.getBoundingClientRect()
  const width = element.offsetWidth
  const height = element.offsetHeight
  // Screen pixels per layout pixel, for windows inside a scaled container.
  const scale = rect.width / width || 1
  const goal =
    target?.getBoundingClientRect() ??
    new DOMRect(rect.left + rect.width / 2 - 24, window.innerHeight - 56, 48, 48)

  // The target in the window's own, unscaled coordinates, and the window
  // shrunk to fit inside it.
  const x = (goal.left + goal.width / 2 - rect.left) / scale
  const y = (goal.top + goal.height / 2 - rect.top) / scale
  const fit = Math.max(0.01, Math.min(goal.width / rect.width, goal.height / rect.height))
  const endWidth = width * fit
  const endHeight = height * fit

  if (effect === "scale") {
    const origin = `${x}px ${y}px`
    return {
      keyframes: [
        { transformOrigin: origin, transform: "scale(1)" },
        { transformOrigin: origin, transform: `scale(${fit})` },
      ],
      options: { duration: 360, easing: "cubic-bezier(0.45, 0, 0.75, 0.6)" },
    }
  }

  // The edge nearest the target leads; the far edge lags behind it.
  const below = y > height / 2
  const nearFrom = below ? height : 0
  const farFrom = below ? 0 : height
  const nearTo = y + (below ? endHeight : -endHeight) / 2
  const farTo = y + (below ? -endHeight : endHeight) / 2
  const steps = 24
  const keyframes: Keyframe[] = Array.from({ length: steps + 1 }, (_, step) => {
    const progress = step / steps
    const near = smooth(clamp(progress / 0.5))
    // The far edge narrows and swings toward the target before it travels.
    const narrow = smooth(clamp((progress - 0.1) / 0.6))
    const far = smooth(clamp((progress - 0.25) / 0.75))
    const farHalf = lerp(width / 2, endWidth / 2, narrow)
    const farCenter = lerp(width / 2, x, narrow)
    // Keeping the near edge at least 30% as wide as the far edge limits the
    // perspective, so the content is squeezed rather than tilted away.
    const nearHalf = Math.max(lerp(width / 2, endWidth / 2, near), farHalf * 0.3)
    const nearCenter = lerp(width / 2, x, near)
    const nearY = lerp(nearFrom, nearTo, near)
    const farY = lerp(farFrom, farTo, far)
    const top: [Point, Point] = below
      ? [[farCenter - farHalf, farY], [farCenter + farHalf, farY]]
      : [[nearCenter - nearHalf, nearY], [nearCenter + nearHalf, nearY]]
    const bottom: [Point, Point] = below
      ? [[nearCenter + nearHalf, nearY], [nearCenter - nearHalf, nearY]]
      : [[farCenter + farHalf, farY], [farCenter - farHalf, farY]]
    return {
      offset: progress,
      transformOrigin: "0 0",
      transform: quadToMatrix(width, height, [...top, ...bottom]),
    }
  })

  return {
    keyframes,
    options: { duration: 560, easing: "cubic-bezier(0.4, 0, 0.9, 0.8)" },
  }
}

// A desktop window frame. Compose it with WindowTitlebar, Toolbar, and WindowContent.
// `inactive` renders the unfocused look. `draggable` lets users move the window
// by its title bar or toolbar; the offset is applied with the CSS `translate` property.
// `onClose`, `onMinimize` and `onZoom` wire up the traffic lights. Setting
// `minimized` animates the window into `minimizeTo` (e.g. a Dock tile) and
// back; `maximized` grows it to fill its parent.
// `resizable` lets people resize it by its edges and corners, between
// `minSize` and `maxSize`; double-clicking an edge stretches it to the
// parent's edge (with Option, the opposite edge too).
function Window({
  className,
  style,
  ref,
  windowRef,
  children,
  inactive = false,
  draggable = false,
  bounds,
  position,
  defaultPosition,
  onPositionChange,
  resizable = false,
  size,
  defaultSize,
  onSizeChange,
  minSize,
  maxSize,
  onClose,
  onMinimize,
  onZoom,
  minimized = false,
  minimizeTo,
  minimizeEffect = "scale",
  maximized = false,
  maximizeInsets,
  buttonLayout = ":close",
  onSnapPreviewChange,
  onSnapCommit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  ...props
}: Omit<React.ComponentProps<"div">, "draggable"> & {
  inactive?: boolean
  draggable?: boolean
  bounds?: "parent"
  position?: WindowPosition
  defaultPosition?: WindowPosition
  onPositionChange?: (position: WindowPosition) => void
  resizable?: boolean
  size?: WindowSize
  defaultSize?: WindowSize
  onSizeChange?: (size: WindowSize) => void
  minSize?: Partial<WindowSize>
  maxSize?: Partial<WindowSize>
  onClose?: () => void
  onMinimize?: () => void
  onZoom?: () => void
  minimized?: boolean
  minimizeTo?: React.RefObject<Element | null>
  minimizeEffect?: "genie" | "scale"
  maximized?: boolean
  maximizeInsets?: WindowInsets
  buttonLayout?: string
  onSnapPreviewChange?: (zone: "left" | "right" | "full" | null) => void
  onSnapCommit?: (zone: "left" | "right" | "full") => void
  windowRef?: React.Ref<WindowHandle>
}) {
  const [uncontrolledPosition, setUncontrolledPosition] =
    React.useState<WindowPosition>(defaultPosition ?? { x: 0, y: 0 })
  const current = position ?? uncontrolledPosition
  const [dragging, setDragging] = React.useState(false)
  const element = React.useRef<HTMLDivElement | null>(null)

  // Until it is resized, the window keeps the size its classes give it.
  const [uncontrolledSize, setUncontrolledSize] = React.useState(defaultSize)
  const currentSize = size ?? uncontrolledSize
  const [resizing, setResizing] = React.useState<ResizeEdge | null>(null)

  React.useEffect(() => {
    if (!dragging && !resizing) return
    document.documentElement.setAttribute("data-piloti-window-dragging", "")
    return () => {
      document.documentElement.removeAttribute("data-piloti-window-dragging")
    }
  }, [dragging, resizing])

  function move(next: WindowPosition) {
    if (position === undefined) setUncontrolledPosition(next)
    onPositionChange?.(next)
  }

  // Where the top-left corner should land once the new size is laid out.
  // A window centered by its classes moves as it grows, so the offset that
  // keeps the opposite edges in place is only known after layout.
  const anchor = React.useRef<WindowPosition | null>(null)
  function setFrame(next: WindowSize, corner: WindowPosition) {
    anchor.current = corner
    if (size === undefined) setUncontrolledSize(next)
    onSizeChange?.(next)
  }
  React.useLayoutEffect(() => {
    const node = element.current
    const corner = anchor.current
    if (!node || !corner) return
    anchor.current = null
    const next = { x: corner.x - node.offsetLeft, y: corner.y - node.offsetTop }
    if (next.x !== current.x || next.y !== current.y) move(next)
  })

  // `hidden` lags behind `minimized` so the window stays visible while it
  // animates into the Dock.
  const [hidden, setHidden] = React.useState(minimized)
  // Restoring, or minimizing without motion, shows or hides the window at once.
  const [renderedMinimized, setRenderedMinimized] = React.useState(minimized)
  if (renderedMinimized !== minimized) {
    setRenderedMinimized(minimized)
    if (!minimized || reducedMotion()) setHidden(minimized)
  }
  const previousMinimized = React.useRef(minimized)
  React.useLayoutEffect(() => {
    const node = element.current
    if (!node || previousMinimized.current === minimized) return
    previousMinimized.current = minimized
    if (!minimized) {
      node.style.visibility = ""
    }
    if (reducedMotion()) return
    const { keyframes, options } = minimizeAnimation(node, minimizeTo?.current, minimizeEffect)
    if (minimized) {
      const animation = node.animate(keyframes, { ...options, fill: "forwards" })
      animation.finished
        .then(() => {
          node.style.visibility = "hidden"
          setHidden(true)
          animation.cancel()
        })
        .catch(() => {})
    } else {
      // Reversed, the ease-in of minimizing becomes an ease-out.
      node.animate(keyframes, {
        ...options,
        direction: "reverse",
        fill: "backwards",
      })
    }
  }, [minimized, minimizeTo, minimizeEffect])

  // Zooming in and out morphs the window from its old frame to the new one.
  const lastRect = React.useRef<DOMRect | null>(null)
  const previousMaximized = React.useRef(maximized)
  // Measure the old frame only when the zoom state flips (the DOM still shows it during this
  // render). Reading it after every render forced a layout on each focus change.
  if (element.current && previousMaximized.current !== maximized) {
    lastRect.current = element.current.getBoundingClientRect()
  }
  const maxDragPending = React.useRef<{
    pointerId: number
    startX: number
    startY: number
  } | null>(null)
  const pendingResumeDrag = React.useRef<{
    clientX: number
    clientY: number
  } | null>(null)

  React.useLayoutEffect(() => {
    const node = element.current
    const before = lastRect.current
    if (!node || previousMaximized.current === maximized) return
    previousMaximized.current = maximized

    const resume = pendingResumeDrag.current
    if (!maximized && resume) {
      pendingResumeDrag.current = null
      const parent = node.offsetParent as HTMLElement | null
      const parentRect = parent?.getBoundingClientRect()
      if (parentRect) {
        const nextPos = {
          x: Math.round(resume.clientX - parentRect.left - node.offsetWidth / 2),
          y: Math.round(
            Math.min(
              Math.max(0, parentRect.height - 48),
              Math.max(0, resume.clientY - parentRect.top - 18)
            )
          ),
        }
        node.style.translate = `${nextPos.x}px ${nextPos.y}px`
        move(nextPos)
        beginDrag(node, resume.clientX, resume.clientY)
      }
      return
    }

    if (!before || reducedMotion()) return
    const after = node.getBoundingClientRect()
    const scale = after.width / node.offsetWidth || 1
    node.animate(
      [
        {
          transformOrigin: "0 0",
          transform: `translate(${(before.left - after.left) / scale}px, ${(before.top - after.top) / scale}px) scale(${before.width / after.width}, ${before.height / after.height})`,
        },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: 380, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)" }
    )
  }, [maximized])

  const isResizing = resizing !== null
  const context = React.useMemo(
    () => ({
      onClose,
      onMinimize,
      onZoom,
      maximized,
      resizing: isResizing,
      buttonLayout,
    }),
    [onClose, onMinimize, onZoom, maximized, isResizing, buttonLayout]
  )
  const drag = React.useRef<{
    pointer: WindowPosition
    start: WindowPosition
    latest: WindowPosition
    size: WindowSize
    scale: number
    min: WindowPosition
    max: WindowPosition
    snapZone: "left" | "right" | "full" | null
    parentRect: DOMRect | null
  } | null>(null)

  const resize = React.useRef<{
    edge: ResizeEdge
    pointer: WindowPosition
    start: WindowSize
    corner: WindowPosition
    latestSize: WindowSize
    latestCorner: WindowPosition
    scale: number
    min: WindowSize
    max: WindowSize
  } | null>(null)

  // The window's top-left corner in its parent's layout, including the
  // drag offset, and the screen-to-layout scale.
  function measure(node: HTMLElement) {
    const rect = node.getBoundingClientRect()
    return {
      rect,
      scale: rect.width / node.offsetWidth || 1,
      start: { width: node.offsetWidth, height: node.offsetHeight },
      corner: { x: node.offsetLeft + current.x, y: node.offsetTop + current.y },
    }
  }

  function beginResize(node: HTMLElement, edge: ResizeEdge, clientX: number, clientY: number, pointerId?: number) {
    const { rect, scale, start, corner } = measure(node)
    // A window that starts outside its limits doesn't jump to them.
    const min = {
      width: Math.min(minSize?.width ?? 240, start.width),
      height: Math.min(minSize?.height ?? 140, start.height),
    }
    const max = {
      width: Math.max(maxSize?.width ?? Number.POSITIVE_INFINITY, start.width),
      height: Math.max(maxSize?.height ?? Number.POSITIVE_INFINITY, start.height),
    }
    const parent = bounds === "parent" ? node.parentElement : null
    if (parent && edge.includes("n")) {
      const area = parent.getBoundingClientRect()
      const roomTop = Math.max(0, (rect.top - area.top) / scale)
      max.height = Math.min(max.height, start.height + roomTop)
    }

    resize.current = {
      edge,
      pointer: { x: clientX, y: clientY },
      start,
      corner,
      latestSize: start,
      latestCorner: corner,
      scale,
      min,
      max,
    }
    if (pointerId !== undefined) {
      try {
        node.setPointerCapture(pointerId)
      } catch {
        attachGlobalInteractionListeners()
      }
    } else {
      attachGlobalInteractionListeners()
    }
    setResizing(edge)
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) {
    beginResize(event.currentTarget, edge, event.clientX, event.clientY, event.pointerId)
    event.preventDefault()
  }

  function applyResize(clientX: number, clientY: number) {
    const state = resize.current!
    const { edge, pointer, start, corner, scale, min, max } = state
    const dx = (clientX - pointer.x) / scale
    const dy = (clientY - pointer.y) / scale
    const fit = (value: number, axis: keyof WindowSize) =>
      Math.round(Math.min(max[axis], Math.max(min[axis], value)))
    const width = fit(edge.includes("e") ? start.width + dx : edge.includes("w") ? start.width - dx : start.width, "width")
    const height = fit(edge.includes("s") ? start.height + dy : edge.includes("n") ? start.height - dy : start.height, "height")
    const nextCorner = {
      x: edge.includes("w") ? corner.x + start.width - width : corner.x,
      y: edge.includes("n") ? corner.y + start.height - height : corner.y,
    }
    state.latestSize = { width, height }
    state.latestCorner = nextCorner

    // Mutate the DOM node directly during resize so React doesn't re-render on every pointermove.
    const node = element.current
    if (node) {
      node.style.width = `${width}px`
      node.style.height = `${height}px`
      const tx = nextCorner.x - node.offsetLeft
      const ty = nextCorner.y - node.offsetTop
      node.style.translate = tx || ty ? `${tx}px ${ty}px` : ""
    }
  }

  // Double-clicking an edge stretches it to the parent's edge, inside the
  // maximize insets; with Option the opposite edge follows.
  function fillToEdge(node: HTMLElement, edge: ResizeEdge, both: boolean) {
    const parent = node.parentElement
    if (!parent) return
    const { rect, scale, start, corner } = measure(node)
    const area = parent.getBoundingClientRect()
    const room = {
      n: (rect.top - area.top) / scale - insets.top,
      s: (area.bottom - rect.bottom) / scale - insets.bottom,
      w: (rect.left - area.left) / scale - insets.left,
      e: (area.right - rect.right) / scale - insets.right,
    }
    const grows = (side: keyof typeof OPPOSITE) =>
      edge.includes(side) || (both && edge.includes(OPPOSITE[side]))
    const reach = (side: keyof typeof OPPOSITE) => (grows(side) ? Math.max(0, room[side]) : 0)
    const width = Math.min(maxSize?.width ?? Number.POSITIVE_INFINITY, start.width + reach("w") + reach("e"))
    const height = Math.min(maxSize?.height ?? Number.POSITIVE_INFINITY, start.height + reach("n") + reach("s"))
    setFrame(
      { width: Math.max(width, start.width), height: Math.max(height, start.height) },
      {
        x: grows("w") && !grows("e") ? corner.x + start.width - Math.max(width, start.width) : corner.x - reach("w"),
        y: grows("n") && !grows("s") ? corner.y + start.height - Math.max(height, start.height) : corner.y - reach("n"),
      }
    )
  }

  // The handle a pointer event targets, if it belongs to this window.
  function resizeEdge(event: React.SyntheticEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    return target.parentElement === event.currentTarget
      ? (target.dataset.resizeEdge as ResizeEdge | undefined)
      : undefined
  }

  // Pointer capture retargets the double-click to the window itself, so the
  // edge it started on is remembered.
  const pressedEdge = React.useRef<ResizeEdge | undefined>(undefined)

  const globalCleanup = React.useRef<(() => void) | null>(null)

  React.useEffect(() => () => globalCleanup.current?.(), [])

  function detachGlobalInteractionListeners() {
    globalCleanup.current?.()
    globalCleanup.current = null
  }

  function attachGlobalInteractionListeners() {
    detachGlobalInteractionListeners()
    // When a drag/resize is initiated by a Wayland client (xdg_toplevel.move /
    // resize), the initial pointerdown happened inside <app>, so Chromium may
    // report `e.buttons === 0` on subsequent pointermove events. Only treat
    // `buttons === 0` as a missed pointerup if we previously observed bit 1 set.
    let sawPrimaryButtonDown = false
    const onWinPointerMove = (e: PointerEvent) => {
      if ((e.buttons & 1) !== 0) {
        sawPrimaryButtonDown = true
      } else if (sawPrimaryButtonDown) {
        finishInteraction()
        return
      }
      if (resize.current) {
        applyResize(e.clientX, e.clientY)
      } else if (drag.current) {
        applyDragMove(e.clientX, e.clientY)
      }
    }
    const onWinEnd = () => finishInteraction()
    window.addEventListener("pointermove", onWinPointerMove, { capture: true })
    window.addEventListener("pointerup", onWinEnd, { capture: true })
    window.addEventListener("pointercancel", onWinEnd, { capture: true })
    globalCleanup.current = () => {
      window.removeEventListener("pointermove", onWinPointerMove, { capture: true })
      window.removeEventListener("pointerup", onWinEnd, { capture: true })
      window.removeEventListener("pointercancel", onWinEnd, { capture: true })
    }
  }

  function beginDrag(node: HTMLElement, clientX: number, clientY: number, pointerId?: number) {
    // Pointer movement is in screen pixels; divide by any CSS scale applied
    // to the window (e.g. a scaled-down preview) to get layout pixels.
    const rect = node.getBoundingClientRect()
    const scale = rect.width / node.offsetWidth || 1
    const limit = Number.POSITIVE_INFINITY
    let min = { x: -limit, y: -limit }
    let max = { x: limit, y: limit }
    const parent = bounds === "parent" ? node.parentElement : null
    if (parent) {
      const area = parent.getBoundingClientRect()
      // Keep the titlebar inside the viewport/canvas vertically (top >= area.top,
      // and at least 48px above area.bottom) and keep >= 80px horizontally reachable.
      const minY = current.y + (area.top - rect.top) / scale
      const maxY =
        current.y +
        (area.bottom - rect.top) / scale -
        Math.min(48, node.offsetHeight)
      const keepX = Math.min(80, node.offsetWidth)
      const minX = current.x + (area.left - rect.right) / scale + keepX
      const maxX = current.x + (area.right - rect.left) / scale - keepX
      min = {
        x: minX,
        y: minY,
      }
      max = {
        x: Math.max(minX, maxX),
        y: Math.max(minY, maxY),
      }
    }

    drag.current = {
      pointer: { x: clientX, y: clientY },
      start: current,
      latest: current,
      size: { width: node.offsetWidth, height: node.offsetHeight },
      scale,
      min,
      max,
      snapZone: null,
      parentRect: parent ? parent.getBoundingClientRect() : null,
    }
    if (pointerId !== undefined) {
      try {
        node.setPointerCapture(pointerId)
      } catch {
        attachGlobalInteractionListeners()
      }
    } else {
      attachGlobalInteractionListeners()
    }
    setDragging(true)
  }

  const interactiveDragCleanupRef = React.useRef<(() => void) | null>(null)

  React.useEffect(() => {
    return () => {
      interactiveDragCleanupRef.current?.()
      interactiveDragCleanupRef.current = null
    }
  }, [])

  function startPendingInteractiveDrag(
    node: HTMLDivElement,
    pointerId: number,
    startX: number,
    startY: number,
    isMaximized: boolean
  ) {
    interactiveDragCleanupRef.current?.()
    const threshold = isMaximized ? 6 : 4
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove, true)
      window.removeEventListener("pointerup", onEnd, true)
      window.removeEventListener("pointercancel", onEnd, true)
      if (interactiveDragCleanupRef.current === cleanup) {
        interactiveDragCleanupRef.current = null
      }
    }
    const suppressNextClick = () => {
      const blockClick = (ev: MouseEvent) => {
        ev.preventDefault()
        ev.stopPropagation()
        window.removeEventListener("click", blockClick, true)
      }
      window.addEventListener("click", blockClick, true)
      window.setTimeout(() => window.removeEventListener("click", blockClick, true), 400)
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return
      cleanup()
      window.getSelection()?.removeAllRanges()
      suppressNextClick()
      if (isMaximized) {
        pendingResumeDrag.current = {
          clientX: ev.clientX,
          clientY: ev.clientY,
        }
        onZoom?.()
      } else {
        beginDrag(node, startX, startY, pointerId)
        applyDragMove(ev.clientX, ev.clientY)
      }
    }
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cleanup()
    }
    window.addEventListener("pointermove", onMove, true)
    window.addEventListener("pointerup", onEnd, true)
    window.addEventListener("pointercancel", onEnd, true)
    interactiveDragCleanupRef.current = cleanup
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    onPointerDown?.(event)
    if (event.defaultPrevented || event.button !== 0) return

    if (maximized) {
      if (!draggable || !onZoom) return
      const node = event.currentTarget
      const target = event.target as HTMLElement
      const region = target.closest(DRAG_REGION)
      if (
        !region ||
        region.closest('[data-slot="window"]') !== node ||
        target.closest(STRICT_NO_DRAG)
      ) {
        return
      }
      startPendingInteractiveDrag(
        node,
        event.pointerId,
        event.clientX,
        event.clientY,
        true
      )
      return
    }

    const edge = resizable ? resizeEdge(event) : undefined
    pressedEdge.current = edge
    if (edge) return startResize(event, edge)
    if (!draggable) return

    const node = event.currentTarget
    const target = event.target as HTMLElement
    const region = target.closest(DRAG_REGION)
    if (
      !region ||
      region.closest('[data-slot="window"]') !== node ||
      target.closest(STRICT_NO_DRAG)
    ) {
      return
    }

    startPendingInteractiveDrag(
      node,
      event.pointerId,
      event.clientX,
      event.clientY,
      false
    )
  }

  function applyDragMove(clientX: number, clientY: number) {
    const state = drag.current
    if (!state) return
    const rawX = state.start.x + (clientX - state.pointer.x) / state.scale
    const rawY = state.start.y + (clientY - state.pointer.y) / state.scale
    const next = {
      x: Math.round(Math.min(state.max.x, Math.max(state.min.x, rawX))),
      y: Math.round(Math.min(state.max.y, Math.max(state.min.y, rawY))),
    }
    state.latest = next

    // Write directly to the DOM node's CSS `translate` property during the drag
    // so zero React state/context re-renders happen on pointermove (120-240Hz).
    const node = element.current
    if (node) {
      node.style.translate = next.x || next.y ? `${next.x}px ${next.y}px` : ""
    }

    // Edge snap zone detection (fires callback only on zone transition)
    if (onSnapPreviewChange || onSnapCommit) {
      const area = state.parentRect
      let nextSnap: "left" | "right" | "full" | null = null
      if (area) {
        if (clientX <= area.left + 12) {
          nextSnap = "left"
        } else if (clientX >= area.right - 12) {
          nextSnap = "right"
        } else if (clientY <= area.top + 10) {
          nextSnap = "full"
        }
      }
      if (nextSnap !== state.snapZone) {
        state.snapZone = nextSnap
        onSnapPreviewChange?.(nextSnap)
      }
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event)
    const pendingMax = maxDragPending.current
    if (pendingMax && event.pointerId === pendingMax.pointerId) {
      if (
        Math.hypot(
          event.clientX - pendingMax.startX,
          event.clientY - pendingMax.startY
        ) >= 6
      ) {
        maxDragPending.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        pendingResumeDrag.current = {
          clientX: event.clientX,
          clientY: event.clientY,
        }
        onZoom?.()
      }
      return
    }
    if (resize.current) return applyResize(event.clientX, event.clientY)
    applyDragMove(event.clientX, event.clientY)
  }

  function finishInteraction(event?: React.PointerEvent<HTMLDivElement>) {
    maxDragPending.current = null
    interactiveDragCleanupRef.current?.()
    detachGlobalInteractionListeners()
    const finishedDrag = drag.current
    const finishedResize = resize.current
    if (!finishedDrag && !finishedResize) return
    drag.current = null
    resize.current = null
    anchor.current = null
    setDragging(false)
    setResizing(null)
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (finishedDrag?.snapZone) {
      const zone = finishedDrag.snapZone
      onSnapPreviewChange?.(null)
      if (onSnapCommit) {
        if (element.current) {
          element.current.style.translate =
            current.x || current.y ? `${current.x}px ${current.y}px` : ""
        }
        onSnapCommit(zone)
        return
      }
    } else if (finishedDrag) {
      onSnapPreviewChange?.(null)
    }
    if (
      finishedDrag &&
      (finishedDrag.latest.x !== finishedDrag.start.x ||
        finishedDrag.latest.y !== finishedDrag.start.y)
    ) {
      move(finishedDrag.latest)
    }
    if (
      finishedResize &&
      (finishedResize.latestSize.width !== finishedResize.start.width ||
        finishedResize.latestSize.height !== finishedResize.start.height)
    ) {
      setFrame(finishedResize.latestSize, finishedResize.latestCorner)
    }
  }

  React.useImperativeHandle(windowRef, () => ({
    startMove: (clientX: number, clientY: number, pointerId?: number) => {
      const node = element.current
      if (!node || !draggable) return
      if (maximized) {
        if (!onZoom) return
        pendingResumeDrag.current = { clientX, clientY }
        onZoom()
        return
      }
      beginDrag(node, clientX, clientY, pointerId)
    },
    startResize: (edge: ResizeEdge, clientX: number, clientY: number, pointerId?: number) => {
      const node = element.current
      if (!node || maximized || !resizable) return
      beginResize(node, edge, clientX, clientY, pointerId)
    },
  }))

  const activePosition = drag.current?.latest ?? current
  const activeSize = resize.current?.latestSize ?? currentSize

  const insets = { top: 0, right: 0, bottom: 0, left: 0, ...maximizeInsets }

  // With a fixed width (or height) only the other two edges resize, along
  // their full length.
  const fixedWidth = minSize?.width !== undefined && minSize.width === maxSize?.width
  const fixedHeight = minSize?.height !== undefined && minSize.height === maxSize?.height
  const handles = (Object.keys(RESIZE_HANDLES) as ResizeEdge[]).filter(
    (edge) => !(fixedWidth && /[ew]/.test(edge)) && !(fixedHeight && /[ns]/.test(edge))
  )

  return (
    <WindowContext.Provider value={context}>
      <div
        ref={(node) => {
          element.current = node
          if (typeof ref === "function") return ref(node)
          if (ref) ref.current = node
        }}
        data-slot="window"
        data-inactive={inactive || undefined}
        data-draggable={draggable || undefined}
        data-dragging={dragging || undefined}
        data-resizable={resizable || undefined}
        data-resizing={resizing ?? undefined}
        data-maximized={maximized || undefined}
        data-minimized={hidden || undefined}
        aria-hidden={hidden || undefined}
        inert={hidden || undefined}
        className={cn(
          "group/window relative isolate flex overflow-visible rounded-ui-window bg-ui-window text-ui-body text-ui-label shadow-ui-window data-[inactive]:shadow-ui-window-inactive has-[>[data-slot=ui-sidebar]]:bg-transparent has-[.bg-ui-sidebar]:bg-transparent",
          // The thin light rim drawn on top of everything inside the frame.
          "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--ui-window-rim)]",
          // Touch drags on the drag regions move the window instead of scrolling.
          "data-[draggable]:[&_:is([data-slot=window-titlebar],[data-slot=toolbar],[data-slot=ui-sidebar-header],[data-window-drag-region])]:touch-none data-[dragging]:select-none",
          // While dragging or resizing, prevent iframes or Wayland <app> surfaces
          // from swallowing pointer moves without changing the cursor during drag.
          "data-[resizing]:select-none data-[resizing]:*:pointer-events-none data-[dragging]:[&_iframe]:pointer-events-none data-[dragging]:[&_app]:pointer-events-none",
          "data-[dragging]:will-change-[translate] data-[resizing]:will-change-[translate,width,height]",
          "data-[minimized]:invisible",
          className
        )}
        style={
          maximized
            ? {
                ...style,
                // Override any positioning from classes, e.g. centering.
                position: "absolute",
                top: insets.top,
                left: insets.left,
                right: "auto",
                bottom: "auto",
                margin: 0,
                translate: "none",
                width: `calc(100% - ${insets.left + insets.right}px)`,
                height: `calc(100% - ${insets.top + insets.bottom}px)`,
              }
            : {
                ...style,
                ...activeSize,
                translate:
                  activePosition.x || activePosition.y
                    ? `${activePosition.x}px ${activePosition.y}px`
                    : undefined,
                cursor: resizing ? RESIZE_CURSORS[resizing] : style?.cursor,
              }
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          onPointerUp?.(event)
          finishInteraction(event)
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event)
          finishInteraction(event)
        }}
        onLostPointerCapture={() => {
          finishInteraction()
        }}
        onDoubleClick={(event) => {
          onDoubleClick?.(event)
          // Double-clicking the title bar toggles window zoom/maximize.
          const target = event.target as HTMLElement
          const region = target.closest(DRAG_REGION)
          const isSidebarBody = Boolean(
            target.closest('aside, [data-slot="ui-sidebar"]') &&
              !target.closest('[data-slot="window-titlebar"], [data-slot="ui-sidebar-header"]')
          )
          if (
            onZoom &&
            !event.defaultPrevented &&
            !isSidebarBody &&
            region?.closest('[data-slot="window"]') === event.currentTarget &&
            !target.closest(DOUBLE_CLICK_NO_ZOOM)
          ) {
            onZoom()
            return
          }
          const edge =
            resizeEdge(event) ??
            (event.target === event.currentTarget ? pressedEdge.current : undefined)
          if (resizable && edge && !event.defaultPrevented) {
            return fillToEdge(event.currentTarget, edge, event.altKey)
          }
        }}
        {...props}
      >
        {children}
        {resizable && !maximized && !hidden
          ? handles.map((edge) => (
              <div
                key={edge}
                aria-hidden="true"
                data-slot="window-resize-handle"
                data-resize-edge={edge}
                className={cn(
                  "absolute z-50 touch-none",
                  RESIZE_HANDLES[edge],
                  fixedWidth && "inset-x-0",
                  fixedHeight && "inset-y-0"
                )}
              />
            ))
          : null}
      </div>
    </WindowContext.Provider>
  )
}

// Unified Adwaita titlebar / headerbar used by both SSD and CSD windows.
// Double-clicking empty titlebar space toggles maximize/unmaximize.
function WindowTitlebar({
  className,
  children,
  onDoubleClick,
  ...props
}: React.ComponentProps<"div">) {
  const context = React.useContext(WindowContext)
  return (
    <div
      data-slot="window-titlebar"
      onDoubleClick={(event) => {
        onDoubleClick?.(event)
        if (event.defaultPrevented) return
        const target = event.target as HTMLElement
        if (target.closest(DOUBLE_CLICK_NO_ZOOM)) return
        event.stopPropagation()
        context?.onZoom?.()
      }}
      className={cn(
        "relative flex h-[46px] min-h-[46px] shrink-0 items-center justify-between gap-2 rounded-t-[inherit] border-b border-ui-separator px-[9px] select-none ui-material-titlebar in-data-[inactive]:[&>*]:opacity-65",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function WindowTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="window-title"
      className={cn(
        "pointer-events-none absolute inset-x-24 truncate whitespace-nowrap text-center text-ui-body font-bold text-ui-label group-data-[inactive]/window:text-ui-label-tertiary",
        className
      )}
      {...props}
    />
  )
}

function WindowContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="window-content"
      className={cn("min-h-0 min-w-0 flex-1 overflow-auto", className)}
      {...props}
    />
  )
}

// Stacks a toolbar or title bar above the content, to the right of a sidebar.
// It takes on the window's corners at the window's edges, so a glass title
// bar inside can round its own corners: Chrome doesn't always clip a
// backdrop filter to an ancestor's rounded corners.
function WindowMain({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="window-main"
      className={cn(
        "flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-[inherit] bg-ui-window first:rounded-l-[inherit] has-[.bg-ui-sidebar]:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

// The round title-bar button: close, minimize, maximize and the window menu.
const WINDOW_CONTROL_CLASS =
  "flex size-6 items-center justify-center rounded-full bg-black/6 text-ui-label-secondary transition-colors outline-none hover-fill:bg-black/12 hover-fill:text-ui-label active:bg-black/18 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-ui-accent/50 group-data-[inactive]/window:opacity-50 dark:bg-white/8 dark:hover-fill:bg-white/15 dark:active:bg-white/22"

function WindowControlButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(WINDOW_CONTROL_CLASS, "[&_svg]:size-3", className)}
      {...props}
    />
  )
}

// Adwaita circular monochrome window controls respecting GNOME `button-layout`.
function WindowControls({
  className,
  side = "right",
  layout,
  onClose,
  onMinimize,
  onZoom,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  side?: "left" | "right"
  layout?: string
  onClose?: () => void
  onMinimize?: () => void
  onZoom?: () => void
}) {
  const context = React.useContext(WindowContext)
  onClose ??= context?.onClose
  onMinimize ??= context?.onMinimize
  onZoom ??= context?.onZoom

  const parsed = parseWindowButtonLayout(layout ?? context?.buttonLayout)
  const buttons = side === "left" ? parsed.left : parsed.right
  if (buttons.length === 0) return null

  return (
    <div
      data-slot="window-controls"
      className={cn("group/controls flex items-center gap-2", className)}
      {...props}
    >
      {buttons.map((kind) => {
        if (kind === "minimize") {
          return (
            <WindowControlButton key={kind} aria-label="Minimize" onClick={onMinimize}>
              <MinusIcon strokeWidth={2.25} />
            </WindowControlButton>
          )
        }
        if (kind === "maximize") {
          return (
            <WindowControlButton key={kind} aria-label="Maximize" onClick={onZoom}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.2" />
              </svg>
            </WindowControlButton>
          )
        }
        return (
          <WindowControlButton key={kind} aria-label="Close" onClick={onClose}>
            <XIcon strokeWidth={2.25} />
          </WindowControlButton>
        )
      })}
    </div>
  )
}

export type { WindowHandle, WindowInsets, WindowPosition, WindowSize, ResizeEdge as WindowResizeEdge }
export {
  isCloseOnLeft,
  parseWindowButtonLayout,
  useWindowContext,
  WINDOW_CONTROL_CLASS,
  Window,
  WindowContent,
  WindowControlButton,
  WindowControls,
  WindowMain,
  WindowTitle,
  WindowTitlebar,
}
