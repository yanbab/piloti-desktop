import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge our Adwaita theme scales so e.g. `text-ui-body`
// (a font size) is not mistaken for a text color and dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "ui-large-title",
        "ui-title-1",
        "ui-title-2",
        "ui-title-3",
        "ui-headline",
        "ui-body",
        "ui-callout",
        "ui-subheadline",
        "ui-footnote",
        "ui-caption",
      ],
      radius: [
        "ui-control",
        "ui-menu",
        "ui-item",
        "ui-group",
        "ui-popover",
        "ui-alert",
        "ui-window",
      ],
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
