/// <reference types="@domicile-desktop/react/elements" />
import { mount } from "@domicile-desktop/react/mount";
import { Desktop as DesktopView } from "./components/shell/Desktop";
import { ShellErrorBoundary } from "./components/shell/ShellErrorBoundary";

/** The desktop, on whichever engine's `domicile` the entry point mounts it with. */
export function Desktop() {
  return (
    <ShellErrorBoundary>
      <DesktopView />
    </ShellErrorBoundary>
  );
}

export const Shell = mount(Desktop);
