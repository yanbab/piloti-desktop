import * as React from "react";
import { InfoIcon, PlusIcon, SaveIcon } from "lucide-react";
import { AppChromeProvider, type AppChrome } from "@/components/elements/app-chrome";
import { AppContent, AppWindow } from "@/components/elements/app-window";
import { HeaderBar, HeaderButton, HeaderHeading } from "@/components/elements/header-bar";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import { Segmented } from "@/components/ui/segmented";
import { Window } from "@/components/ui/window";
import { _ } from "@/lib/core/i18n";

/** Each part of the sample: the component and the selector it renders. */
const PARTS = [
  ["AppWindow", '[data-slot="app-window"]'],
  ["HeaderBar", '[data-slot="window-titlebar"]'],
  ["HeaderBar.Start", '[data-slot="header-bar-start"]'],
  ["WindowControls", '[data-slot="window-controls"]'],
  ["HeaderHeading", '[data-slot="page-title"]'],
  ["HeaderBar.Title", '[data-slot="window-title"]'],
  ["HeaderBar.End", '[data-slot="header-bar-end"]'],
  ["HeaderButton", "[data-header-button]"],
  ["Segmented", '[data-slot="segmented"]'],
  ["AppContent", '[data-slot="app-content"]'],
] as const;

const CODE = `<AppWindow>
  <HeaderBar>
    <HeaderBar.Start>
      <HeaderHeading>Notes</HeaderHeading>
    </HeaderBar.Start>
    <HeaderBar.Title>Title</HeaderBar.Title>
    <HeaderBar.End>
      <HeaderButton icon={PlusIcon} label="New" />
      <Segmented value={view} onChange={setView} options={views} />
    </HeaderBar.End>
  </HeaderBar>
  <AppContent padded>Hello world</AppContent>
</AppWindow>`;

const OUTLINE = "2px solid var(--ui-accent)";

/**
 * A window built with `components/elements`, and what each part renders. The
 * class names are read from the sample itself, so they can't go stale.
 */
export function ElementsPage() {
  const [decorations, setDecorations] = React.useState<"client" | "server">("client");
  const [side, setSide] = React.useState<"left" | "right">("right");
  const [view, setView] = React.useState<"list" | "grid">("list");
  const sample = React.useRef<HTMLDivElement | null>(null);
  const [classes, setClasses] = React.useState<Record<string, string>>({});

  const chrome = React.useMemo<AppChrome>(
    () => ({
      appId: "sample",
      decorations,
      menu: decorations === "client" ? (side) => <WindowMenuButton side={side} /> : undefined,
    }),
    [decorations],
  );

  React.useLayoutEffect(() => {
    setClasses(
      Object.fromEntries(
        PARTS.flatMap(([name, selector]) => {
          const node = sample.current?.querySelector(selector);
          return node ? [[name, node.getAttribute("class") ?? ""]] : [];
        }),
      ),
    );
  }, [decorations, side]);

  const outline = (selector: string, on: boolean) => {
    for (const node of sample.current?.querySelectorAll<HTMLElement>(selector) ?? []) {
      node.style.outline = on ? OUTLINE : "";
      node.style.outlineOffset = on ? "-2px" : "";
    }
  };

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Sample window")}</GroupedFormSectionTitle>
        <div className="flex flex-wrap justify-end gap-2 pb-2">
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
        <div ref={sample}>
          <Window
            buttonLayout={side === "left" ? "close,minimize,maximize:" : ":minimize,maximize,close"}
            className="h-56 w-full"
          >
            <AppChromeProvider value={chrome}>
              <AppWindow>
                <HeaderBar>
                  <HeaderBar.Start>
                    <HeaderHeading>Notes</HeaderHeading>
                  </HeaderBar.Start>
                  <HeaderBar.Title>Title</HeaderBar.Title>
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
        </div>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Parts")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          {PARTS.map(([name, selector]) => (
            <GroupedFormRow
              key={name}
              className="flex-col items-stretch gap-1 py-2"
              onMouseEnter={() => outline(selector, true)}
              onMouseLeave={() => outline(selector, false)}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-ui-body font-semibold">{`<${name}>`}</span>
                <code className="font-mono text-ui-footnote text-ui-label-secondary select-text">
                  {selector}
                </code>
              </div>
              <code className="font-mono text-ui-footnote break-words text-ui-label-secondary select-text">
                {classes[name] ?? _("Not drawn")}
              </code>
            </GroupedFormRow>
          ))}
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Code")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <pre className="overflow-x-auto p-3 font-mono text-ui-footnote select-text">{CODE}</pre>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
