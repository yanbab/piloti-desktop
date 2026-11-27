import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ListFilterIcon } from "lucide-react";
import { SearchIcon } from "@/components/ui/symbols";

import { cn } from "@/lib/core/utils"

// A search entry field with a magnifying glass icon.
// `default` sits in content, `glass` matches toolbar capsules and `filled`
// is the sidebar search field of System Settings. FilterField has the same
// styles with a filter symbol, for narrowing a list in place.
const searchFieldVariants = cva(
  "group/search-field relative flex min-w-0 shrink-0 items-center gap-0.5 rounded-full text-ui-body text-ui-label has-[input:focus-visible]:ui-focus-ring has-[input:disabled]:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-ui-field shadow-[0_0_0_1px_var(--ui-field-border)]",
        glass: "ui-glass",
        filled:
          "bg-ui-fill-primary shadow-[0_0_0_1px_rgb(0_0_0/0.04)] dark:bg-white/13 dark:shadow-[0_0_0_1px_rgb(0_0_0/0.5)]",
      },
      size: {
        sm: "h-5 pl-1.5 text-ui-small [&_[data-slot=search-field-icon]]:size-3",
        default: "h-6 pl-2 [&_[data-slot=search-field-icon]]:size-3.5",
        lg: "h-7 pl-[9px] [&_[data-slot=search-field-icon]]:size-[15px]",
        xl: "h-9 pl-3 [&_[data-slot=search-field-icon]]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type SearchFieldProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof searchFieldVariants>

function Field({
  className,
  variant = "default",
  size = "default",
  icon: Icon,
  onKeyDown,
  ...props
}: SearchFieldProps & { icon: typeof SearchIcon }) {
  return (
    <div
      data-slot="search-field"
      data-size={size}
      className={cn(searchFieldVariants({ variant, size }), className)}
    >
      <Icon
        data-slot="search-field-icon"
        aria-hidden="true"
        className="pointer-events-none shrink-0 text-ui-label-secondary"
        strokeWidth={2.25}
      />
      <input
        type="search"
        data-slot="search-field-input"
        onKeyDown={(e) => {
          if (e.key === "Escape" && e.currentTarget.value.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            const setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value"
            )?.set;
            setter?.call(e.currentTarget, "");
            e.currentTarget.dispatchEvent(new Event("input", { bubbles: true }));
            return;
          }
          onKeyDown?.(e);
        }}
        className="h-full w-full min-w-0 bg-transparent pr-2 pl-1 text-[1em] font-medium text-ui-label outline-none placeholder:text-ui-label-secondary dark:placeholder:text-white/50 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
    </div>
  )
}

function SearchField({ placeholder = "Search", ...props }: SearchFieldProps) {
  return <Field icon={SearchIcon} placeholder={placeholder} {...props} />
}

// Narrows what a list shows as you type, like the field under Xcode's
// navigator or Mail's mailbox list.
function FilterField({ placeholder = "Filter", ...props }: SearchFieldProps) {
  return <Field icon={ListFilterIcon} placeholder={placeholder} {...props} />
}

export { FilterField, SearchField, searchFieldVariants }
