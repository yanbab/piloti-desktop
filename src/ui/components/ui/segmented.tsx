import * as React from "react";

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
      className="ui-segmented"
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
          className="ui-segmented-item"
        >
          {opt.icon}
          {!iconOnly && opt.label}
          {opt.badge !== undefined && (
            <span className="ui-segmented-badge">
              {opt.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
