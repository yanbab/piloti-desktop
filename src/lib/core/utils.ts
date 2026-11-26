import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge our Adwaita theme scales so e.g. `text-shell-body`
// (a font size) is not mistaken for a text color and dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "shell-large-title",
        "shell-title-1",
        "shell-title-2",
        "shell-title-3",
        "shell-headline",
        "shell-body",
        "shell-callout",
        "shell-subheadline",
        "shell-footnote",
        "shell-caption",
      ],
      radius: [
        "shell-control",
        "shell-menu",
        "shell-item",
        "shell-group",
        "shell-popover",
        "shell-alert",
        "shell-window",
      ],
      shadow: [
        "shell-menu",
        "shell-popover",
        "shell-tooltip",
        "shell-dock",
        "shell-window",
        "shell-window-inactive",
        "shell-focus",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
