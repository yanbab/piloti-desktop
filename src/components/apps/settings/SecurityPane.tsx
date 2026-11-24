import { HeaderSearch } from "@/components/ui/header-search";
import { SettingsHeaderActions } from "./header-slot";
import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { ChevronDownIcon, SearchIcon, ShieldCheckIcon } from "lucide-react";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
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
import { Switch } from "@/components/ui/switch";
import { useApps, useSettings } from "@/context/DesktopStateContext";
import { APP_CATALOG } from "@/data/catalog";
import {
  getAppSecurityPrefs,
  readAppPermissionsMap,
  writeAppPermissionsMap,
  type AppPermissionsMap,
} from "@/lib/core/app-permissions";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import {
  DEFAULT_FLATPAK_PERMISSIONS,
  getFlatpakPermissions,
  listInstalledFlatpaks,
  setFlatpakPermissionOverride,
  type FlatpakPermissionsState,
} from "@/lib/engine-native/flatpak";
import { readVfsStateJson, VFS_STATE_PATHS } from "@/lib/engine/vfs-state";

interface SecurityAppEntry {
  id: string;
  name: string;
  subtitle: string;
  isFlatpak: boolean;
  iconUrl?: string;
}

const FLATPAK_PERMISSION_ITEMS: {
  key: keyof FlatpakPermissionsState;
  label: string;
  description: string;
}[] = [
  {
    key: "network",
    label: "Network Access",
    description: "Allow connecting to local networks and the internet",
  },
  {
    key: "homeFiles",
    label: "Home Folder",
    description: "Read and write files in your home directory",
  },
  {
    key: "hostFiles",
    label: "Host Filesystem",
    description: "Access system and external storage locations",
  },
  {
    key: "wayland",
    label: "Wayland Display",
    description: "Render windows on the Wayland compositor",
  },
  {
    key: "audio",
    label: "Audio & Microphone",
    description: "Play sound and access PipeWire / PulseAudio",
  },
  {
    key: "devices",
    label: "Devices & USB",
    description: "Access webcams, gamepads, and hardware devices",
  },
];

export function SecurityPane() {
  const domicile = useDomicile();
  const { systemServices } = useCapabilities();
  const { installedXdgApps, getAppIconUrl } = useApps();

  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [groupBy, setGroupBy] = React.useState<"apps" | "permissions">("apps");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [expandedPermKey, setExpandedPermKey] = React.useState<string | null>(
    "notifications"
  );
  const [permsMap, setPermsMap] = React.useState<AppPermissionsMap>(() =>
    readAppPermissionsMap()
  );
  const [flatpakApps, setFlatpakApps] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [liveFlatpakPerms, setLiveFlatpakPerms] = React.useState<
    Record<string, FlatpakPermissionsState>
  >({});

  React.useEffect(() => {
    let active = true;
    if (!systemServices) {
      const meta = readVfsStateJson<{ installedFlatpakIds?: string[] }>(
        VFS_STATE_PATHS.appStoreMeta,
        "piloti.appstore.meta.v1"
      );
      const ids = Array.isArray(meta?.installedFlatpakIds)
        ? meta.installedFlatpakIds
        : [];
      setFlatpakApps(
        ids.map((id) => ({
          id,
          name: id.split(".").pop() || id,
        }))
      );
      return;
    }

    void listInstalledFlatpaks(domicile).then((list) => {
      if (!active) return;
      setFlatpakApps(list.map((entry) => ({ id: entry.appId, name: entry.name })));
    });
    return () => {
      active = false;
    };
  }, [domicile, systemServices]);

  const apps = React.useMemo<SecurityAppEntry[]>(() => {
    const byId = new Map<string, SecurityAppEntry>();
    for (const fp of flatpakApps) {
      byId.set(fp.id, {
        id: fp.id,
        name: fp.name,
        subtitle: fp.id,
        isFlatpak: true,
        iconUrl: getAppIconUrl(fp.id),
      });
    }
    for (const def of APP_CATALOG) {
      if (def.id === "desktop") continue;
      if (!byId.has(def.id)) {
        byId.set(def.id, {
          id: def.id,
          name: _(def.name),
          subtitle: def.command || def.id,
          isFlatpak: false,
          iconUrl: getAppIconUrl(def.id),
        });
      }
    }
    for (const xdg of installedXdgApps) {
      if (!byId.has(xdg.desktopId)) {
        byId.set(xdg.desktopId, {
          id: xdg.desktopId,
          name: xdg.name,
          subtitle: xdg.desktopId,
          isFlatpak: false,
          iconUrl: getAppIconUrl(xdg.desktopId),
        });
      }
    }
    const list = Array.from(byId.values());
    list.sort((a, b) => {
      if (a.isFlatpak !== b.isFlatpak) return a.isFlatpak ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [flatpakApps, getAppIconUrl, installedXdgApps]);

  const filteredApps = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(q) ||
        app.id.toLowerCase().includes(q) ||
        app.subtitle.toLowerCase().includes(q)
    );
  }, [apps, query]);

  const handleToggleExpand = (app: SecurityAppEntry) => {
    const nextId = expandedId === app.id ? null : app.id;
    setExpandedId(nextId);
    if (
      nextId &&
      app.isFlatpak &&
      systemServices &&
      !liveFlatpakPerms[app.id]
    ) {
      void getFlatpakPermissions(domicile, app.id).then((perms) => {
        setLiveFlatpakPerms((prev) => ({ ...prev, [app.id]: perms }));
      });
    }
  };

  const updateAppPref = (
    appId: string,
    patch: { notifications?: boolean; search?: boolean }
  ) => {
    setPermsMap((prev) => {
      const current = getAppSecurityPrefs(appId, prev);
      const next: AppPermissionsMap = {
        ...prev,
        [appId]: {
          ...current,
          ...patch,
        },
      };
      writeAppPermissionsMap(next);
      return next;
    });
  };

  const updateFlatpakPerm = (
    appId: string,
    key: keyof FlatpakPermissionsState,
    enabled: boolean
  ) => {
    setLiveFlatpakPerms((prev) => ({
      ...prev,
      [appId]: {
        ...(prev[appId] ?? DEFAULT_FLATPAK_PERMISSIONS),
        [key]: enabled,
      },
    }));
    setPermsMap((prev) => {
      const current = getAppSecurityPrefs(appId, prev);
      const next: AppPermissionsMap = {
        ...prev,
        [appId]: {
          ...current,
          flatpak: {
            ...(current.flatpak ?? {}),
            [key]: enabled,
          },
        },
      };
      writeAppPermissionsMap(next);
      return next;
    });
    if (systemServices) {
      void setFlatpakPermissionOverride(domicile, appId, key, enabled);
    }
  };

  return (
    <GroupedForm>
      {/* Switcher and search live in the Settings headerbar. */}
      <SettingsHeaderActions>
        <div className="inline-flex shrink-0 rounded-adw-item bg-black/8 p-0.5 dark:bg-white/10" data-slot="segmented">
          {(["apps", "permissions"] as const).map((mode) => {
            const selected = groupBy === mode;
            return (
              <button
                key={mode}
                type="button"
                data-slot="segmented-item"
                aria-pressed={selected}
                onClick={() => setGroupBy(mode)}
                className={cn(
                  "rounded-adw-control px-3 py-0.5 text-adw-callout font-medium transition-all",
                  selected
                    ? "bg-white text-black shadow-xs dark:bg-white/16 dark:text-white"
                    : "text-adw-label-secondary"
                )}
              >
                {mode === "apps" ? _("Apps") : _("Permissions")}
              </button>
            );
          })}
        </div>
        <HeaderSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          query={query}
          onQueryChange={setQuery}
          placeholder={_("Search apps…")}
        />
      </SettingsHeaderActions>

      <GroupedFormSection>
        <GroupedFormSectionTitle>
          {_("App Permissions & Privacy")}
        </GroupedFormSectionTitle>
        {filteredApps.length === 0 ? (
          <GroupedFormGroup>
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center text-adw-label-tertiary">
              <ShieldCheckIcon className="size-6 opacity-60" />
              <div className="text-adw-callout font-medium">
                {_("No matching apps found")}
              </div>
            </div>
          </GroupedFormGroup>
        ) : groupBy === "permissions" ? (
          <div className="space-y-2.5">
            {(
              [
                {
                  key: "notifications",
                  label: "Notifications",
                  description: "Allow apps to post desktop notifications",
                  flatpakOnly: false,
                },
                {
                  key: "search",
                  label: "Show in Search",
                  description: "Include apps in Launcher search results",
                  flatpakOnly: false,
                },
                ...FLATPAK_PERMISSION_ITEMS.map((item) => ({
                  ...item,
                  flatpakOnly: true,
                })),
              ] as const
            ).map((perm) => {
              const isOpen = expandedPermKey === perm.key;
              const targetApps = perm.flatpakOnly
                ? filteredApps.filter((a) => a.isFlatpak)
                : filteredApps;
              return (
                <GroupedFormGroup key={perm.key}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPermKey(isOpen ? null : perm.key)
                    }
                    aria-expanded={isOpen}
                    data-slot="settings-list-row"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                      isOpen
                        ? "bg-black/4 dark:bg-white/6"
                        : "hover-fill:bg-black/3 dark:hover-fill:bg-white/4"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-adw-body font-semibold text-adw-label">
                          {_(perm.label)}
                        </span>
                        <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                          {targetApps.length}
                        </span>
                      </div>
                      <div className="truncate text-adw-subheadline text-adw-label-tertiary">
                        {_(perm.description)}
                      </div>
                    </div>
                    <ChevronDownIcon
                      className={cn(
                        "size-4 shrink-0 text-adw-label-tertiary transition-transform duration-150",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-adw-separator/70 border-t border-adw-separator/70">
                      {targetApps.length === 0 ? (
                        <div className="px-4 py-3 text-adw-callout text-adw-label-tertiary">
                          {_("No Flatpak apps installed")}
                        </div>
                      ) : (
                        targetApps.map((app) => {
                          const prefs = getAppSecurityPrefs(app.id, permsMap);
                          const fpState: FlatpakPermissionsState = {
                            ...DEFAULT_FLATPAK_PERMISSIONS,
                            ...(prefs.flatpak ?? {}),
                            ...(liveFlatpakPerms[app.id] ?? {}),
                          };
                          const checked =
                            perm.key === "notifications"
                              ? prefs.notifications
                              : perm.key === "search"
                                ? prefs.search
                                : fpState[perm.key];
                          return (
                            <GroupedFormRow key={app.id}>
                              <GroupedFormRowLabel>
                                <div className="flex items-center gap-2.5">
                                  <AppSquircleIcon
                                    iconUrl={app.iconUrl}
                                    className="size-6 shrink-0"
                                  />
                                  <GroupedFormRowTitle>
                                    {app.name}
                                  </GroupedFormRowTitle>
                                </div>
                              </GroupedFormRowLabel>
                              <GroupedFormRowControl>
                                <Switch
                                  checked={checked}
                                  onCheckedChange={(next) => {
                                    if (perm.key === "notifications") {
                                      updateAppPref(app.id, {
                                        notifications: Boolean(next),
                                      });
                                    } else if (perm.key === "search") {
                                      updateAppPref(app.id, {
                                        search: Boolean(next),
                                      });
                                    } else {
                                      updateFlatpakPerm(
                                        app.id,
                                        perm.key,
                                        Boolean(next)
                                      );
                                    }
                                  }}
                                />
                              </GroupedFormRowControl>
                            </GroupedFormRow>
                          );
                        })
                      )}
                    </div>
                  )}
                </GroupedFormGroup>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredApps.map((app) => {
              const isOpen = expandedId === app.id;
              const prefs = getAppSecurityPrefs(app.id, permsMap);
              const fpState: FlatpakPermissionsState = {
                ...DEFAULT_FLATPAK_PERMISSIONS,
                ...(prefs.flatpak ?? {}),
                ...(liveFlatpakPerms[app.id] ?? {}),
              };
              return (
                <GroupedFormGroup key={app.id}>
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(app)}
                    aria-expanded={isOpen}
                    data-slot="settings-list-row"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                      isOpen
                        ? "bg-black/4 dark:bg-white/6"
                        : "hover-fill:bg-black/3 dark:hover-fill:bg-white/4"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AppSquircleIcon
                        iconUrl={app.iconUrl}
                        className="size-8 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-adw-body font-semibold text-adw-label">
                            {app.name}
                          </span>
                          {app.isFlatpak && (
                            <span className="rounded-full bg-adw-accent/15 px-1.5 py-0.5 text-adw-footnote font-medium text-adw-accent">
                              Flatpak
                            </span>
                          )}
                        </div>
                        <div className="truncate text-adw-subheadline text-adw-label-tertiary">
                          {app.subtitle}
                        </div>
                      </div>
                    </div>
                    <ChevronDownIcon
                      className={cn(
                        "size-4 shrink-0 text-adw-label-tertiary transition-transform duration-150",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-adw-separator/70 border-t border-adw-separator/70">
                      <GroupedFormRow>
                        <GroupedFormRowLabel>
                          <GroupedFormRowTitle>
                            {_("Notifications")}
                          </GroupedFormRowTitle>
                          <GroupedFormRowDescription>
                            {_("Allow this app to post desktop notifications")}
                          </GroupedFormRowDescription>
                        </GroupedFormRowLabel>
                        <GroupedFormRowControl>
                          <Switch
                            checked={prefs.notifications}
                            onCheckedChange={(checked) =>
                              updateAppPref(app.id, {
                                notifications: Boolean(checked),
                              })
                            }
                          />
                        </GroupedFormRowControl>
                      </GroupedFormRow>

                      <GroupedFormRow>
                        <GroupedFormRowLabel>
                          <GroupedFormRowTitle>
                            {_("Show in Search")}
                          </GroupedFormRowTitle>
                          <GroupedFormRowDescription>
                            {_("Include this app in Launcher search results")}
                          </GroupedFormRowDescription>
                        </GroupedFormRowLabel>
                        <GroupedFormRowControl>
                          <Switch
                            checked={prefs.search}
                            onCheckedChange={(checked) =>
                              updateAppPref(app.id, { search: Boolean(checked) })
                            }
                          />
                        </GroupedFormRowControl>
                      </GroupedFormRow>

                      {app.isFlatpak &&
                        FLATPAK_PERMISSION_ITEMS.map((perm) => (
                          <GroupedFormRow key={perm.key}>
                            <GroupedFormRowLabel>
                              <GroupedFormRowTitle>
                                {_(perm.label)}
                              </GroupedFormRowTitle>
                              <GroupedFormRowDescription>
                                {_(perm.description)}
                              </GroupedFormRowDescription>
                            </GroupedFormRowLabel>
                            <GroupedFormRowControl>
                              <Switch
                                checked={fpState[perm.key]}
                                onCheckedChange={(checked) =>
                                  updateFlatpakPerm(
                                    app.id,
                                    perm.key,
                                    Boolean(checked)
                                  )
                                }
                              />
                            </GroupedFormRowControl>
                          </GroupedFormRow>
                        ))}
                    </div>
                  )}
                </GroupedFormGroup>
              );
            })}
          </div>
        )}
      </GroupedFormSection>
    </GroupedForm>
  );
}

