import { mount } from "@domicile-desktop/react/mount";
import { LoginScreenApp } from "./apps/login/LoginScreenApp";
import { ShellErrorBoundary } from "./shell/desktop/ShellErrorBoundary";
import { DesktopStateProvider } from "./context/DesktopStateContext";

export function Greeter() {
  return (
    <ShellErrorBoundary>
      <DesktopStateProvider greeterMode>
        <div className="h-screen w-screen overflow-hidden">
          <LoginScreenApp mode="greeter" />
        </div>
      </DesktopStateProvider>
    </ShellErrorBoundary>
  );
}

export const mountGreeter = mount(Greeter);
