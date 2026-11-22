import * as React from "react";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import type { AppSymbolName } from "@/lib/shell/desktop-icons";
import { cn } from "@/lib/core/utils";

export interface AdwSplitSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  ariaLabel?: string;
  dropPath?: string;
  separatorAfter?: boolean;
  pinnedBottom?: boolean;
  badge?: string | number;
  trailingAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };
}

export interface AdwSplitRenderContext {
  isCompact: boolean;
  contentScrolled: boolean;
  setContentScrolled: (scrolled: boolean) => void;
  onContentScroll: (e: React.UIEvent<HTMLElement>) => void;
}

export interface AdwSplitViewProps {
  /** Window / app metadata for CSD sidebar titlebar controls and menu button */
  title: string;
  appId: string;
  iconName?: AppSymbolName;
  windowId?: string;
  isCsd?: boolean;
  /** Sidebar configuration */
  sidebarItems: readonly AdwSplitSidebarItem[];
  sidebarWidthClass?: string;
  sidebarDensity?: "default" | "tall";
  compactBreakpoint?: number;
  sidebarRef?: React.RefObject<HTMLElement | null>;
  onSidebarKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onSidebarKeyUp?: React.KeyboardEventHandler<HTMLElement>;
  onCompactChange?: (compact: boolean) => void;
  /** Right column header, body, optional right pane (e.g. Info), and footer */
  header?:
    | React.ReactNode
    | ((ctx: AdwSplitRenderContext) => React.ReactNode);
  children:
    | React.ReactNode
    | ((ctx: AdwSplitRenderContext) => React.ReactNode);
  rightPane?: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}

/**
 * Shared Adwaita split-view shell (responsive collapsible `<aside>` sidebar
 * with compact icon tooltips, CSD window controls, optional right header/footer,
 * and optional auxiliary right inspector pane).
 */
export function AdwSplitView({
  title,
  appId,
  iconName,
  windowId,
  isCsd = false,
  sidebarItems,
  sidebarWidthClass = "w-44",
  sidebarDensity = "default",
  compactBreakpoint = 640,
  sidebarRef,
  onSidebarKeyDown,
  onSidebarKeyUp,
  onCompactChange,
  header,
  children,
  rightPane,
  footer,
  contentClassName = "bg-adw-content",
  className,
  onKeyDown,
}: AdwSplitViewProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isCompact, setIsCompact] = React.useState(false);
  const [sidebarScrolled, setSidebarScrolled] = React.useState(false);
  const [contentScrolled, setContentScrolled] = React.useState(false);

  const onCompactChangeRef = React.useRef(onCompactChange);
  onCompactChangeRef.current = onCompactChange;

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const update = () => {
      if (el.clientWidth === 0) return;
      const compact = el.clientWidth < compactBreakpoint;
      setIsCompact(compact);
      onCompactChangeRef.current?.(compact);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [compactBreakpoint]);

  const onContentScroll = React.useCallback((e: React.UIEvent<HTMLElement>) => {
    setContentScrolled(e.currentTarget.scrollTop > 2);
  }, []);

  React.useEffect(() => {
    if (!onKeyDown) return;
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const el = containerRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && el.contains(target)) return;
      const winEl = el.closest('[data-slot="window"]');
      if (winEl && winEl.hasAttribute("data-inactive")) return;
      if (
        document.querySelector(
          '[data-slot="menubar-content"], [data-slot="dropdown-menu-content"], [data-slot="context-menu-content"], [role="dialog"]',
        )
      ) {
        return;
      }
      onKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>);
    };
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [onKeyDown]);

  const renderCtx: AdwSplitRenderContext = {
    isCompact,
    contentScrolled,
    setContentScrolled,
    onContentScroll,
  };

  const tall = sidebarDensity === "tall";

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex h-full w-full overflow-hidden bg-transparent text-adw-label select-none",
        className,
      )}
    >
      {/* Left Sidebar (collapses to compact icon bar; kept as <aside> for Adwaita transparent titlebar styling) */}
      <aside
        ref={sidebarRef}
        data-window-drag-region=""
        onKeyDown={onSidebarKeyDown}
        onKeyUp={onSidebarKeyUp}
        className={cn(
          "flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-adw-separator bg-adw-sidebar",
          isCompact ? "w-[47px]" : sidebarWidthClass,
        )}
      >
        {isCsd && (
          <WindowTitlebar
            data-window-drag-region
            className={cn(
              "bg-transparent transition-colors",
              isCompact && "justify-center px-[9px]",
              sidebarScrolled
                ? "border-b border-adw-separator/70"
                : "border-b border-transparent",
            )}
          >
            <div className="relative flex w-full items-center justify-between gap-1.5">
              <div className="relative z-10 flex shrink-0 items-center gap-1.5" data-window-no-drag>
                {windowId && <WindowControls side="left" />}
                <WindowMenuButton
                  side="left"
                  windowId={windowId}
                  appId={appId}
                  iconName={iconName}
                />
              </div>
              {!isCompact && (
                <span className="pointer-events-none absolute inset-x-10 truncate text-center text-[13.5px] font-medium tracking-tight whitespace-nowrap text-adw-label">
                  {title}
                </span>
              )}
              <div className="relative z-10 flex shrink-0 items-center justify-end" data-window-no-drag>
                <WindowMenuButton
                  side="right"
                  windowId={windowId}
                  appId={appId}
                  iconName={iconName}
                />
              </div>
            </div>
          </WindowTitlebar>
        )}

        <TooltipProvider delay={450}>
          <nav
            onScroll={(e) => setSidebarScrolled(e.currentTarget.scrollTop > 2)}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-0.5 pb-2 px-[9px]",
              isCompact
                ? "overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "overflow-y-auto",
              isCsd ? "pt-0.5" : tall ? "pt-2.5" : "pt-2",
            )}
          >
            {(() => {
              const renderItem = (item: AdwSplitSidebarItem) => {
                const baseBtn = (
                  <button
                    key={item.trailingAction ? undefined : item.id}
                    type="button"
                    aria-label={item.ariaLabel ?? item.label}
                    data-sidebar-item={item.id}
                    data-vfs-drop-path={item.dropPath}
                    onClick={item.onClick}
                    className={cn(
                      "flex items-center rounded-[9px] text-left transition-colors outline-none",
                      isCompact
                        ? "w-full shrink-0 justify-center px-0"
                        : item.trailingAction
                          ? "min-w-0 flex-1 px-1.5 pr-7"
                          : "w-full shrink-0 px-1.5",
                      tall
                        ? isCompact
                          ? "gap-0 py-2 text-[14px]"
                          : "gap-3 py-2 text-[14px]"
                        : isCompact
                          ? "gap-0 py-1.5 text-[13px]"
                          : "gap-2.5 py-1.5 text-[13px]",
                      !item.trailingAction &&
                        (item.selected
                          ? "bg-adw-accent font-medium text-white shadow-xs"
                          : "font-normal text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6"),
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
                        item.selected ? "opacity-100" : "opacity-85",
                      )}
                    >
                      {item.icon}
                    </span>
                    {!isCompact && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && item.badge !== "" && (
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold text-white tabular-nums",
                              item.selected ? "bg-white/25" : "bg-adw-accent",
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );

                const itemNode = item.trailingAction && !isCompact ? (
                  <div
                    className={cn(
                      "relative flex w-full shrink-0 items-center rounded-[9px] transition-colors",
                      item.selected
                        ? "bg-adw-accent font-medium text-white shadow-xs"
                        : "font-normal text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6",
                    )}
                  >
                    {baseBtn}
                    <button
                      type="button"
                      aria-label={item.trailingAction.label}
                      title={item.trailingAction.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.trailingAction?.onClick();
                      }}
                      className="absolute right-1.5 flex size-6 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/10 hover:text-adw-label dark:hover:bg-white/12 [&_svg]:size-3.5"
                    >
                      {item.trailingAction.icon}
                    </button>
                  </div>
                ) : (
                  baseBtn
                );

                const sep = item.separatorAfter ? (
                  <div className="my-1 h-px shrink-0 bg-adw-separator" />
                ) : null;

                if (!isCompact) {
                  return (
                    <React.Fragment key={item.id}>
                      {itemNode}
                      {sep}
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={item.id}>
                    <Tooltip>
                      <TooltipTrigger render={baseBtn} />
                      <TooltipContent
                        side="right"
                        sideOffset={-36}
                        className={cn(
                          "pointer-events-none rounded-[9px] border border-adw-separator px-2.5 shadow-md",
                          tall
                            ? "h-[37px] gap-3 py-2 text-[14px]"
                            : "h-[32px] gap-2.5 py-1.5 text-[13px]",
                          item.selected
                            ? "bg-adw-accent font-medium text-white shadow-xs"
                            : "bg-adw-sidebar font-normal text-adw-label",
                        )}
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center opacity-85 [&_svg]:size-4">
                          {item.icon}
                        </span>
                        <span className="whitespace-nowrap">{item.label}</span>
                      </TooltipContent>
                    </Tooltip>
                    {sep}
                  </React.Fragment>
                );
              };

              const regularItems = sidebarItems.filter((item) => !item.pinnedBottom);
              const bottomItems = sidebarItems.filter((item) => item.pinnedBottom);
              return (
                <>
                  {regularItems.map(renderItem)}
                  {bottomItems.length > 0 && (
                    <div className="mt-auto flex flex-col gap-0.5 border-t border-adw-separator/60 pt-1.5">
                      {bottomItems.map(renderItem)}
                    </div>
                  )}
                </>
              );
            })()}
          </nav>
        </TooltipProvider>
      </aside>

      {/* Right Main Column */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden",
          contentClassName,
        )}
      >
        {typeof header === "function" ? header(renderCtx) : header}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {typeof children === "function" ? children(renderCtx) : children}
          {rightPane}
        </div>
        {footer}
      </div>
    </div>
  );
}

