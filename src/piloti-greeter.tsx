/// <reference types="@domicile-desktop/react/elements" />
import { loadAppCatalog } from "./lib/engine/app-catalog";
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
      <DesktopStateProvider greeterMode>
        <div className="h-screen w-screen overflow-hidden">
          <LoginScreenApp mode="greeter" isCsd={false} />
        </div>
      </DesktopStateProvider>
    </ShellErrorBoundary>
  );
}

const mountGreeter = mount(Greeter);

export const Shell: typeof mountGreeter = (root, domicile) => {
  // The greeter is a shell (never an app module): its host has all file calls.
  void loadAppCatalog(domicile as Parameters<typeof loadAppCatalog>[0]).finally(() =>
    mountGreeter(root, domicile)
  );
};
