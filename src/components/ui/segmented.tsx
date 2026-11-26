import * as React from "react";
import { cn } from "@/lib/core/utils";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  /** A count shown after the label. */
  badge?: string | number;
}

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  iconOnly = false,
  disabled = false,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (id: T) => void;
  /** Show icons only; labels become tooltips and accessible names. */
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      data-slot="segmented"
      className="inline-flex items-center gap-1 rounded-ui-item bg-black/8 p-1 dark:bg-white/8"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          data-slot="segmented-item"
          aria-pressed={value === opt.id}
          aria-label={iconOnly ? opt.label : undefined}
          title={iconOnly ? opt.label : undefined}
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-ui-control px-2.5 py-1 text-ui-callout font-medium transition-colors disabled:opacity-60",
            value === opt.id
              ? "bg-ui-window text-ui-label shadow-xs dark:bg-white/16"
              : "text-ui-label-secondary hover-fill:bg-black/5 dark:hover-fill:bg-white/6",
          )}
        >
          {opt.icon}
          {!iconOnly && opt.label}
          {opt.badge !== undefined && (
            <span className="rounded-full bg-ui-red px-1.5 text-ui-caption font-bold text-white">
              {opt.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
