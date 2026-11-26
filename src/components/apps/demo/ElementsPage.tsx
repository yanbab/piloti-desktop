import * as React from "react";
import { InfoIcon, PlusIcon, SaveIcon } from "lucide-react";
import { AppChromeProvider, type AppChrome } from "@/components/elements/app-chrome";
import { AppContent, AppWindow } from "@/components/elements/app-window";
import { HeaderBar, HeaderButton, HeaderHeading } from "@/components/elements/header-bar";
import { ElementSample, ElementSamples } from "@/components/elements/element-samples";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { Segmented } from "@/components/ui/segmented";
import { Window } from "@/components/ui/window";
import { _ } from "@/lib/core/i18n";

const CODE = `<AppWindow>
  <HeaderBar>
    <HeaderBar.Start>
      <HeaderHeading>Notes</HeaderHeading>
    </HeaderBar.Start>
    <HeaderBar.End>
      <HeaderButton icon={PlusIcon} label="New" />
      <Segmented value={view} onChange={setView} options={views} />
    </HeaderBar.End>
  </HeaderBar>
  <AppContent padded>Hello world</AppContent>
</AppWindow>`;

const HTML = `<section class="ui-window" style="flex-direction: column; width: 100%; height: 14rem">
  <header class="ui-window-titlebar">
    <div class="ui-window-title">Hello</div>
  </header>
  <div class="ui-window-content" style="padding: 16px">Hello world</div>
</section>`;

/** Each element, drawn and written: a sample window first. */
export function ElementsPage() {
  const [decorations, setDecorations] = React.useState<"client" | "server">("client");
  const [side, setSide] = React.useState<"left" | "right">("right");
  const [view, setView] = React.useState<"list" | "grid">("list");

  const chrome = React.useMemo<AppChrome>(
    () => ({
      appId: "sample",
      decorations,
      menu: decorations === "client" ? (side) => <WindowMenuButton side={side} /> : undefined,
    }),
    [decorations],
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <ElementSample
        title={_("Sample window")}
        reactCode={CODE}
        html={HTML}
        controls={
          <div className="flex flex-wrap gap-2">
          <Segmented
            value={decorations}
            onChange={setDecorations}
            options={[
              { id: "client", label: _("Client") },
              { id: "server", label: _("Server") },
            ]}
          />
          <Segmented
            value={side}
            onChange={setSide}
            options={[
              { id: "left", label: _("Left") },
              { id: "right", label: _("Right") },
            ]}
          />
          </div>
        }
        react={
          <Window
            buttonLayout={side === "left" ? "close,minimize,maximize:" : ":minimize,maximize,close"}
            className="h-56 w-full min-w-0"
          >
            <AppChromeProvider value={chrome}>
              <AppWindow>
                <HeaderBar>
                  <HeaderBar.Start>
                    <HeaderHeading>Notes</HeaderHeading>
                  </HeaderBar.Start>
                  <HeaderBar.End>
                    <HeaderButton icon={PlusIcon} label="New" />
                    <Segmented
                      iconOnly
                      value={view}
                      onChange={setView}
                      options={[
                        { id: "list", label: "List", icon: <SaveIcon className="size-3.5" /> },
                        { id: "grid", label: "Grid", icon: <InfoIcon className="size-3.5" /> },
                      ]}
                    />
                  </HeaderBar.End>
                </HeaderBar>
                <AppContent padded>Hello world</AppContent>
              </AppWindow>
            </AppChromeProvider>
          </Window>
        }
      />
      <ElementSamples />
    </div>
  );
}
