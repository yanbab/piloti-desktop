/// <reference types="@domicile-desktop/react/elements" />
import "./styles/globals.css";
import { mount } from "@domicile-desktop/react/mount";
import { LoginScreenApp } from "./components/apps/LoginScreenApp";
import { ShellErrorBoundary } from "./components/shell/ShellErrorBoundary";
import { DesktopStateProvider } from "./context/DesktopStateContext";

/**
 * Standalone Domicile Wayland Display Manager Greeter shell (`dist/greeter.js`).
 * Intended to be launched by `greetd` via `/usr/bin/piloti-greeter`.
 */
export function Greeter() {
  return (
    <ShellErrorBoundary>
      <DesktopStateProvider>
        <div className="h-screen w-screen overflow-hidden">
          <LoginScreenApp mode="greeter" isCsd={false} />
        </div>
      </DesktopStateProvider>
    </ShellErrorBoundary>
  );
}

export const Shell = mount(Greeter);
