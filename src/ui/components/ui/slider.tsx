"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/core/util/utils"

// A pill-knob slider with a thin capsule track, or a Control Center capsule slider with an embedded icon.
// `size="sm"`: compact, neutral fill (no accent) for toolbars and status bars.
function Slider<Value extends number | readonly number[]>({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  variant = "default",
  size = "default",
  icon,
  ...props
}: SliderPrimitive.Root.Props<Value> & {
  variant?: "default" | "capsule"
  size?: "default" | "sm"
  icon?: React.ReactNode
}) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  const isCapsule = variant === "capsule"
  const isSmall = !isCapsule && size === "sm"
  const rawVal = Number(_values[0] ?? min)
  const span = Math.max(1e-6, max - min)
  const pct = Math.max(0, Math.min(100, ((rawVal - min) / span) * 100))

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      className={cn("data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full", className)}
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          "relative flex w-full touch-none items-center select-none data-disabled:opacity-40 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-4 data-[orientation=vertical]:flex-col",
          isCapsule
            ? "data-[orientation=horizontal]:h-5"
            : isSmall
              ? "data-[orientation=horizontal]:h-3"
              : "data-[orientation=horizontal]:h-4"
        )}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            "relative grow overflow-hidden rounded-full select-none",
            // `isolate`: the icon's blend mode must stay in the track, or Chrome
            // stops the window's vibrant sidebar blurring what is behind it.
            isCapsule
              ? "isolate h-5 w-full bg-black/12 ring-1 ring-inset ring-black/8 dark:bg-white/14 dark:ring-white/10"
              : isSmall
                ? "bg-black/8 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1 dark:bg-white/10"
                : "bg-black/8 data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 dark:bg-white/10"
          )}
        >
          {/* The capsule is drawn from its value alone: base-ui hides an
              edge-aligned slider until it has measured it, and the Control
              Center is built hidden, so Linux showed it empty at start. */}
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            style={
              isCapsule
                ? { width: `calc(${pct}% + ${((100 - pct) / 100) * 20}px)`, visibility: "visible" }
                : undefined
            }
            className={cn(
              "rounded-full select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
              isCapsule
                ? "bg-white/95 shadow-xs"
                : isSmall
                  ? "bg-black/28 dark:bg-white/34"
                  : "bg-ui-accent"
            )}
          />
          {isCapsule && icon && (
            <span className="pointer-events-none absolute inset-y-0 left-1.5 z-10 flex items-center justify-center text-white mix-blend-difference">
              {icon}
            </span>
          )}
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            index={index}
            style={
              isCapsule
                ? { insetInlineStart: `calc(10px + (100% - 20px) * ${pct / 100})`, visibility: "visible" }
                : undefined
            }
            aria-label={props["aria-label"]}
            aria-labelledby={props["aria-labelledby"]}
            className={cn(
              "block shrink-0 rounded-full outline-none select-none data-disabled:pointer-events-none",
              isCapsule
                ? "size-5 bg-white shadow-[0_0_2px_rgba(0,0,0,0.22),0_1px_3px_rgba(0,0,0,0.18)]"
                : isSmall
                  ? "size-3 bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.25)] has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-ui-accent/50 active:bg-[#f2f2f2] dark:bg-[#dedede] dark:shadow-none"
                  : "h-4 w-5 bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_1px_3px_rgb(0_0_0/0.25)] has-focus-visible:outline-3 has-focus-visible:outline-solid has-focus-visible:outline-ui-accent/50 active:bg-[#f2f2f2] dark:bg-[#dedede] dark:shadow-none"
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
