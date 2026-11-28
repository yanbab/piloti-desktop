import type * as React from "react";

/** A one-line notice across a window, under its header. */
export function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="shrink-0 border-b border-ui-separator bg-ui-group px-3 py-1.5 text-center text-ui-small text-ui-label-secondary"
    >
      {children}
    </div>
  );
}
