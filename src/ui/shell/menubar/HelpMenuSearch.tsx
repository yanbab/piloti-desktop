import * as React from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SEPARATOR_CLASS, MENU_SHORTCUT_CLASS } from "@/ui/components/ui/menu-styles";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import { type MenuCommand, searchMenuCommands } from "@/ui/shell/menubar/menu-commands";
import { formatMenuShortcut } from "@/core/windows/menu-shortcuts";

/**
 * macOS-style Help menu search: a field at the top of Help that lists matching
 * menu commands (with their menu path and shortcut) and runs the chosen one.
 * Keys typed in the field never reach the menu's typeahead / roving focus.
 */
export function HelpMenuSearch({
  commands,
  model,
  inputRef,
  onRun,
}: {
  commands: readonly MenuCommand[];
  model: "mac" | "pc";
  inputRef: React.RefObject<HTMLInputElement | null>;
  onRun: (command: MenuCommand) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const results = React.useMemo(() => searchMenuCommands(commands, query), [commands, query]);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const run = (command: MenuCommand | undefined) => {
    if (!command || command.disabled) return;
    onRun(command);
  };

  return (
    <div
      className="flex flex-col"
      onPointerMove={(e) => e.stopPropagation()}
    >
      <label className="mx-[2px] mb-1 flex h-[30px] items-center gap-2 rounded-[8px] bg-black/6 px-2.5 dark:bg-white/10">
        <SymbolicIcon name="system-search" fallback={SearchIcon} className="size-3.5 shrink-0 text-ui-label-secondary" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          spellCheck={false}
          autoComplete="off"
          aria-label={_("Search commands")}
          placeholder={_("Search commands")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              e.stopPropagation();
              setQuery("");
              return;
            }
            if (e.key === "Escape" || e.key === "Tab") return; // let the menu close / move on
            e.stopPropagation();
            if (e.key === "ArrowDown" && results.length > 0) {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length > 0) {
              e.preventDefault();
              setActiveIndex((i) => (i - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(results[activeIndex]);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-ui-body text-ui-label outline-none placeholder:text-ui-label-tertiary"
        />
      </label>
      {query.trim() && (
        <div ref={listRef} role="listbox" aria-label={_("Menu Items")} className="max-h-[min(60vh,420px)] overflow-y-auto">
          <div className={MENU_LABEL_CLASS}>{_("Menu Items")}</div>
          {results.length === 0 ? (
            <div className="px-[12px] py-1.5 text-ui-body text-ui-label-tertiary">
              {_("No matching commands")}
            </div>
          ) : (
            results.map((command, index) => (
              <div
                key={command.id}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={command.disabled || undefined}
                data-index={index}
                data-highlighted={index === activeIndex ? "" : undefined}
                data-disabled={command.disabled ? "" : undefined}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => run(command)}
                className={cn(MENU_ITEM_CLASS, "pl-[30px]")}
              >
                {command.checked && (
                  <SymbolicIcon name="object-select" fallback={CheckIcon} className="absolute left-[9px] size-3.5" />
                )}
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate">{command.label}</span>
                  {command.path.length > 0 && (
                    <span className="truncate text-ui-small text-ui-label-secondary">
                      {command.path.join(" ▸ ")}
                    </span>
                  )}
                </span>
                {command.shortcut && (
                  <span className={MENU_SHORTCUT_CLASS}>
                    {formatMenuShortcut(command.shortcut, model)}
                  </span>
                )}
              </div>
            ))
          )}
          <div className={MENU_SEPARATOR_CLASS} />
        </div>
      )}
    </div>
  );
}
