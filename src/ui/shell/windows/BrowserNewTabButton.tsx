import * as React from "react";
import { AppWindowIcon, ChevronDownIcon, FolderIcon, GlobeIcon, PlusIcon, TerminalIcon } from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { useWindowManager } from "@/ui/context/DesktopStateContext";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { APP_MODULES } from "@/core/data/app-modules";
import { APP_CATALOG } from "@/core/data/catalog";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";

/**
 * + opens a web page tab; the chevron lists what else can open in a tab: the
 * app modules (native only). Folders and Terminal join once they are modules.
 */
export function BrowserNewTabButton({ windowId, className }: { windowId: string; className?: string }) {
  const { openBrowserTab, openModuleTab } = useWindowManager();
  const { compositor } = useCapabilities();
  const tabApps = React.useMemo(
    () =>
      APP_MODULES.filter((m) => m.id !== "hello").map((m) => ({
        id: m.id,
        name: APP_CATALOG.find((a) => a.id === m.id || a.builtinComponent === m.id)?.name ?? m.id,
      })),
    []
  );
  return (
    <div data-slot="new-tab-split" data-window-no-drag className={cn("flex shrink-0 items-center", className)}>
      <button
        type="button"
        title={_("New Tab")}
        aria-label={_("New Tab")}
        onClick={() => openBrowserTab(windowId)}
        className="flex size-7 items-center justify-center rounded-l-ui-control transition-colors hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
      >
        <SymbolicIcon name="list-add" fallback={PlusIcon} className="size-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={_("New Tab With…")}
          title={_("New Tab With…")}
          className="flex h-7 w-4 items-center justify-center rounded-r-ui-control outline-none transition-colors hover-fill:bg-black/8 data-[popup-open]:bg-black/12 dark:hover-fill:bg-white/10 dark:data-[popup-open]:bg-white/15"
        >
          <SymbolicIcon name="pan-down" fallback={ChevronDownIcon} className="size-3" strokeWidth={2.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => openBrowserTab(windowId)}>
            <SymbolicIcon name="web-browser" fallback={GlobeIcon} className="size-4" />
            {_("Web Page")}
          </DropdownMenuItem>
          {compositor && tabApps.length > 0 && <DropdownMenuSeparator />}
          {compositor &&
            tabApps.map((app) => (
              <DropdownMenuItem key={app.id} onClick={() => openModuleTab(windowId, app.id)}>
                <SymbolicIcon name="application-x-executable" fallback={AppWindowIcon} className="size-4" />
                {app.name}
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <SymbolicIcon name="folder" fallback={FolderIcon} className="size-4" />
            {_("Folders")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <SymbolicIcon name="utilities-terminal" fallback={TerminalIcon} className="size-4" />
            {_("Terminal")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
