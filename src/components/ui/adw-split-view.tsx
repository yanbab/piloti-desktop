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
import { PanelResizeHandle, usePanelWidth } from "@/components/ui/resizable-panel";
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
  /** Makes the sidebar resizable (width remembered under this id). */
  sidebarId?: string;
  sidebarDefaultWidth?: number;
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
  sidebarId,
  sidebarDefaultWidth = 176,
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
  const panel = usePanelWidth({
    id: sidebarId ?? "unused-sidebar",
    side: "right",
    defaultWidth: sidebarDefaultWidth,
    min: 136,
    max: 320,
    collapseBelow: 104,
    collapsedWidth: 47,
  });
  const resizable = Boolean(sidebarId);
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
  const showCompact = isCompact || (resizable && panel.collapsed);

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
          resizable ? undefined : isCompact ? "w-[47px]" : sidebarWidthClass,
          resizable && !panel.dragging && "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={
          resizable ? { width: showCompact ? 47 : panel.width } : undefined
        }
      >
        {isCsd && (
          <WindowTitlebar
            data-window-drag-region
            className={cn(
              "bg-transparent transition-colors",
              showCompact && "justify-center px-[9px]",
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
              {!showCompact && (
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
              "flex min-h-0 flex-1 flex-col gap-0 pb-2 px-2.5",
              showCompact
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
                      // macOS sidebar metrics: 28px rows, 6px radius, 8px icon gap.
                      "flex h-7 items-center rounded-[6px] text-left text-[13px] transition-colors outline-none",
                      showCompact
                        ? "w-full shrink-0 justify-center gap-0 px-0"
                        : item.trailingAction
                          ? "min-w-0 flex-1 gap-2 px-2 pr-7"
                          : "w-full shrink-0 gap-2 px-2",
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
                    {!showCompact && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && item.badge !== "" && (
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-full text-[10px] leading-none font-semibold tabular-nums",
                              item.selected
                                ? "px-0.5 text-white/90"
                                : "bg-black/8 px-1.5 py-0.5 text-adw-label/60 dark:bg-white/10",
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );

                const itemNode = item.trailingAction && !showCompact ? (
                  <div
                    className={cn(
                      "relative flex w-full shrink-0 items-center rounded-[6px] transition-colors",
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

                if (!showCompact) {
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
                          "pointer-events-none h-7 gap-2 rounded-[6px] border border-adw-separator px-2 text-[13px] shadow-md",
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
                    <div className="mt-auto flex flex-col gap-0 border-t border-adw-separator/60 pt-1.5">
                      {bottomItems.map(renderItem)}
                    </div>
                  )}
                </>
              );
            })()}
          </nav>
        </TooltipProvider>
      </aside>
      {resizable && !isCompact && (
        <PanelResizeHandle
          side="right"
          dragging={panel.dragging}
          handleProps={panel.handleProps}
          label="Resize sidebar"
          style={{ left: panel.width - 4 }}
        />
      )}

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

