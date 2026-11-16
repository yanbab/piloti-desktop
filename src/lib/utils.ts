import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge our Adwaita theme scales so e.g. `text-adw-body`
// (a font size) is not mistaken for a text color and dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "adw-large-title",
        "adw-title-1",
        "adw-title-2",
        "adw-title-3",
        "adw-headline",
        "adw-body",
        "adw-callout",
        "adw-subheadline",
        "adw-footnote",
        "adw-caption",
      ],
      radius: [
        "adw-control",
        "adw-menu",
        "adw-item",
        "adw-group",
        "adw-popover",
        "adw-alert",
        "adw-window",
      ],
      shadow: [
        "adw-menu",
        "adw-popover",
        "adw-tooltip",
        "adw-dock",
        "adw-window",
        "adw-window-inactive",
        "adw-focus",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
