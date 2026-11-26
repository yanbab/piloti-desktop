import * as React from "react";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  parseWindowButtonLayout,
  useWindowContext,
  WindowControls,
  WindowTitlebar,
} from "@/components/ui/window";
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
  /** The sidebar shows icons only: its header has no room for window buttons. */
  sidebarCompact: boolean;
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
/**
 * Lines the page title in the header (`data-slot="page-title"`) up with the
 * row titles of the content below, in every theme and at any width (the
 * Adwaita form is centred, the Piloti one is not). Re-measured on resize,
 * page changes and theme changes.
 */
function usePageTitleAlignment(containerRef: React.RefObject<HTMLDivElement | null>) {
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    let passes = 0;
    const align = () => {
      frame = 0;
      const title = container.querySelector<HTMLElement>(PAGE_TITLE_SELECTOR);
      if (!title) return;
      // Where row content starts: the first visible row's padding box edge.
      const row = Array.from(
        container.querySelectorAll<HTMLElement>('[data-slot="grouped-form-row"]'),
      ).find((el) => el.getBoundingClientRect().width > 0);
      const target = row
        ? {
            left:
              row.getBoundingClientRect().left +
              (Number.parseFloat(getComputedStyle(row).paddingLeft) || 0),
          }
        : null;
      if (!target) {
        title.style.paddingLeft = "";
        passes = 0;
        return;
      }
      // Compare the title *text* with the row title and correct the padding
      // by the difference; the header may move the title box too, so repeat
      // until it settles.
      const range = document.createRange();
      range.selectNodeContents(title);
      const textLeft = range.getBoundingClientRect().left;
      const delta = target.left - textLeft;
      if (Math.abs(delta) < 0.5) {
        passes = 0;
        return;
      }
      const current = Number.parseFloat(getComputedStyle(title).paddingLeft) || 0;
      title.style.paddingLeft = `${Math.max(0, Math.round(current + delta))}px`;
      if (++passes < 4) schedule();
      else passes = 0;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(align);
    };
    align();
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    const content = new MutationObserver(schedule);
    content.observe(container, { childList: true, subtree: true });
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-interface-theme", "class", "style"],
    });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      content.disconnect();
      theme.disconnect();
    };
  }, [containerRef]);
}

const PAGE_TITLE_SELECTOR = '[data-slot="page-title"]';

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
  contentClassName = "bg-ui-window",
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

  usePageTitleAlignment(containerRef);

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

  const showCompact = isCompact || (resizable && panel.collapsed);
  const buttonLayout = useWindowContext()?.buttonLayout;
  // Two or more buttons on the left leave a narrow sidebar no room for a title.
  const crowdedTitle =
    parseWindowButtonLayout(buttonLayout).left.length > 1 &&
    (resizable ? panel.width : sidebarDefaultWidth) < 220;

  const renderCtx: AdwSplitRenderContext = {
    isCompact,
    sidebarCompact: showCompact,
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
        "relative flex h-full w-full overflow-hidden bg-transparent text-ui-label select-none",
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
          // bg-ui-sidebar also marks sidebars for window and theme rules.
          "ui-sidebar bg-ui-sidebar",
          resizable ? undefined : isCompact ? "w-[47px]" : sidebarWidthClass,
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
                ? "border-b border-ui-separator/70"
                : "border-b border-transparent",
            )}
          >
            {/* Collapsed, the content's header draws the window buttons. The
                menu button stays here, in the same place in the tree, so it
                isn't remounted (and its icon reloaded). */}
            <div className={cn("relative flex items-center justify-between gap-1.5", !showCompact && "w-full")}>
              <div className="relative z-10 flex shrink-0 items-center gap-1.5" data-window-no-drag>
                {!showCompact && windowId && <WindowControls side="left" />}
                <WindowMenuButton
                  side="left"
                  windowId={windowId}
                  appId={appId}
                  iconName={iconName}
                />
              </div>
              {!showCompact && !crowdedTitle && (
                <span className="pointer-events-none absolute inset-x-10 truncate text-center text-ui-body font-medium tracking-tight whitespace-nowrap text-ui-label">
                  {title}
                </span>
              )}
            </div>
          </WindowTitlebar>
        )}

        <TooltipProvider delay={450}>
          <nav
            data-slot="sidebar-nav"
            onScroll={(e) => setSidebarScrolled(e.currentTarget.scrollTop > 2)}
            className={cn(
              "ui-sidebar-nav",
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
                    data-slot="sidebar-item"
                    data-selected={item.selected ? "" : undefined}
                    data-compact={showCompact ? "" : undefined}
                    data-tall={tall ? "" : undefined}
                    data-trailing={item.trailingAction ? "" : undefined}
                    data-vfs-drop-path={item.dropPath}
                    onClick={item.onClick}
                    className="ui-sidebar-item"
                  >
                    <span className="ui-sidebar-icon">
                      {item.icon}
                    </span>
                    {!showCompact && (
                      <>
                        <span className="ui-sidebar-label">{item.label}</span>
                        {item.badge !== undefined && item.badge !== "" && (
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-full text-ui-caption leading-none font-semibold tabular-nums",
                              item.selected
                                ? "px-0.5 text-white/90"
                                : "bg-black/8 px-1.5 py-0.5 text-ui-label/60 dark:bg-white/10",
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
                    data-slot="sidebar-item-group"
                    data-selected={item.selected ? "" : undefined}
                    className="ui-sidebar-item-group"
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
                      className="absolute right-1.5 flex size-6 items-center justify-center rounded-ui-control text-ui-label-secondary transition-colors hover-fill:bg-black/10 hover-fill:text-ui-label dark:hover-fill:bg-white/12 [&_svg]:size-3.5"
                    >
                      {item.trailingAction.icon}
                    </button>
                  </div>
                ) : (
                  baseBtn
                );

                const sep = item.separatorAfter ? (
                  <div className="my-1 h-px shrink-0 bg-ui-separator" />
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
                          "pointer-events-none rounded-ui-control border border-ui-separator px-2.5 shadow-md",
                          tall
                            ? "h-[37px] gap-3 py-2 text-ui-body"
                            : "h-[32px] gap-2.5 py-1.5 text-ui-body",
                          item.selected
                            ? "bg-ui-accent font-medium text-white shadow-xs"
                            : "bg-ui-sidebar font-normal text-ui-label",
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
                    <div className="mt-auto flex flex-col gap-0.5 border-t border-ui-separator/60 pt-1.5">
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

