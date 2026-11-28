import * as React from "react";
import { ElementSample } from "@/ui/components/elements/element-sample";
import { InlineMenuSample, MENU_CODE, MENU_HTML } from "@/ui/components/elements/menu-sample";
import { AdwSplitView } from "@/ui/components/ui/adw-split-view";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/ui/components/ui/context-menu";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowTitle,
  GroupedFormSection,
} from "@/ui/components/ui/grouped-form";
import { Input } from "@/ui/components/ui/input";
import { SearchField } from "@/ui/components/ui/search-field";
import { Segmented } from "@/ui/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Slider } from "@/ui/components/ui/slider";
import { Switch } from "@/ui/components/ui/switch";
import { BellIcon, ListIcon, LayoutGridIcon, Volume2Icon } from "@/ui/components/ui/symbols";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/ui/tooltip";

function Toggles() {
  const [on, setOn] = React.useState(true);
  return (
    <>
      <Switch size="sm" checked={on} onCheckedChange={setOn} />
      <Switch checked={on} onCheckedChange={setOn} />
      <Switch checked={!on} onCheckedChange={(v) => setOn(!v)} />
      <Switch disabled checked={false} />
      <Checkbox checked={on} onCheckedChange={(v) => setOn(Boolean(v))} />
      <Checkbox checked={!on} onCheckedChange={(v) => setOn(!v)} />
      <Checkbox disabled checked />
    </>
  );
}

function Views() {
  const [view, setView] = React.useState<"list" | "grid">("list");
  return (
    <>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { id: "list", label: "List" },
          { id: "grid", label: "Grid" },
        ]}
      />
      <Segmented
        iconOnly
        value={view}
        onChange={setView}
        options={[
          { id: "list", label: "List", icon: <ListIcon className="size-3.5" /> },
          { id: "grid", label: "Grid", icon: <LayoutGridIcon className="size-3.5" /> },
        ]}
      />
    </>
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

const VARIANTS = ["default", "secondary", "tinted", "outline", "ghost", "destructive"] as const;

function IconButtons() {
  return (
    <>
      {VARIANTS.map((v) => (
        <Button key={v} variant={v} keepIcon><BellIcon />Notify</Button>
      ))}
      {VARIANTS.map((v) => (
        <Button key={v} variant={v} shape="round">Round</Button>
      ))}
      {VARIANTS.map((v) => (
        <Button key={v} variant={v} size="icon" aria-label={v}><BellIcon /></Button>
      ))}
      {VARIANTS.map((v) => (
        <Button key={v} variant={v} size="icon" shape="round" aria-label={v}><BellIcon /></Button>
      ))}
    </>
  );
}

const BELL_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1H3zM6.5 14h3"/></svg>`;

const ICON_BUTTONS_HTML = `<button class="ui-button" data-variant="secondary" data-label data-keep-icon>${BELL_SVG}Notify</button>
<button class="ui-button" data-variant="secondary" data-shape="round">Round</button>
<button class="ui-button" data-variant="secondary" data-size="icon" aria-label="Notify">${BELL_SVG}</button>
<button class="ui-button" data-variant="secondary" data-size="icon" data-shape="round" aria-label="Notify">${BELL_SVG}</button>`;

function Sliders() {
  const [value, setValue] = React.useState(60);
  const change = (v: number | readonly number[]) => setValue(typeof v === "number" ? v : v[0]);
  return (
    <div className="flex w-44 flex-col gap-3">
      <Slider aria-label="Default" value={[value]} onValueChange={change} />
      <Slider aria-label="Small" size="sm" value={[value]} onValueChange={change} />
      <Slider
        aria-label="Capsule"
        variant="capsule"
        icon={<Volume2Icon className="size-3.5" />}
        value={[value]}
        onValueChange={change}
      />
    </div>
  );
}

function PopupButton() {
  const [fruit, setFruit] = React.useState("apple");
  return (
    <Select
      items={{ apple: "Apple", pear: "Pear", plum: "Plum" }}
      value={fruit}
      onValueChange={(v) => setFruit(String(v))}
    >
      <SelectTrigger aria-label="Fruit">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="pear">Pear</SelectItem>
        <SelectItem value="plum">Plum</SelectItem>
      </SelectContent>
    </Select>
  );
}

const TYPE_ROLES = ["title", "body", "small", "caption"] as const;

const typeStyle = (role: string) => ({ fontSize: `var(--ui-font-${role})` });

type Sample = { title: string; react: React.ReactNode; reactCode: string; html?: string };

const SAMPLES: Sample[] = [
  {
    title: "Buttons",
    react: (
      <>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="tinted">Tinted</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="secondary" disabled>Disabled</Button>
        <Button variant="secondary" size="sm">Small</Button>
        <Button variant="secondary">Medium</Button>
        <Button variant="secondary" size="lg">Large</Button>
      </>
    ),
    reactCode: `<Button>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="tinted">Tinted</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="secondary" disabled>Disabled</Button>
<Button variant="secondary" size="sm">Small</Button>
<Button variant="secondary">Medium</Button>
<Button variant="secondary" size="lg">Large</Button>`,
    html: `<button class="ui-button">Save</button>
<button class="ui-button" data-variant="secondary">Cancel</button>
<button class="ui-button" data-variant="tinted">Tinted</button>
<button class="ui-button" data-variant="outline">Outline</button>
<button class="ui-button" data-variant="ghost">Ghost</button>
<button class="ui-button" data-variant="destructive">Delete</button>
<button class="ui-button" data-variant="secondary" disabled>Disabled</button>
<button class="ui-button" data-variant="secondary" data-size="sm">Small</button>
<button class="ui-button" data-variant="secondary">Medium</button>
<button class="ui-button" data-variant="secondary" data-size="lg">Large</button>`,
  },
  {
    title: "Icon and round buttons",
    react: <IconButtons />,
    reactCode: `<Button keepIcon><BellIcon />Notify</Button>
<Button shape="round">Round</Button>
<Button size="icon" aria-label="Notify"><BellIcon /></Button>
<Button size="icon" shape="round" aria-label="Notify">
  <BellIcon />
</Button>`,
    html: ICON_BUTTONS_HTML,
  },
  {
    title: "Switch and checkbox",
    react: <Toggles />,
    reactCode: `<Switch size="sm" checked={on} onCheckedChange={setOn} />
<Switch checked={on} onCheckedChange={setOn} />
<Switch disabled checked={false} />
<Checkbox checked={on} onCheckedChange={setOn} />
<Checkbox disabled checked />`,
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
    title: "Search field",
    react: <SearchField className="w-48" />,
    reactCode: `<SearchField placeholder="Search" />
<FilterField placeholder="Filter" />`,
  },
  {
    title: "Slider",
    react: <Sliders />,
    reactCode: `<Slider value={[value]} onValueChange={change} />
<Slider size="sm" value={[value]} onValueChange={change} />
<Slider
  variant="capsule"
  icon={<Volume2Icon />}
  value={[value]}
  onValueChange={change}
/>`,
  },
  {
    title: "Popup button",
    react: <PopupButton />,
    reactCode: `<Select items={fruits} value={fruit} onValueChange={setFruit}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="pear">Pear</SelectItem>
  </SelectContent>
</Select>`,
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
/>
<Segmented iconOnly value={view} onChange={setView} options={views} />`,
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
    react: <InlineMenuSample />,
    reactCode: MENU_CODE,
    html: MENU_HTML,
  },
  {
    title: "Context menu and tooltip",
    react: (
      <>
        <ContextMenu>
          <ContextMenuTrigger className="flex h-14 w-40 items-center justify-center rounded-ui-control border border-dashed border-ui-separator text-ui-body text-ui-label-secondary">
            Right-click here
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Open</ContextMenuItem>
            <ContextMenuItem>Rename…</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>Move to Trash</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <Tooltip>
          <TooltipTrigger render={<Button variant="secondary" size="icon" aria-label="Notifications" />}>
            <BellIcon />
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
      </>
    ),
    reactCode: `<ContextMenu>
  <ContextMenuTrigger>Right-click here</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Open</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>

<Tooltip>
  <TooltipTrigger render={<Button size="icon" />}>
    <BellIcon />
  </TooltipTrigger>
  <TooltipContent>Notifications</TooltipContent>
</Tooltip>`,
  },
  {
    title: "Typography",
    react: (
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        {TYPE_ROLES.map((role) => (
          <div key={role} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ui-label" style={typeStyle(role)}>
              The quick brown fox
            </span>
            <code className="shrink-0 font-mono text-ui-caption text-ui-label-secondary">{role}</code>
          </div>
        ))}
      </div>
    ),
    reactCode: TYPE_ROLES.map((role) => `<span className="text-ui-${role}">The quick brown fox</span>`).join("\n"),
    html: TYPE_ROLES.map((role) => `<div style="width: 100%; font-size: var(--ui-font-${role})">The quick brown fox</div>`).join("\n"),
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
