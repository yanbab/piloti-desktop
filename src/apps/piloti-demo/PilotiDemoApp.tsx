import { ICON_SIZES } from "@/lib/files/icon-sizes";
import * as React from "react";
import { BoxesIcon } from "lucide-react";
import { BellIcon, ChevronDownIcon, FolderIcon, ImageIcon, MonitorIcon, MoonIcon, PaletteIcon, SlidersHorizontalIcon, SunIcon, TypeIcon, Volume2Icon } from "@/components/ui/symbols";
import { HeaderBar, HeaderHeading } from "@/components/elements/header-bar";
import { AppSplitView, type SidebarItem } from "@/components/elements/split-view";
import { ColorSamples } from "@/components/elements/color-samples";
import { ElementSample, ElementSampleList } from "@/components/elements/element-sample";
import { DialogsPage } from "@/apps/piloti-demo/DialogsPage";
import { ElementsPage } from "@/apps/piloti-demo/ElementsPage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Segmented } from "@/components/ui/segmented";
import {
  useApps,
  useDesktopSettings,
  useSettingsSelector,
  useUpdateSettings,
} from "@/context/DesktopStateContext";
import { AppSquircleIcon } from "@/components/common/AppSymbol";
import { APP_CATALOG } from "@/data/catalog";
import { _ } from "@/lib/core/i18n";

/**
 * Piloti demo: every shell element in one place, in the current interface
 * theme and colour mode (both switchable from the header), to check visual
 * consistency at a glance.
 */

type PageId = "elements" | "colors" | "icons" | "dialogs";

const PAGES: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "elements", label: "Elements", icon: <SlidersHorizontalIcon className="size-4" /> },
  { id: "colors", label: "Colors", icon: <PaletteIcon className="size-4" /> },
  { id: "icons", label: "Icons", icon: <ImageIcon className="size-4" /> },
  { id: "dialogs", label: "Dialogs", icon: <BellIcon className="size-4" /> },
];

const SYMBOLS = [
  ["FolderIcon", FolderIcon],
  ["BellIcon", BellIcon],
  ["SunIcon", SunIcon],
  ["MoonIcon", MoonIcon],
  ["MonitorIcon", MonitorIcon],
  ["Volume2Icon", Volume2Icon],
  ["PaletteIcon", PaletteIcon],
  ["TypeIcon", TypeIcon],
] as const;

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
    <ElementSampleList>
      <ElementSample
        title="Icon sizes"
        react={ICON_SIZES.map((size) => {
          const url = getAppIconUrl("piloti-demo");
          return (
            <div key={size} className="flex flex-col items-center gap-1.5">
              <span style={{ width: size, height: size }}>
                {url && <AppSquircleIcon iconUrl={url} className="size-full" />}
              </span>
              <span className="text-ui-caption tabular-nums text-ui-label-secondary">{size}</span>
            </div>
          );
        })}
        reactCode={ICON_SIZES.map((size) => `<AppSquircleIcon iconUrl={url} className="size-[${size}px]" />`).join("\n")}
      />
      <ElementSample
        title="App icons"
        react={APP_CATALOG.map((app) => renderIcon(app.id, _(app.shortName)))}
        reactCode={`const { getAppIconUrl } = useApps();

<AppSquircleIcon
  iconUrl={getAppIconUrl("${APP_CATALOG[0].id}")}
  className="size-12"
/>`}
      />
      <ElementSample
        title="Places & files"
        react={shellIcons.map((key) => renderIcon(key, key.replace(/^__|__$/g, "")))}
        reactCode={shellIcons.map((key) => `getAppIconUrl("${key}")`).join("\n")}
      />
      <ElementSample
        title="Symbols"
        react={SYMBOLS.map(([name, Icon]) => <Icon key={name} className="size-4" />)}
        reactCode={SYMBOLS.map(([name]) => `<${name} className="size-4" />`).join("\n")}
      />
    </ElementSampleList>
  );
}

const THEMES = [
  { id: "piloti", label: "Piloti" },
  { id: "adwaita", label: "Adwaita" },
  { id: "cupertino", label: "Cupertino" },
] as const;

export function PilotiDemoApp() {
  const settings = useDesktopSettings(["interfaceTheme"]);
  const resolvedTheme = useSettingsSelector((v) => v.resolvedTheme);
  const updateSettings = useUpdateSettings();
  const [page, setPage] = React.useState<PageId>("elements");

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
            {THEMES.map(({ id, label }) => (
              <DropdownMenuRadioItem key={id} value={id}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Segmented
        iconOnly
        value={resolvedTheme}
        onChange={(mode) => updateSettings({ themeMode: mode })}
        options={[
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
        <div key={page} onScroll={onContentScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {page === "elements" && <ElementsPage />}
          {page === "colors" && <ColorSamples />}
          {page === "icons" && <IconsPage />}
          {page === "dialogs" && <DialogsPage />}
        </div>
      )}
    </AppSplitView>
  );
}
