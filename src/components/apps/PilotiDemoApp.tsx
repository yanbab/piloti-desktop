import * as React from "react";
import {
  BellIcon,
  BoxesIcon,
  FolderIcon,
  ImageIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  SunIcon,
  TypeIcon,
  Volume2Icon,
} from "lucide-react";
import { AdwSplitView, type AdwSplitSidebarItem } from "@/components/ui/adw-split-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowDescription,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import { Input } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { useApps, useSettings } from "@/context/DesktopStateContext";
import { APP_CATALOG } from "@/data/catalog";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";

/**
 * Piloti demo: every shell control in one place, in the current interface
 * theme and colour mode (both switchable from the header), to check visual
 * consistency at a glance.
 */

type PageId = "controls" | "menus" | "text" | "tokens" | "icons";

const PAGES: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "controls", label: "Controls", icon: <SlidersHorizontalIcon className="size-4" /> },
  { id: "menus", label: "Menus", icon: <MenuIcon className="size-4" /> },
  { id: "text", label: "Text", icon: <TypeIcon className="size-4" /> },
  { id: "tokens", label: "Colours & Shapes", icon: <PaletteIcon className="size-4" /> },
  { id: "icons", label: "Icons", icon: <ImageIcon className="size-4" /> },
];

const TYPE_ROLES = [
  "large-title",
  "title-1",
  "title-2",
  "title-3",
  "headline",
  "body",
  "callout",
  "subheadline",
  "footnote",
  "caption",
] as const;

const SYSTEM_COLORS = [
  "blue", "indigo", "purple", "pink", "red", "orange", "yellow",
  "green", "mint", "teal", "cyan", "gray", "brown",
] as const;

const LABEL_TOKENS = ["label", "label-secondary", "label-tertiary", "label-quaternary"] as const;
const SURFACE_TOKENS = ["window", "content", "group", "titlebar", "control", "fill-primary", "separator"] as const;
const RADIUS_TOKENS = ["control", "item", "menu", "group", "popover", "window"] as const;
const HEIGHT_TOKENS = ["mini", "small", "medium", "large"] as const;

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string; icon?: React.ReactNode }[];
  onChange: (id: T) => void;
}) {
  return (
    <div
      data-slot="segmented"
      className="inline-flex items-center gap-1 rounded-adw-item bg-black/8 p-1 dark:bg-white/8"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          data-slot="segmented-item"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-adw-control px-2.5 py-1 text-adw-callout font-medium transition-colors",
            value === opt.id
              ? "bg-adw-window text-adw-label shadow-xs dark:bg-white/16"
              : "text-adw-label-secondary hover-fill:bg-black/5 dark:hover-fill:bg-white/6",
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <GroupedFormRow>
      <GroupedFormRowLabel className="w-32 shrink-0">
        <GroupedFormRowTitle>{title}</GroupedFormRowTitle>
        {description && <GroupedFormRowDescription>{description}</GroupedFormRowDescription>}
      </GroupedFormRowLabel>
      <GroupedFormRowControl className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        {children}
      </GroupedFormRowControl>
    </GroupedFormRow>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GroupedFormSection>
      <GroupedFormSectionTitle>{title}</GroupedFormSectionTitle>
      <GroupedFormGroup>{children}</GroupedFormGroup>
    </GroupedFormSection>
  );
}

function ControlsPage() {
  const [switchOn, setSwitchOn] = React.useState(true);
  const [checked, setChecked] = React.useState(true);
  const [volume, setVolume] = React.useState(60);
  const [zoom, setZoom] = React.useState(3);
  const [fruit, setFruit] = React.useState("apple");
  const [align, setAlign] = React.useState<"left" | "center" | "right">("left");
  return (
    <GroupedForm>
      <Section title={_("Buttons")}>
        <Row title={_("Variants")}>
          <Button>{_("Default")}</Button>
          <Button variant="secondary">{_("Secondary")}</Button>
          <Button variant="tinted">{_("Tinted")}</Button>
          <Button variant="outline">{_("Outline")}</Button>
          <Button variant="ghost">{_("Ghost")}</Button>
          <Button variant="destructive">{_("Delete")}</Button>
        </Row>
        <Row title={_("Sizes")} description="sm · default · lg">
          <Button size="sm" variant="secondary">{_("Small")}</Button>
          <Button variant="secondary">{_("Regular")}</Button>
          <Button size="lg" variant="secondary">{_("Large")}</Button>
        </Row>
        <Row title={_("Disabled")}>
          <Button disabled>{_("Default")}</Button>
          <Button disabled variant="secondary">{_("Secondary")}</Button>
        </Row>
      </Section>

      <Section title={_("Toggles")}>
        <Row title={_("Switch")}>
          <Switch size="sm" checked={switchOn} onCheckedChange={setSwitchOn} />
          <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
          <Switch disabled checked={false} />
        </Row>
        <Row title={_("Checkbox")}>
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} />
          <Checkbox checked={!checked} onCheckedChange={(v) => setChecked(!v)} />
          <Checkbox disabled checked />
        </Row>
        <Row title={_("Segmented control")}>
          <Segmented
            value={align}
            onChange={setAlign}
            options={[
              { id: "left", label: _("Left") },
              { id: "center", label: _("Center") },
              { id: "right", label: _("Right") },
            ]}
          />
        </Row>
      </Section>

      <Section title={_("Values")}>
        <Row title={_("Slider")} description="default">
          <div className="w-44">
            <Slider value={[volume]} onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)} />
          </div>
        </Row>
        <Row title={_("Small slider")} description="size=sm (neutral)">
          <div className="w-28">
            <Slider size="sm" min={0} max={6} step={1} value={[zoom]} onValueChange={(v) => setZoom(Array.isArray(v) ? v[0] : v)} />
          </div>
        </Row>
        <Row title={_("Capsule slider")} description="Control Center">
          <div className="w-44">
            <Slider
              variant="capsule"
              icon={<Volume2Icon className="size-3.5" />}
              value={[volume]}
              onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)}
            />
          </div>
        </Row>
        <Row title={_("Popup button")}>
          <Select value={fruit} onValueChange={(v) => setFruit(String(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="pear">Pear</SelectItem>
              <SelectItem value="plum">Plum</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section title={_("Text fields")}>
        <Row title={_("Search field")}>
          <SearchField className="w-48" />
        </Row>
        <Row title={_("Text field")}>
          <Input className="w-48" placeholder={_("Name")} />
        </Row>
      </Section>
    </GroupedForm>
  );
}

function MenusPage() {
  const [showHidden, setShowHidden] = React.useState(false);
  const [sort, setSort] = React.useState("name");
  return (
    <GroupedForm>
      <Section title={_("Menus")}>
        <Row title={_("Dropdown menu")} description={_("Items, check items, radio items, shortcuts")}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="secondary" />}>
              {_("Open Menu")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem>
                {_("New Window")}
                <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>{_("Disabled item")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={showHidden} onCheckedChange={(v) => setShowHidden(Boolean(v))}>
                {_("Show Hidden Files")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(String(v))}>
                <DropdownMenuRadioItem value="name">{_("Sort by Name")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="kind">{_("Sort by Kind")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Row>
        <Row title={_("Context menu")} description={_("Right-click the area")}>
          <ContextMenu>
            <ContextMenuTrigger className="flex h-14 w-48 items-center justify-center rounded-adw-item border border-dashed border-adw-separator text-adw-callout text-adw-label-secondary">
              {_("Right-click here")}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>{_("Open")}</ContextMenuItem>
              <ContextMenuItem>{_("Rename…")}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem>{_("Move to Trash")}</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </Row>
        <Row title={_("Tooltip")}>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={_("Notifications")} />}>
              <BellIcon />
            </TooltipTrigger>
            <TooltipContent>{_("Notifications")}</TooltipContent>
          </Tooltip>
        </Row>
      </Section>
    </GroupedForm>
  );
}

function TextPage() {
  return (
    <GroupedForm>
      <Section title={_("Type roles")}>
        {TYPE_ROLES.map((role) => (
          <GroupedFormRow key={role}>
            <span
              className="min-w-0 truncate text-adw-label"
              style={{ fontSize: `var(--adw-font-${role})` }}
            >
              The quick brown fox
            </span>
            <code className="shrink-0 font-mono text-adw-footnote text-adw-label-secondary">
              text-adw-{role}
            </code>
          </GroupedFormRow>
        ))}
      </Section>
    </GroupedForm>
  );
}

function Swatch({ cssVar, label, round }: { cssVar: string; label: string; round?: boolean }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <span
        className={cn("size-8 shadow-[inset_0_0_0_1px_var(--adw-border)]", round ? "rounded-full" : "rounded-adw-control")}
        style={{ background: `var(${cssVar})` }}
      />
      <span className="w-full truncate text-center text-adw-caption text-adw-label-secondary">{label}</span>
    </div>
  );
}

function TokensPage() {
  return (
    <GroupedForm>
      <Section title={_("System colours")}>
        <GroupedFormRow className="flex-wrap justify-start gap-1 py-3">
          <Swatch cssVar="--adw-accent" label="accent" round />
          {SYSTEM_COLORS.map((c) => (
            <Swatch key={c} cssVar={`--adw-${c}`} label={c} round />
          ))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Labels & surfaces")}>
        <GroupedFormRow className="flex-wrap justify-start gap-1 py-3">
          {LABEL_TOKENS.map((t) => (
            <Swatch key={t} cssVar={`--adw-${t}`} label={t.replace("label-", "")} />
          ))}
        </GroupedFormRow>
        <GroupedFormRow className="flex-wrap justify-start gap-1 py-3">
          {SURFACE_TOKENS.map((t) => (
            <Swatch key={t} cssVar={`--adw-${t}`} label={t} />
          ))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Corner radii")}>
        <GroupedFormRow className="flex-wrap justify-start gap-3 py-3">
          {RADIUS_TOKENS.map((t) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <span
                className="size-12 bg-adw-fill-primary shadow-[inset_0_0_0_1px_var(--adw-border)]"
                style={{ borderRadius: `var(--adw-radius-${t})` }}
              />
              <span className="text-adw-caption text-adw-label-secondary">{t}</span>
            </div>
          ))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Control heights")}>
        <GroupedFormRow className="flex-wrap items-end justify-start gap-3 py-3">
          {HEIGHT_TOKENS.map((t) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <span
                className="flex w-16 items-center justify-center rounded-adw-control bg-adw-control text-adw-caption text-adw-label-secondary"
                style={{ height: `var(--adw-control-${t})` }}
              />
              <span className="text-adw-caption text-adw-label-secondary">{t}</span>
            </div>
          ))}
        </GroupedFormRow>
      </Section>
    </GroupedForm>
  );
}

function IconsPage() {
  const { getAppIconUrl } = useApps();
  const shellIcons = ["folder", "folder-open", "__user_trash__", "__user_trash_full__", "text-x-generic", "image-x-generic", "audio-x-generic", "application-pdf", "__usb_drive__"];
  const renderIcon = (key: string, label: string) => {
    const url = getAppIconUrl(key);
    return (
      <div key={key} className="flex w-20 flex-col items-center gap-1.5">
        <span className="flex size-12 items-center justify-center">
          {url ? (
            <img src={url} alt="" className="size-12 object-contain" draggable={false} />
          ) : (
            <BoxesIcon className="size-8 text-adw-label-tertiary" />
          )}
        </span>
        <span className="w-full truncate text-center text-adw-caption text-adw-label-secondary">{label}</span>
      </div>
    );
  };
  return (
    <GroupedForm>
      <Section title={_("App icons")}>
        <GroupedFormRow className="flex-wrap justify-start gap-2 py-3">
          {APP_CATALOG.map((app) => renderIcon(app.id, _(app.shortName)))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Places & files")}>
        <GroupedFormRow className="flex-wrap justify-start gap-2 py-3">
          {shellIcons.map((key) => renderIcon(key, key.replace(/^__|__$/g, "")))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Symbols")}>
        <GroupedFormRow className="flex-wrap justify-start gap-4 py-3 text-adw-label">
          {[FolderIcon, BellIcon, SunIcon, MoonIcon, MonitorIcon, Volume2Icon, PaletteIcon, TypeIcon].map((Icon, i) => (
            <Icon key={i} className="size-4" />
          ))}
        </GroupedFormRow>
      </Section>
    </GroupedForm>
  );
}

export function PilotiDemoApp({ windowId, isCsd = false }: { windowId?: string; isCsd?: boolean }) {
  const { settings, updateSettings } = useSettings();
  const [page, setPage] = React.useState<PageId>("controls");

  const sidebarItems: AdwSplitSidebarItem[] = PAGES.map((p) => ({
    id: p.id,
    label: _(p.label),
    icon: p.icon,
    selected: page === p.id,
    onClick: () => setPage(p.id),
  }));

  const switches = (
    <div className="flex items-center gap-2" data-window-no-drag>
      <Segmented
        value={settings.interfaceTheme === "adwaita" ? "adwaita" : "piloti"}
        onChange={(theme) =>
          updateSettings({
            interfaceTheme: theme,
            iconTheme: theme === "adwaita" ? "Adwaita" : "Piloti",
          })
        }
        options={[
          { id: "piloti", label: "Piloti" },
          { id: "adwaita", label: "Adwaita" },
        ]}
      />
      <Segmented
        value={settings.themeMode}
        onChange={(mode) => updateSettings({ themeMode: mode })}
        options={[
          { id: "system", label: _("Auto"), icon: <MonitorIcon className="size-3.5" /> },
          { id: "light", label: _("Light"), icon: <SunIcon className="size-3.5" /> },
          { id: "dark", label: _("Dark"), icon: <MoonIcon className="size-3.5" /> },
        ]}
      />
    </div>
  );

  return (
    <AdwSplitView
      title={_("Piloti demo")}
      appId="piloti-demo"
      iconName="sparkles"
      windowId={windowId}
      isCsd={isCsd}
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-[176px]"
      sidebarId="piloti-demo-sidebar"
      contentClassName="bg-adw-window"
      header={() =>
        isCsd ? (
          <WindowTitlebar data-window-drag-region className="rounded-tl-none border-b border-adw-separator bg-adw-titlebar">
            <h2 className="truncate px-2 text-adw-body font-bold text-adw-label">
              {_(PAGES.find((p) => p.id === page)?.label ?? "")}
            </h2>
            <div className="flex items-center gap-2">
              {switches}
              {windowId && <WindowControls side="right" />}
            </div>
          </WindowTitlebar>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-adw-separator bg-adw-window px-5 py-2.5">
            <h2 className="truncate text-adw-title-3 font-bold text-adw-label">
              {_(PAGES.find((p) => p.id === page)?.label ?? "")}
            </h2>
            {switches}
          </div>
        )
      }
    >
      {({ onContentScroll }) => (
        <div onScroll={onContentScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {page === "controls" && <ControlsPage />}
          {page === "menus" && <MenusPage />}
          {page === "text" && <TextPage />}
          {page === "tokens" && <TokensPage />}
          {page === "icons" && <IconsPage />}
        </div>
      )}
    </AdwSplitView>
  );
}
