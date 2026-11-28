import { AppContent, AppWindow } from "@/ui/components/elements/app-window";
import { HeaderBar } from "@/ui/components/elements/header-bar";
import { _ } from "@/core/util/i18n";

/** The smallest app built from `components/elements`: start new apps from it. */
export function HelloWorldApp() {
  return (
    <AppWindow>
      <HeaderBar>
        <HeaderBar.Title>{_("Hello World")}</HeaderBar.Title>
      </HeaderBar>
      <AppContent padded>{_("Hello world")}</AppContent>
    </AppWindow>
  );
}
