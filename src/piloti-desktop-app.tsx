/// <reference types="@domicile-desktop/react/elements" />
import { mount } from "@domicile-desktop/react/mount";
import { Desktop as DesktopView } from "./ui/shell/desktop/Desktop";
import { ShellErrorBoundary } from "./ui/shell/desktop/ShellErrorBoundary";
import { PilotiQueryProvider } from "./platform/shared/query-client";

/** The desktop, on whichever engine's `domicile` the entry point mounts it with. */
export function Desktop() {
  return (
    <ShellErrorBoundary>
      <PilotiQueryProvider>
        <DesktopView />
      </PilotiQueryProvider>
    </ShellErrorBoundary>
  );
}

export const Shell = mount(Desktop);
