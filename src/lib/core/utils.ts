import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge our theme scales so e.g. `text-ui-body` (a font size)
// is not mistaken for a text color and dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["ui-title", "ui-body", "ui-small", "ui-caption"],
      radius: ["ui-control", "ui-box", "ui-window"],
      shadow: [
        "ui-menu",
        "ui-popover",
        "ui-tooltip",
        "ui-dock",
        "ui-window",
        "ui-window-inactive",
        "ui-focus",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
