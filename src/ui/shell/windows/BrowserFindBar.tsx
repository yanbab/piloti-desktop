import * as React from "react";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";

const iconButton =
  "flex size-6 items-center justify-center rounded-ui-control text-ui-label-secondary transition-colors hover-fill:bg-black/8 hover-fill:text-ui-label disabled:pointer-events-none disabled:opacity-35 dark:hover-fill:bg-white/10";

/**
 * Find in page (Ctrl+F): floats at the top right of the page, as in Texts.
 * Enter steps to the next match, Shift+Enter to the previous one.
 */
export function BrowserFindBar({
  query,
  onQueryChange,
  matches,
  activeMatch,
  focusToken,
  onStep,
  onClose,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  matches: number;
  activeMatch: number;
  /** Changes each time Ctrl+F is pressed, to focus and select the field again. */
  focusToken: number;
  onStep: (backward: boolean) => void;
  onClose: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusToken]);

  const hasQuery = query.trim() !== "";
  return (
    <div
      role="search"
      data-slot="browser-find-bar"
      className="absolute top-2 right-3 z-20 flex items-center gap-1 rounded-ui-control border border-ui-border bg-ui-group/95 py-1 pr-1 pl-2 shadow-md backdrop-blur-md"
    >
      <SymbolicIcon name="system-search" fallback={SearchIcon} className="size-3.5 text-ui-label-secondary" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        aria-label={_("Find in Page")}
        placeholder={_("Find in Page")}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onStep(e.shiftKey);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="w-40 bg-transparent text-ui-body text-ui-label outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <span
        aria-live="polite"
        className={cn(
          "min-w-12 text-right text-ui-caption tabular-nums",
          hasQuery && matches === 0 ? "text-ui-red" : "text-ui-label-secondary"
        )}
      >
        {hasQuery
          ? matches > 0
            ? _("%d of %d", activeMatch, matches)
            : _("No results")
          : ""}
      </span>
      <button
        type="button"
        aria-label={_("Previous Match")}
        title={_("Previous Match")}
        disabled={matches === 0}
        onClick={() => onStep(true)}
        className={iconButton}
      >
        <SymbolicIcon name="pan-up" fallback={ChevronUpIcon} className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={_("Next Match")}
        title={_("Next Match")}
        disabled={matches === 0}
        onClick={() => onStep(false)}
        className={iconButton}
      >
        <SymbolicIcon name="pan-down" fallback={ChevronDownIcon} className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={_("Close Find")}
        title={_("Close Find")}
        onClick={onClose}
        className={iconButton}
      >
        <SymbolicIcon name="window-close" fallback={XIcon} className="size-3.5" />
      </button>
    </div>
  );
}
