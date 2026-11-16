/// <reference types="@domicile-desktop/react/elements" />
import "./src/styles/globals.css";
import { mount } from "@domicile-desktop/react/mount";
import { Desktop as DesktopView } from "./src/components/shell/Desktop";
import { ShellErrorBoundary } from "./src/components/shell/ShellErrorBoundary";

export function Desktop() {
  return (
    <ShellErrorBoundary>
      <DesktopView />
    </ShellErrorBoundary>
  );
}

export const Shell = mount(Desktop);
