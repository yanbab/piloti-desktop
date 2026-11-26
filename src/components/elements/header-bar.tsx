import * as React from "react";
import { HeaderEdgesContext, useAppChrome } from "@/components/elements/app-chrome";
import { HeaderOutlet, HeaderPortal } from "@/components/elements/header-portal";
import { Button } from "@/components/ui/button";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { cn } from "@/lib/core/utils";

type SlotProps = { children?: React.ReactNode };

// The slots only mark their content; HeaderBar places it.
function Start(_props: SlotProps) {
  return null;
}
function Title(
  _props: SlotProps & {
    /** Does something (rename, address): kept under a server-side titlebar. */
    interactive?: boolean;
  },
) {
  return null;
}
function End(_props: SlotProps & { className?: string }) {
  return null;
}

function findSlot<P>(children: React.ReactNode, slot: React.ComponentType<P>) {
  return React.Children.toArray(children).find(
    (child): child is React.ReactElement<P> =>
      React.isValidElement(child) && child.type === slot,
  );
}

/**
 * An app's header bar: window controls (on the side the button layout says),
 * window menu (on the other side), `Start`, a centred `Title`, `End`. Give it only
 * `HeaderBar.Start`, `.Title` and `.End` as direct children.
 */
function HeaderBarRoot({
  children,
  className,
  style,
  onClose,
  ...props
}: React.ComponentProps<"div"> & {
  /** Replaces closing the window, e.g. to ask about unsaved changes first. */
  onClose?: () => void;
}) {
  const { decorations, menu, insets } = useAppChrome();
  const edges = React.useContext(HeaderEdgesContext);
  const inset = edges === "inset";
  const atStart = inset || edges === "both" || edges === "start";
  const atEnd = inset || edges === "both" || edges === "end";
  const client = decorations === "client";
  const server = decorations === "server";

  const start = findSlot(children, Start)?.props.children;
  const endSlot = findSlot(children, End);
  const end = endSlot?.props.children;
  const titleSlot = findSlot(children, Title);
  const title =
    server && !titleSlot?.props.interactive ? null : titleSlot?.props.children;
  // A centred title needs the same room on both sides, whichever has controls.
  const titleInset =
    title && insets && atStart && atEnd ? Math.max(insets.left, insets.right) : undefined;

  // Under the shell's own titlebar an empty toolbar would be a blank strip.
  if (server && !start && !title && !end) return null;

  return (
    <WindowTitlebar
      data-window-drag-region={client ? "" : undefined}
      data-decorations={decorations}
      className={cn(
        "border-b border-ui-separator bg-ui-window",
        title && "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
        server && "rounded-t-none",
        (!atStart || inset) && "rounded-tl-none",
        !atEnd && "rounded-tr-none",
        className,
      )}
      style={
        decorations === "host" && insets
          ? {
              paddingLeft: titleInset ?? (atStart ? insets.left : undefined),
              paddingRight: titleInset ?? (atEnd ? insets.right : undefined),
              ...style,
            }
          : style
      }
      {...props}
    >
      <div
        data-slot="header-bar-start"
        className="flex min-w-0 items-center gap-1.5"
        data-window-no-drag
      >
        {client && atStart && <WindowControls side="left" onClose={onClose} />}
        {/* Collapsed to icons, the sidebar keeps the left menu button. */}
        {atStart && !inset && menu?.("left")}
        {start}
      </div>
      {title ? (
        <div
          data-slot="window-title"
          className="flex min-w-0 items-center justify-center text-ui-body font-bold group-data-[inactive]/window:text-ui-label-tertiary"
        >
          {typeof title === "string" ? <span className="truncate">{title}</span> : title}
        </div>
      ) : null}
      <div
        data-slot="header-bar-end"
        className={cn(
          "flex items-center justify-end gap-1.5",
          // Without a title the start gives way, not the controls.
          title ? "min-w-0" : "shrink-0",
          endSlot?.props.className,
        )}
        data-window-no-drag
      >
        {end}
        {atEnd && menu?.("right")}
        {client && atEnd && <WindowControls side="right" onClose={onClose} />}
      </div>
    </WindowTitlebar>
  );
}

export const HeaderBar = Object.assign(HeaderBarRoot, {
  Start,
  Title,
  End,
  Outlet: HeaderOutlet,
  Portal: HeaderPortal,
});

/** A page or section name at the start of a header bar. */
export function HeaderHeading({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="page-title"
      className={cn("truncate pr-2 text-ui-body font-bold", className)}
      {...props}
    />
  );
}

/** An icon button in a header bar. `label` is its tooltip and accessible name. */
export function HeaderButton({
  icon: Icon,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children" | "size"> & {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      data-header-button=""
      aria-label={label}
      title={label}
      className={cn(
        "size-7 hover-fill:bg-black/8 data-popup-open:bg-black/10 dark:hover-fill:bg-white/10 dark:data-popup-open:bg-white/15",
        className,
      )}
      {...props}
    >
      <Icon className="size-4" />
    </Button>
  );
}
