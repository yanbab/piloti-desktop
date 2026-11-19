import * as React from "react";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import type { AppSymbolName } from "@/lib/desktop-icons";
import { cn } from "@/lib/utils";

export interface AdwSplitSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  ariaLabel?: string;
  dropPath?: string;
  separatorAfter?: boolean;
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
  const [sidebarReady, setSidebarReady] = React.useState(false);
  const [sidebarScrolled, setSidebarScrolled] = React.useState(false);
  const [contentScrolled, setContentScrolled] = React.useState(false);

  const onCompactChangeRef = React.useRef(onCompactChange);
  onCompactChangeRef.current = onCompactChange;

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setSidebarReady(true);
      return;
    }
    const update = () => {
      const compact = el.clientWidth < compactBreakpoint;
      setIsCompact(compact);
      onCompactChangeRef.current?.(compact);
    };
    update();
    setSidebarReady(true);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compactBreakpoint]);

  const onContentScroll = React.useCallback((e: React.UIEvent<HTMLElement>) => {
    setContentScrolled(e.currentTarget.scrollTop > 2);
  }, []);

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
        onKeyDown={onSidebarKeyDown}
        onKeyUp={onSidebarKeyUp}
        className={cn(
          "flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-adw-separator bg-adw-sidebar",
          sidebarReady && "transition-[width] duration-150",
          isCompact ? "w-[52px]" : sidebarWidthClass,
        )}
      >
        {isCsd && (
          <WindowTitlebar
            data-window-drag-region
            className={cn(
              "bg-transparent transition-colors",
              sidebarScrolled
                ? "border-b border-adw-separator/70"
                : "border-b border-transparent",
            )}
          >
            <div className="flex items-center gap-1.5" data-window-no-drag>
              {windowId && <WindowControls side="left" />}
              <WindowMenuButton
                windowId={windowId}
                appId={appId}
                iconName={iconName}
              />
            </div>
            {!isCompact && (
              <span className="truncate text-[14px] font-bold tracking-tight whitespace-nowrap text-adw-label">
                {title}
              </span>
            )}
            <div className="w-7" />
          </WindowTitlebar>
        )}

        <TooltipProvider delay={450}>
          <nav
            onScroll={(e) => setSidebarScrolled(e.currentTarget.scrollTop > 2)}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2",
              isCsd ? "pt-0.5" : tall ? "pt-2.5" : "pt-2",
            )}
          >
            {sidebarItems.map((item) => {
              const btn = (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.ariaLabel ?? item.label}
                  data-sidebar-item={item.id}
                  data-vfs-drop-path={item.dropPath}
                  onClick={item.onClick}
                  className={cn(
                    "flex w-full shrink-0 items-center rounded-[9px] px-2.5 text-left transition-colors outline-none",
                    tall
                      ? "gap-3 py-2 text-[14px]"
                      : "gap-2.5 py-1.5 text-[13px]",
                    item.selected
                      ? "bg-adw-sidebar-selection font-medium text-adw-label"
                      : "font-normal text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6",
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center opacity-85 [&_svg]:size-4">
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      "truncate transition-opacity duration-150",
                      isCompact ? "opacity-0" : "opacity-100",
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );

              const sep = item.separatorAfter ? (
                <div className="my-1 h-px shrink-0 bg-adw-separator" />
              ) : null;

              if (!isCompact) {
                return (
                  <React.Fragment key={item.id}>
                    {btn}
                    {sep}
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={item.id}>
                  <Tooltip>
                    <TooltipTrigger render={btn} />
                    <TooltipContent
                      side="right"
                      sideOffset={-36}
                      className={cn(
                        "pointer-events-none rounded-[9px] border border-adw-separator px-2.5 shadow-md",
                        tall
                          ? "h-[37px] gap-3 py-2 text-[14px]"
                          : "h-[32px] gap-2.5 py-1.5 text-[13px]",
                        item.selected
                          ? "bg-adw-sidebar-selection font-medium text-adw-label"
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
            })}
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

