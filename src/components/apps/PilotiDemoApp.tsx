import { ICON_SIZES } from "@/lib/shell/icon-sizes";
import * as React from "react";
import { BoxesIcon } from "lucide-react";
import { BellIcon, ChevronDownIcon, FolderIcon, HouseIcon, ImageIcon, MenuIcon, MonitorIcon, MoonIcon, PaletteIcon, SlidersHorizontalIcon, SunIcon, TypeIcon, Volume2Icon } from "@/components/ui/symbols";
import { HeaderBar, HeaderHeading } from "@/components/elements/header-bar";
import { AppSplitView, type SidebarItem } from "@/components/elements/split-view";
import { ElementsPage } from "@/components/apps/demo/ElementsPage";
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
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useApps,
  useDesktopSettings,
  useUpdateSettings,
} from "@/context/DesktopStateContext";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { APP_CATALOG } from "@/data/catalog";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";

/**
 * Piloti demo: every shell control in one place, in the current interface
 * theme and colour mode (both switchable from the header), to check visual
 * consistency at a glance.
 */

type PageId = "elements" | "controls" | "menus" | "text" | "tokens" | "icons";

const PAGES: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "elements", label: "Elements", icon: <BoxesIcon className="size-4" /> },
  { id: "controls", label: "Controls", icon: <SlidersHorizontalIcon className="size-4" /> },
  { id: "menus", label: "Menus", icon: <MenuIcon className="size-4" /> },
  { id: "text", label: "Text", icon: <TypeIcon className="size-4" /> },
  { id: "tokens", label: "Colours & Shapes", icon: <PaletteIcon className="size-4" /> },
  { id: "icons", label: "Icons", icon: <ImageIcon className="size-4" /> },
];

const TYPE_ROLES = ["title", "body", "small", "caption"] as const;

const SYSTEM_COLORS = [
  "blue", "indigo", "purple", "pink", "red", "orange", "yellow",
  "green", "mint", "teal", "cyan", "gray", "brown",
] as const;

const LABEL_TOKENS = ["label", "label-secondary", "label-tertiary", "label-quaternary"] as const;
const SURFACE_TOKENS = ["window", "group", "sidebar", "overlay", "control", "fill-primary", "separator"] as const;
const RADIUS_TOKENS = ["control", "box", "window"] as const;
const HEIGHT_TOKENS = ["small", "medium", "large"] as const;

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

const BUTTON_VARIANTS = [
  { variant: "default", label: "Default" },
  { variant: "secondary", label: "Secondary" },
  { variant: "tinted", label: "Tinted" },
  { variant: "outline", label: "Outline" },
  { variant: "ghost", label: "Ghost" },
  { variant: "destructive", label: "Delete" },
] as const;

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
          {BUTTON_VARIANTS.map(({ variant, label }) => (
            <Button key={variant} variant={variant}>{_(label)}</Button>
          ))}
        </Row>
        <Row title={_("Rounded")}>
          {BUTTON_VARIANTS.map(({ variant, label }) => (
            <Button key={variant} variant={variant} shape="round">{_(label)}</Button>
          ))}
        </Row>
        <Row title={_("Icon and label")}>
          {BUTTON_VARIANTS.map(({ variant, label }) => (
            <Button key={variant} variant={variant} keepIcon><BellIcon />{_(label)}</Button>
          ))}
        </Row>
        <Row title={_("Icon only")}>
          {BUTTON_VARIANTS.map(({ variant, label }) => (
            <Button key={variant} variant={variant} size="icon" aria-label={_(label)}><BellIcon /></Button>
          ))}
        </Row>
        <Row title={_("Rounded icon")}>
          {BUTTON_VARIANTS.map(({ variant, label }) => (
            <Button key={variant} variant={variant} size="icon" shape="round" aria-label={_(label)}><BellIcon /></Button>
          ))}
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
            <ContextMenuTrigger className="flex h-14 w-48 items-center justify-center rounded-ui-control border border-dashed border-ui-separator text-ui-body text-ui-label-secondary">
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
              className="min-w-0 truncate text-ui-label"
              style={{ fontSize: `var(--ui-font-${role})` }}
            >
              The quick brown fox
            </span>
            <code className="shrink-0 font-mono text-ui-caption text-ui-label-secondary">
              text-ui-{role}
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
        className={cn("size-8 shadow-[inset_0_0_0_1px_var(--ui-border)]", round ? "rounded-full" : "rounded-ui-control")}
        style={{ background: `var(${cssVar})` }}
      />
      <span className="w-full truncate text-center text-ui-caption text-ui-label-secondary">{label}</span>
    </div>
  );
}

function TokensPage() {
  return (
    <GroupedForm>
      <Section title={_("System colours")}>
        <GroupedFormRow className="flex-wrap justify-start gap-1 py-3">
          <Swatch cssVar="--ui-accent" label="accent" round />
          {SYSTEM_COLORS.map((c) => (
            <Swatch key={c} cssVar={`--ui-${c}`} label={c} round />
          ))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Labels & surfaces")}>
        <GroupedFormRow className="flex-wrap justify-start gap-1 py-3">
          {LABEL_TOKENS.map((t) => (
            <Swatch key={t} cssVar={`--ui-${t}`} label={t.replace("label-", "")} />
          ))}
        </GroupedFormRow>
        <GroupedFormRow className="flex-wrap justify-start gap-1 py-3">
          {SURFACE_TOKENS.map((t) => (
            <Swatch key={t} cssVar={`--ui-${t}`} label={t} />
          ))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Corner radii")}>
        <GroupedFormRow className="flex-wrap justify-start gap-3 py-3">
          {RADIUS_TOKENS.map((t) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <span
                className="size-12 bg-ui-fill-primary shadow-[inset_0_0_0_1px_var(--ui-border)]"
                style={{ borderRadius: `var(--ui-radius-${t})` }}
              />
              <span className="text-ui-caption text-ui-label-secondary">{t}</span>
            </div>
          ))}
        </GroupedFormRow>
      </Section>
      <Section title={_("Control heights")}>
        <GroupedFormRow className="flex-wrap items-end justify-start gap-3 py-3">
          {HEIGHT_TOKENS.map((t) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <span
                className="flex w-16 items-center justify-center rounded-ui-control bg-ui-control text-ui-caption text-ui-label-secondary"
                style={{ height: `var(--ui-control-${t})` }}
              />
              <span className="text-ui-caption text-ui-label-secondary">{t}</span>
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
            // Handles animated (Lottie) icons, which an <img> can't draw.
            <AppSquircleIcon iconUrl={url} animateOnHover className="size-12" />
          ) : (
            <BoxesIcon className="size-8 text-ui-label-tertiary" />
          )}
        </span>
        <span className="w-full truncate text-center text-ui-caption text-ui-label-secondary">{label}</span>
      </div>
    );
  };
  return (
    <GroupedForm>
      <Section title={_("Icon sizes")}>
        <GroupedFormRow className="flex-wrap items-end justify-start gap-4 py-3">
          {ICON_SIZES.map((size) => {
            const url = getAppIconUrl("piloti-demo");
            return (
              <div key={size} className="flex flex-col items-center gap-1.5">
                {url ? (
                  <span style={{ width: size, height: size }}>
                    <AppSquircleIcon iconUrl={url} className="size-full" />
                  </span>
                ) : (
                  <span style={{ width: size, height: size }} className="rounded-ui-control bg-ui-accent" />
                )}
                <span className="text-ui-caption tabular-nums text-ui-label-secondary">{size}</span>
              </div>
            );
          })}
        </GroupedFormRow>
      </Section>
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
        <GroupedFormRow className="flex-wrap justify-start gap-4 py-3 text-ui-label">
          {[FolderIcon, BellIcon, SunIcon, MoonIcon, MonitorIcon, Volume2Icon, PaletteIcon, TypeIcon].map((Icon, i) => (
            <Icon key={i} className="size-4" />
          ))}
        </GroupedFormRow>
      </Section>
    </GroupedForm>
  );
}

// Symbolic marks for the two themes no icon set here has: GNOME's foot and
// Apple's apple. Piloti uses the home glyph, as its menu bar does.
function GnomeFootIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <ellipse cx="10.2" cy="2.6" rx="2.1" ry="2.5" />
      <ellipse cx="6.4" cy="2.9" rx="1.2" ry="1.5" />
      <ellipse cx="3.9" cy="4.6" rx="1" ry="1.3" />
      <ellipse cx="2.4" cy="7.2" rx="0.9" ry="1.1" />
      <path d="M9.3 6.2c2.4 0 3.6 1.3 3.2 3-.4 1.600-2 1.900-2.100 3.500-.100 1.700-1 3.300-2.800 3.300-2 0-2.900-1.800-2.700-3.700-1.100-.500-1.700-1.600-1.300-2.900.6-2 3-3.200 5.700-3.200Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M11 0c.1 1.8-1.3 3.4-3 3.4C7.800 1.7 9.300.1 11 0Z" />
      <path d="M8 4.600c.800 0 1.700-.8 3.100-.7 1.100.1 2.100.6 2.700 1.500-2.300 1.400-1.900 4.600.400 5.600-.8 2.200-2.200 5-3.900 5-.9 0-1.300-.6-2.400-.6s-1.600.6-2.4.6C3.300 16 1.4 12.500 1.4 9.400c0-3.500 2.100-5.500 4-5.500 1.200 0 1.900.7 2.600.7Z" />
    </svg>
  );
}

const THEMES = [
  { id: "piloti", label: "Piloti", Icon: HouseIcon },
  { id: "adwaita", label: "Adwaita", Icon: GnomeFootIcon },
  { id: "cupertino", label: "Cupertino", Icon: AppleIcon },
] as const;

export function PilotiDemoApp() {
  const settings = useDesktopSettings(["interfaceTheme", "themeMode"]);
  const updateSettings = useUpdateSettings();
  const [page, setPage] = React.useState<PageId>("controls");

  const sidebarItems: SidebarItem[] = PAGES.map((p) => ({
    id: p.id,
    label: _(p.label),
    icon: p.icon,
    selected: page === p.id,
    onClick: () => setPage(p.id),
  }));

  const theme = THEMES.find((t) => t.id === settings.interfaceTheme) ?? THEMES[0];

  const switches = (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" keepIcon aria-label={_("Theme")} />}>
          <theme.Icon />
          {theme.label}
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={theme.id}
            onValueChange={(id) =>
              updateSettings({
                interfaceTheme: id as (typeof THEMES)[number]["id"],
                iconTheme: id === "adwaita" ? "Adwaita" : "Piloti",
              })
            }
          >
            {THEMES.map(({ id, label, Icon }) => (
              <DropdownMenuRadioItem key={id} value={id}>
                <Icon />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Segmented
        iconOnly
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
    <AppSplitView
      title={_("Piloti demo")}
      iconName="sparkles"
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-[176px]"
      sidebarId="piloti-demo-sidebar"
      contentClassName="bg-ui-window"
      header={
        <HeaderBar>
          <HeaderBar.Start>
            <HeaderHeading>{_(PAGES.find((p) => p.id === page)?.label ?? "")}</HeaderHeading>
          </HeaderBar.Start>
          <HeaderBar.End>{switches}</HeaderBar.End>
        </HeaderBar>
      }
    >
      {({ onContentScroll }) => (
        <div onScroll={onContentScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {page === "elements" && <ElementsPage />}
          {page === "controls" && <ControlsPage />}
          {page === "menus" && <MenusPage />}
          {page === "text" && <TextPage />}
          {page === "tokens" && <TokensPage />}
          {page === "icons" && <IconsPage />}
        </div>
      )}
    </AppSplitView>
  );
}
