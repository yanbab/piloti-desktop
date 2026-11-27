import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/core/utils";
import type { SymbolicIconName } from "@/lib/icons/shell-icon-names";
import { getSymbolicIcon, subscribeSymbolicIcons } from "@/lib/icons/symbolic-icons";

/**
 * A symbolic icon from the icon theme, in the text colour; `fallback` when the
 * theme has none. It stays an `<svg>`, so it is sized and spaced like the
 * glyph it replaces.
 */
export function SymbolicIcon({
  name,
  fallback: Fallback,
  className,
  style,
  strokeWidth,
  ...props
}: LucideProps & { name: SymbolicIconName; fallback: LucideIcon }) {
  const snapshot = () => getSymbolicIcon(name);
  const url = React.useSyncExternalStore(subscribeSymbolicIcons, snapshot, snapshot);

  if (url === null) {
    return <Fallback className={className} style={style} strokeWidth={strokeWidth} {...props} />;
  }
  const mask = url && `url("${url}") center / contain no-repeat`;
  return (
    <svg
      aria-hidden={props["aria-label"] ? undefined : true}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      data-slot="symbolic-icon"
      data-symbolic={name}
      // Empty until the icon is in: the same box, so nothing moves.
      className={cn("shrink-0", url && "bg-current", className)}
      style={mask ? { mask, WebkitMask: mask, ...style } : style}
      {...props}
    />
  );
}
