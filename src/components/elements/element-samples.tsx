import * as React from "react";
import { AdwSplitView } from "@/components/ui/adw-split-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowTitle,
  GroupedFormSection,
} from "@/components/ui/grouped-form";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";

/**
 * One element: its preview on the left, the code that makes it on the right,
 * as React or as plain HTML. The preview follows the tab; the HTML one is made
 * from the very string shown, so the two can't drift apart.
 */
export function ElementSample({
  title,
  react,
  reactCode,
  html,
  controls,
}: {
  title: string;
  react: React.ReactNode;
  reactCode: string;
  html: string;
  /** Options of the preview, e.g. the window's decorations. */
  controls?: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<"react" | "html">("react");
  return (
    <section data-element-sample={title} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-ui-body font-semibold text-ui-label">{title}</h3>
        {controls}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] overflow-hidden rounded-ui-group border border-ui-separator bg-ui-group">
        {tab === "react" ? (
          <div className="flex min-w-0 flex-wrap content-center items-center justify-center gap-2 p-3">
            {react}
          </div>
        ) : (
          // Constant strings from this repository: never user content.
          <div
            className="flex min-w-0 flex-wrap content-center items-center justify-center gap-2 p-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        <div className="flex min-w-0 flex-col gap-2 border-l border-ui-separator p-3">
          <div className="self-end">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { id: "react", label: "React" },
                { id: "html", label: "HTML" },
              ]}
            />
          </div>
          <pre className="max-h-64 overflow-auto font-mono text-ui-footnote select-text">
            {tab === "react" ? reactCode : html}
          </pre>
        </div>
      </div>
    </section>
  );
}

function Toggles() {
  const [on, setOn] = React.useState(true);
  return (
    <>
      <Switch checked={on} onCheckedChange={setOn} />
      <Switch checked={!on} onCheckedChange={(v) => setOn(!v)} />
      <Checkbox checked={on} onCheckedChange={(v) => setOn(Boolean(v))} />
    </>
  );
}

function Views() {
  const [view, setView] = React.useState<"list" | "grid">("list");
  return (
    <Segmented
      value={view}
      onChange={setView}
      options={[
        { id: "list", label: "List" },
        { id: "grid", label: "Grid" },
      ]}
    />
  );
}

function Places() {
  const [place, setPlace] = React.useState("Recents");
  return (
    <div className="h-36 w-full">
      <AdwSplitView
        appId="piloti-demo"
        title="Places"
        compactBreakpoint={0}
        sidebarItems={["Recents", "Documents"].map((label) => ({
          id: label,
          label,
          icon: null,
          selected: place === label,
          onClick: () => setPlace(label),
        }))}
      >
        <div className="p-3">{place}</div>
      </AdwSplitView>
    </div>
  );
}

const SAMPLES: { title: string; react: React.ReactNode; reactCode: string; html: string }[] = [
  {
    title: "Buttons",
    react: (
      <>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="tinted">Tinted</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="secondary" disabled>Disabled</Button>
      </>
    ),
    reactCode: `<Button>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="tinted">Tinted</Button>
<Button variant="destructive">Delete</Button>
<Button variant="secondary" disabled>Disabled</Button>`,
    html: `<button class="ui-button">Save</button>
<button class="ui-button" data-variant="secondary">Cancel</button>
<button class="ui-button" data-variant="tinted">Tinted</button>
<button class="ui-button" data-variant="destructive">Delete</button>
<button class="ui-button" data-variant="secondary" disabled>Disabled</button>`,
  },
  {
    title: "Switch and checkbox",
    react: <Toggles />,
    reactCode: `<Switch checked={on} onCheckedChange={setOn} />
<Switch checked={!on} onCheckedChange={(v) => setOn(!v)} />
<Checkbox checked={on} onCheckedChange={setOn} />`,
    html: `<span class="ui-switch" data-slot="switch" role="switch" aria-checked="true" data-checked>
  <span class="ui-switch-thumb" data-slot="switch-thumb" data-checked></span>
</span>
<span class="ui-switch" data-slot="switch" role="switch" aria-checked="false" data-unchecked>
  <span class="ui-switch-thumb" data-slot="switch-thumb" data-unchecked></span>
</span>
<span class="ui-checkbox" role="checkbox" aria-checked="true" data-checked>
  <span class="ui-checkbox-indicator">
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6.5 5 9l5-6"/></svg>
  </span>
</span>`,
  },
  {
    title: "Text field",
    react: <Input className="max-w-52" placeholder="Name" />,
    reactCode: `<Input placeholder="Name" />`,
    html: `<input class="ui-input" placeholder="Name" style="max-width: 13rem">`,
  },
  {
    title: "Segmented control",
    react: <Views />,
    reactCode: `<Segmented
  value={view}
  onChange={setView}
  options={[
    { id: "list", label: "List" },
    { id: "grid", label: "Grid" },
  ]}
/>`,
    html: `<div class="ui-segmented" data-slot="segmented">
  <button class="ui-segmented-item" data-slot="segmented-item" aria-pressed="true">List</button>
  <button class="ui-segmented-item" data-slot="segmented-item" aria-pressed="false">Grid</button>
</div>`,
  },
  {
    title: "Grouped form",
    react: (
      <GroupedForm className="w-full p-0">
        <GroupedFormSection>
          <GroupedFormGroup>
            {[["Name", "Piloti"], ["Version", "0.10"]].map(([name, value]) => (
              <GroupedFormRow key={name}>
                <GroupedFormRowTitle>{name}</GroupedFormRowTitle>
                <GroupedFormRowControl>{value}</GroupedFormRowControl>
              </GroupedFormRow>
            ))}
          </GroupedFormGroup>
        </GroupedFormSection>
      </GroupedForm>
    ),
    reactCode: `<GroupedForm>
  <GroupedFormSection>
    <GroupedFormGroup>
      <GroupedFormRow>
        <GroupedFormRowTitle>Name</GroupedFormRowTitle>
        <GroupedFormRowControl>Piloti</GroupedFormRowControl>
      </GroupedFormRow>
    </GroupedFormGroup>
  </GroupedFormSection>
</GroupedForm>`,
    html: `<div class="ui-form" data-slot="grouped-form" style="width: 100%; padding: 0">
  <section class="ui-form-section" data-slot="grouped-form-section">
    <div class="ui-form-group" data-slot="grouped-form-group">
      <div class="ui-form-row" data-slot="grouped-form-row">
        <div class="ui-form-row-title" data-slot="grouped-form-row-title">Name</div>
        <div class="ui-form-row-control">Piloti</div>
      </div>
      <div class="ui-form-row" data-slot="grouped-form-row">
        <div class="ui-form-row-title" data-slot="grouped-form-row-title">Version</div>
        <div class="ui-form-row-control">0.10</div>
      </div>
    </div>
  </section>
</div>`,
  },
  {
    title: "Sidebar",
    react: <Places />,
    reactCode: `<AdwSplitView title="Places" sidebarItems={places}>
  <div>{place}</div>
</AdwSplitView>`,
    html: `<aside class="ui-sidebar bg-ui-sidebar" style="width: 11rem; height: 9rem">
  <nav class="ui-sidebar-nav" data-slot="sidebar-nav" style="padding-top: 8px">
    <button class="ui-sidebar-item" data-slot="sidebar-item" data-selected>
      <span class="ui-sidebar-label">Recents</span>
    </button>
    <button class="ui-sidebar-item" data-slot="sidebar-item">
      <span class="ui-sidebar-label">Documents</span>
    </button>
  </nav>
</aside>`,
  },
  {
    title: "Menu",
    react: (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" />}>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Open
            <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>Rename…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Move to Trash</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    reactCode: `<DropdownMenu>
  <DropdownMenuTrigger render={<Button variant="secondary" />}>
    Open Menu
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>
      Open<DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem disabled>Move to Trash</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
    html: `<div class="ui-menu ui-material-menu" role="menu" style="width: 13rem">
  <div class="ui-menu-item" role="menuitem">Open<span class="ui-menu-shortcut">⌘O</span></div>
  <div class="ui-menu-item" role="menuitem" data-highlighted>Rename…</div>
  <div class="ui-menu-separator" role="separator"></div>
  <div class="ui-menu-item" role="menuitem" data-disabled>Move to Trash</div>
</div>`,
  },
];

export function ElementSamples() {
  return (
    <>
      {SAMPLES.map((sample) => (
        <ElementSample key={sample.title} {...sample} />
      ))}
    </>
  );
}
