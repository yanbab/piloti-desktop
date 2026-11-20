import type * as React from "react";

export function isWindowControlsLeft(layout?: string): boolean {
  const raw = (layout ?? ":close").trim();
  return raw.indexOf(":") > 0 && !raw.startsWith(":");
}

export function WindowMenuButton(_props: {
  windowId?: string;
  side?: "left" | "right";
  appId?: string;
  iconUrl?: string;
  iconName?: string;
  gradient?: string;
  isWebApp?: boolean;
  extraItems?: React.ReactNode;
}) {
  return null;
}
