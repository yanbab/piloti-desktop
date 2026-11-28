"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "@/ui/components/ui/symbols";
import { cn } from "@/core/util/utils";

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={
        typeof className === "function"
          ? (state) => cn("ui-checkbox", className(state))
          : cn("ui-checkbox", className)
      }
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="ui-checkbox-indicator"
      >
        <CheckIcon strokeWidth={2.75} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

