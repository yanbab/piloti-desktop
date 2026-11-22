import * as React from "react";
import { cn } from "@/lib/core/utils";

/**
 * Returns the remaining suffix of `completion` after matching `value` as a
 * case-insensitive prefix, or `null` when no inline completion applies.
 */
export function resolveInlineCompletionSuffix(
  value: string,
  completion?: string
): string | null {
  if (!value || !completion) return null;
  if (completion.length <= value.length) return null;
  if (!completion.toLowerCase().startsWith(value.toLowerCase())) return null;
  return completion.slice(value.length);
}

export interface InlineCompletionInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> {
  value: string;
  completion?: string;
  completionHint?: string;
  ghostClassName?: string;
  onAcceptCompletion?: (completed: string) => void;
  renderInput?: (
    inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
      ref: React.Ref<HTMLInputElement>;
    }
  ) => React.ReactNode;
}

/**
 * Spotlight-style inline completion input: renders the completion text behind
 * the input using the same typography, with the already-typed prefix
 * transparent and the remaining suffix highlighted in the accent selection color.
 */
export const InlineCompletionInput = React.forwardRef<
  HTMLInputElement,
  InlineCompletionInputProps
>(function InlineCompletionInput(
  {
    value,
    completion,
    completionHint,
    ghostClassName,
    onAcceptCompletion,
    renderInput,
    className,
    onKeyDown,
    onScroll,
    ...props
  },
  forwardedRef
) {
  const innerInputRef = React.useRef<HTMLInputElement | null>(null);
  const ghostRef = React.useRef<HTMLDivElement | null>(null);

  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      innerInputRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  const suffix = resolveInlineCompletionSuffix(value, completion);

  const syncScroll = React.useCallback((el: HTMLInputElement | null) => {
    if (el && ghostRef.current) {
      ghostRef.current.scrollLeft = el.scrollLeft;
    }
  }, []);

  React.useLayoutEffect(() => {
    syncScroll(innerInputRef.current);
  }, [value, suffix, syncScroll]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suffix && completion && onAcceptCompletion) {
      const el = e.currentTarget;
      const atEnd =
        el.selectionStart === value.length && el.selectionEnd === value.length;
      if (e.key === "Tab" || (e.key === "ArrowRight" && atEnd)) {
        e.preventDefault();
        onAcceptCompletion(completion);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    syncScroll(e.currentTarget);
    onScroll?.(e);
  };

  const sharedTypographyClass = cn(
    "w-full border-0 bg-transparent p-0 font-sans text-[17px] leading-[1.4] tracking-normal",
    className
  );

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
    ref: React.Ref<HTMLInputElement>;
  } = {
    ...props,
    ref: setInputRef,
    value,
    onKeyDown: handleKeyDown,
    onScroll: handleScroll,
    className: cn(
      "relative z-10 text-adw-label outline-hidden placeholder:text-adw-label-tertiary disabled:cursor-not-allowed disabled:opacity-50",
      sharedTypographyClass
    ),
  };

  return (
    <div className="relative flex h-full min-w-0 flex-1 items-center overflow-hidden">
      <div
        ref={ghostRef}
        aria-hidden="true"
        className={cn(
          sharedTypographyClass,
          "pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden whitespace-pre select-none"
        )}
      >
        <span className="text-transparent">{value}</span>
        {suffix && (
          <span className={cn("text-adw-label-tertiary", ghostClassName)}>
            <span>{suffix}</span>
            {completionHint && (
              <span className="ml-1 text-[0.78em] opacity-80">
                {completionHint}
              </span>
            )}
          </span>
        )}
      </div>
      {renderInput ? renderInput(inputProps) : <input {...inputProps} />}
    </div>
  );
});

