import { hostFiles } from "@/lib/engine/host-files";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePiloti } from "@/lib/engine/piloti";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  FolderOpenIcon,
  PlusIcon,
  PuzzleIcon,
  RefreshCwIcon,
  Trash2Icon,
  UsbIcon,
} from "lucide-react";
import { useSystemBackends, useWindowActions } from "@/context/DesktopStateContext";
import { usePlugins } from "@/context/PluginsContext";
import {
  setXdgAppBadgeCount,
  setXdgAppProgress,
  setXdgAppUrgent,
} from "@/lib/xdg/xdg-badge-count";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  _,
  getLocalePreference,
  getSystemLocale,
  type LocalePreference,
  setLocale,
  subscribeLocale,
} from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { useSettings } from "@/context/DesktopStateContext";
import { DEFAULT_HIDDEN_GNOME_PANELS } from "@/lib/engine-native";
import {
  buildAutostartOverrideDesktopContent,
  mergeAutostartEntries,
  parseAutostartDesktopFile,
  type XdgAutostartEntry,
} from "@/lib/xdg/xdg-autostart";
import { listVfsDir, writeVfsTextFile } from "@/lib/engine-web/web-vfs";
import { WEB_VFS_HOME } from "@/lib/core/vfs-paths";
import {
  CHROME_WEB_STORE_URL,
  RECOMMENDED_EXTENSIONS,
  SAMPLE_LOCAL_EXTENSION,
  isExtensionEnabled,
  normalizeExtensionsConfig,
  setExtensionEnabled,
} from "@/lib/engine/browser-extensions";
import { getEngine } from "@/lib/engine/engine";
import {
  SIMULATED_USB_PATH,
  toggleSimulatedUsb,
  useSimulatedUsbMounted,
} from "@/lib/engine-web/usb-drive";

export function AdvancedPane() {
  const progressDemoTimerRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearInterval(progressDemoTimerRef.current), []);
  const piloti = usePiloti();
  const { settings, updateSettings } = useSettings();
  const { systemServices } = useCapabilities();
  const usbMounted = useSimulatedUsbMounted();
  const effectiveEngine = getEngine().kind;
  const { launchApp, openWebUrl } = useWindowActions();
  const { pushNotification } = useSystemBackends();
  const {
    plugins: userPlugins,
    safeMode: pluginsSafeMode,
    loading: pluginsLoading,
    togglePlugin,
    reloadPlugin,
    refreshPlugins,
    createSamplePlugin,
  } = usePlugins();
  const [preference, setPreference] = React.useState<LocalePreference>(() =>
    getLocalePreference()
  );

  const extensions =
    useWatch(piloti.extensions, "change", () => piloti.extensions.list) ??
    [];

  const [unpackedPaths, setUnpackedPaths] = React.useState<string[]>([]);
  const [autostartEntries, setAutostartEntries] = React.useState<XdgAutostartEntry[]>([]);

  const loadAutostart = React.useCallback(async () => {
    const userDir = `${WEB_VFS_HOME}/.config/autostart`;
    if (!systemServices) {
      const userFiles = listVfsDir(userDir).filter(
        (e) => e.kind === "file" && e.name.endsWith(".desktop")
      );
      const parsed = userFiles
        .map((e) =>
          parseAutostartDesktopFile(e.name, e.path, e.content ?? "", "user")
        )
        .filter((x): x is XdgAutostartEntry => Boolean(x));
      setAutostartEntries(mergeAutostartEntries([], parsed));
      return;
    }
    const readDirEntries = async (dir: string, source: "user" | "system") => {
      const list = await hostFiles(piloti).readDir(dir).then((r) =>
        r.match({ Ok: (items) => items, Err: () => [] })
      );
      const out: XdgAutostartEntry[] = [];
      for (const item of list) {
        if (!item.name.endsWith(".desktop")) continue;
        const full = `${dir}/${item.name}`;
        const raw = await hostFiles(piloti).readText(full).then((r) =>
          r.match({ Ok: (txt) => txt, Err: () => "" })
        );
        const parsed = parseAutostartDesktopFile(item.name, full, raw, source);
        if (parsed) out.push(parsed);
      }
      return out;
    };
    const [sys, usr] = await Promise.all([
      readDirEntries("/etc/xdg/autostart", "system"),
      readDirEntries(".config/autostart", "user"),
    ]);
    setAutostartEntries(mergeAutostartEntries(sys, usr));
  }, [piloti, systemServices]);

  React.useEffect(() => {
    void loadAutostart();
  }, [loadAutostart]);

  const toggleAutostart = React.useCallback(
    async (entry: XdgAutostartEntry, enabled: boolean) => {
      const content = buildAutostartOverrideDesktopContent(entry, enabled);
      if (!systemServices) {
        writeVfsTextFile(`${WEB_VFS_HOME}/.config/autostart/${entry.id}`, content);
      } else {
        await hostFiles(piloti).createDir(".config/autostart");
        await hostFiles(piloti).write(
          `.config/autostart/${entry.id}`,
          new TextEncoder().encode(content)
        );
      }
      await loadAutostart();
    },
    [piloti, systemServices, loadAutostart]
  );
  const [webStoreIds, setWebStoreIds] = React.useState<string[]>([]);
  const [newExtInput, setNewExtInput] = React.useState("");
  const [extConfigNote, setExtConfigNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!systemServices) return;
    let cancelled = false;
    hostFiles(piloti)
      .readText(".config/piloti/domicile.json")
      .then((res) => {
        if (cancelled) return;
        res.match({
          Ok: (text) => {
            const parsed = JSON.parse(text) as {
              extensions?: { unpacked?: string[]; web_store?: string[] };
            };
            const normalized = normalizeExtensionsConfig(parsed.extensions);
            setUnpackedPaths(normalized.unpacked);
            setWebStoreIds(normalized.web_store);
          },
          Err: () => undefined,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [piloti, systemServices]);

  const saveDomicileExtensionsConfig = async (
    nextUnpacked: string[],
    nextWebStore: string[]
  ) => {
    try {
      await hostFiles(piloti).createDir(".config/piloti").catch(() => undefined);
      let existing: Record<string, unknown> = {};
      const readRes = await hostFiles(piloti)
        .readText(".config/piloti/domicile.json")
        .catch(() => null);
      if (readRes) {
        readRes.match({
          Ok: (text) => {
            try {
              existing = JSON.parse(text) as Record<string, unknown>;
            } catch {
              existing = {};
            }
          },
          Err: () => undefined,
        });
      }
      const prevExt =
        (existing.extensions as Record<string, unknown> | undefined) ?? {};
      const updated = {
        ...existing,
        extensions: {
          ...prevExt,
          unpacked: nextUnpacked,
          web_store: nextWebStore,
        },
      };
      await hostFiles(piloti).write(
        ".config/piloti/domicile.json",
        JSON.stringify(updated, null, 2) + "\n"
      );
      setUnpackedPaths(nextUnpacked);
      setWebStoreIds(nextWebStore);
      setExtConfigNote(
        _("Saved to ~/.config/piloti/domicile.json. Restart Domicile to apply.")
      );
    } catch {
      setExtConfigNote(_("Could not write ~/.config/piloti/domicile.json."));
    }
  };

  const handleAddExtensionEntry = () => {
    const val = newExtInput.trim();
    if (!val) return;
    const isPath = val.includes("/") || val.startsWith("~") || val.startsWith(".");
    if (isPath) {
      if (!unpackedPaths.includes(val)) {
        void saveDomicileExtensionsConfig([...unpackedPaths, val], webStoreIds);
      }
    } else if (!webStoreIds.includes(val)) {
      void saveDomicileExtensionsConfig(unpackedPaths, [...webStoreIds, val]);
    }
    setNewExtInput("");
  };

  React.useEffect(() => {
    return subscribeLocale(() => {
      setPreference(getLocalePreference());
    });
  }, []);

  const systemLocale = getSystemLocale();
  const systemLanguageName =
    systemLocale === "fr"
      ? "Français"
      : systemLocale === "es"
        ? "Español"
        : "English";
  const defaultLabel = `${_("Default")} (${systemLanguageName})`;

  const languageItems = [
    { value: "default" as const, label: defaultLabel },
    { value: "en" as const, label: _("English") },
    { value: "fr" as const, label: _("French") },
    { value: "es" as const, label: _("Spanish") },
  ];

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("System")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Language")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={preference}
                items={languageItems}
                onValueChange={(val) => {
                  if (val === "default" || val === "en" || val === "fr" || val === "es") {
                    setLocale(val);
                    setPreference(getLocalePreference());
                  }
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{defaultLabel}</SelectItem>
                  <SelectSeparator />
                  <SelectItem value="en">{_("English")}</SelectItem>
                  <SelectItem value="fr">{_("French")}</SelectItem>
                  <SelectItem value="es">{_("Spanish")}</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Debug mode")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_("Show the desktop as it loads, to profile startup")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked) => updateSettings({ debugMode: Boolean(checked) })}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("File Extension Badges")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.showFileExtensionBadges !== false}
                onCheckedChange={(checked) =>
                  updateSettings({ showFileExtensionBadges: checked })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Web extensions")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Chrome Web Store")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_("Browse and install Chrome extensions directly from the store.")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() =>
                  openWebUrl(CHROME_WEB_STORE_URL, {
                    asApp: true,
                    title: "Chrome Web Store",
                  })
                }
              >
                {_("Open Chrome Web Store")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          {RECOMMENDED_EXTENSIONS.map((rec) => {
            const nativeEnabled = isExtensionEnabled(
              { unpacked: unpackedPaths, web_store: webStoreIds },
              "web_store",
              rec.webStoreId
            );
            const checked = !systemServices
              ? rec.id === "dark-reader" && Boolean(settings.darkReaderWebEnabled)
              : nativeEnabled;
            const disabled = !systemServices && rec.webMode === "unavailable";
            return (
              <GroupedFormRow key={rec.id}>
                <GroupedFormRowLabel>
                  <div className="flex items-center gap-2">
                    <PuzzleIcon className="size-4 text-shell-accent" />
                    <GroupedFormRowTitle>{rec.name}</GroupedFormRowTitle>
                  </div>
                  <GroupedFormRowDescription>
                    {!systemServices
                      ? rec.webMode === "simulated"
                        ? _("%s (Simulated in Web mode via dark filter)", _(rec.description))
                        : _("%s (Requires native Domicile; Web Store ID: %s)", _(rec.description), rec.webStoreId)
                      : `${_(rec.description)} (${rec.webStoreId})`}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
                <GroupedFormRowControl>
                  <Switch
                    disabled={disabled}
                    checked={checked}
                    onCheckedChange={(next) => {
                      if (!systemServices) {
                        if (rec.id === "dark-reader") {
                          updateSettings({ darkReaderWebEnabled: next });
                        }
                        return;
                      }
                      const updated = setExtensionEnabled(
                        { unpacked: unpackedPaths, web_store: webStoreIds },
                        "web_store",
                        rec.webStoreId,
                        next
                      );
                      void saveDomicileExtensionsConfig(
                        updated.unpacked,
                        updated.web_store
                      );
                    }}
                  />
                </GroupedFormRowControl>
              </GroupedFormRow>
            );
          })}

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <div className="flex items-center gap-2">
                <PuzzleIcon className="size-4 text-shell-accent" />
                <GroupedFormRowTitle>
                  {SAMPLE_LOCAL_EXTENSION.name}
                </GroupedFormRowTitle>
              </div>
              <GroupedFormRowDescription>
                {_(
                  "Sample local Manifest V3 extension (%s)",
                  SAMPLE_LOCAL_EXTENSION.path
                )}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label={_("Open Folder")}
                title={_("Open Folder")}
                className="size-7 p-0"
                onClick={() =>
                  launchApp("nautilus", {
                    payload: SAMPLE_LOCAL_EXTENSION.path,
                    forceNew: true,
                  })
                }
              >
                <FolderOpenIcon className="size-3.5" />
              </Button>
              <Switch
                checked={
                  !systemServices
                    ? settings.demoExtensionEnabled !== false
                    : isExtensionEnabled(
                        { unpacked: unpackedPaths, web_store: webStoreIds },
                        "unpacked",
                        SAMPLE_LOCAL_EXTENSION.path
                      )
                }
                onCheckedChange={(next) => {
                  if (!systemServices) {
                    updateSettings({ demoExtensionEnabled: next });
                    return;
                  }
                  const updated = setExtensionEnabled(
                    { unpacked: unpackedPaths, web_store: webStoreIds },
                    "unpacked",
                    SAMPLE_LOCAL_EXTENSION.path,
                    next
                  );
                  void saveDomicileExtensionsConfig(
                    updated.unpacked,
                    updated.web_store
                  );
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          {systemServices && (
            <>
              <GroupedFormRow>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>
                    {_("Add Extension (Web Store ID or Unpacked Path)")}
                  </GroupedFormRowTitle>
                  <GroupedFormRowDescription>
                    {_(
                      "Configure extensions.unpacked or extensions.web_store in ~/.config/piloti/domicile.json"
                    )}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
                <GroupedFormRowControl className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={_("Open Folder")}
                    title={_("Open Folder")}
                    className="size-7 p-0"
                    onClick={() =>
                      launchApp("nautilus", {
                        payload: `${VFS_HOME}/.config/piloti`,
                        forceNew: true,
                      })
                    }
                  >
                    <FolderOpenIcon className="size-3.5" />
                  </Button>
                  <input
                    type="text"
                    value={newExtInput}
                    onChange={(e) => setNewExtInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddExtensionEntry();
                    }}
                    placeholder="/path/to/ext or Web Store ID"
                    className="h-7 w-48 rounded-shell-control border border-shell-separator bg-black/4 px-2 text-xs text-shell-label outline-none focus:border-shell-accent dark:bg-white/6"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={handleAddExtensionEntry}
                  >
                    <PlusIcon className="mr-1 size-3.5" />
                    {_("Add")}
                  </Button>
                </GroupedFormRowControl>
              </GroupedFormRow>

              {extensions.length === 0 ? (
                <GroupedFormRow>
                  <GroupedFormRowLabel>
                    <GroupedFormRowTitle>
                      {_("No Active Browser Extensions")}
                    </GroupedFormRowTitle>
                    <GroupedFormRowDescription>
                      {_(
                        "Add a Chrome Web Store ID or unpacked path (e.g. /usr/share/piloti/extensions/piloti-demo) above."
                      )}
                    </GroupedFormRowDescription>
                  </GroupedFormRowLabel>
                </GroupedFormRow>
              ) : (
                extensions.map((ext) => (
                  <GroupedFormRow key={ext.id}>
                    <GroupedFormRowLabel>
                      <div className="flex items-center gap-2">
                        {ext.icon ? (
                          <img
                            src={ext.icon}
                            alt=""
                            className="size-4 rounded-[3px] object-contain"
                          />
                        ) : (
                          <PuzzleIcon className="size-4 text-shell-label-secondary" />
                        )}
                        <GroupedFormRowTitle>{ext.name}</GroupedFormRowTitle>
                      </div>
                      <GroupedFormRowDescription>
                        {ext.id}
                      </GroupedFormRowDescription>
                    </GroupedFormRowLabel>
                    <GroupedFormRowControl>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        disabled={!ext.enabled}
                        onClick={() => piloti.extensions.activate(ext.id)}
                      >
                        {_("Activate")}
                      </Button>
                    </GroupedFormRowControl>
                  </GroupedFormRow>
                ))
              )}

              {[...unpackedPaths.map((p) => ({ kind: "unpacked" as const, value: p })), ...webStoreIds.map((id) => ({ kind: "web_store" as const, value: id }))].map(
                (entry) => (
                  <GroupedFormRow key={`${entry.kind}:${entry.value}`}>
                    <GroupedFormRowLabel>
                      <GroupedFormRowTitle className="font-mono text-xs">
                        {entry.value}
                      </GroupedFormRowTitle>
                      <GroupedFormRowDescription>
                        {entry.kind === "unpacked"
                          ? _("Unpacked extension")
                          : _("Chrome Web Store ID")}
                      </GroupedFormRowDescription>
                    </GroupedFormRowLabel>
                    <GroupedFormRowControl>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0 text-shell-label-secondary hover-fill:text-destructive"
                        onClick={() => {
                          if (entry.kind === "unpacked") {
                            void saveDomicileExtensionsConfig(
                              unpackedPaths.filter((p) => p !== entry.value),
                              webStoreIds
                            );
                          } else {
                            void saveDomicileExtensionsConfig(
                              unpackedPaths,
                              webStoreIds.filter((id) => id !== entry.value)
                            );
                          }
                        }}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </GroupedFormRowControl>
                  </GroupedFormRow>
                )
              )}

              {extConfigNote && (
                <GroupedFormRow>
                  <GroupedFormRowLabel>
                    <GroupedFormRowDescription>
                      {extConfigNote}
                    </GroupedFormRowDescription>
                  </GroupedFormRowLabel>
                </GroupedFormRow>
              )}
            </>
          )}
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Desktop plugins")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                {_("Plugins Folder (~/.config/piloti/plugins/)")}
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {pluginsSafeMode
                  ? _("Safe mode active (?safe-mode=1): JS plugins are skipped.")
                  : _(
                      "Drop a .css file, .js file, or folder (manifest.json optional)."
                    )}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                aria-label={_("Open Folder")}
                title={_("Open Folder")}
                className="size-7 p-0"
                onClick={() =>
                  launchApp("nautilus", {
                    payload: `${VFS_HOME}/.config/piloti/plugins`,
                    forceNew: true,
                  })
                }
              >
                <FolderOpenIcon className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => void createSamplePlugin("css")}
              >
                {_("Sample CSS")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => void createSamplePlugin("js")}
              >
                {_("Sample JS")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0"
                title={_("Refresh plugins")}
                disabled={pluginsLoading}
                onClick={() => void refreshPlugins()}
              >
                <RefreshCwIcon
                  className={cn("size-3.5", pluginsLoading && "animate-spin")}
                />
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>

          {userPlugins.length === 0 ? (
            <GroupedFormRow>
              <GroupedFormRowLabel>
                <GroupedFormRowTitle>
                  {_("No User Plugins Found")}
                </GroupedFormRowTitle>
                <GroupedFormRowDescription>
                  {_(
                    "Click Sample CSS or Sample JS above to create your first plugin."
                  )}
                </GroupedFormRowDescription>
              </GroupedFormRowLabel>
            </GroupedFormRow>
          ) : (
            userPlugins.map((plugin) => {
              const kindLabel =
                plugin.stylePath && plugin.scriptPath
                  ? "CSS + JS"
                  : plugin.stylePath
                    ? "CSS"
                    : plugin.scriptPath
                      ? "JS"
                      : "Manifest";
              return (
                <GroupedFormRow key={plugin.id}>
                  <GroupedFormRowLabel>
                    <div className="flex items-center gap-2">
                      <GroupedFormRowTitle>{plugin.name}</GroupedFormRowTitle>
                      {plugin.scope === "system" && (
                        <span className="rounded-shell-control bg-shell-accent/15 px-1.5 py-0.5 text-shell-footnote font-medium text-shell-accent">
                          {_("System")}
                        </span>
                      )}
                      <span className="rounded-shell-control bg-black/6 px-1.5 py-0.5 text-shell-footnote font-medium text-shell-label-secondary dark:bg-white/10">
                        {kindLabel}
                      </span>
                      {plugin.version && (
                        <span className="text-shell-subheadline text-shell-label-secondary">
                          v{plugin.version}
                        </span>
                      )}
                    </div>
                    <GroupedFormRowDescription>
                      {plugin.error ? (
                        <span className="text-destructive">{plugin.error}</span>
                      ) : (
                        plugin.description || plugin.entryPath
                      )}
                    </GroupedFormRowDescription>
                  </GroupedFormRowLabel>
                  <GroupedFormRowControl className="flex items-center gap-2">
                    {plugin.enabled && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0"
                        title={_("Reload plugin")}
                        onClick={() => void reloadPlugin(plugin.id)}
                      >
                        <RefreshCwIcon className="size-3.5" />
                      </Button>
                    )}
                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={(checked) =>
                        togglePlugin(plugin.id, checked)
                      }
                    />
                  </GroupedFormRowControl>
                </GroupedFormRow>
              );
            })
          )}
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Startup services")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          {autostartEntries.length === 0 ? (
            <GroupedFormRow>
              <GroupedFormRowLabel>
                <GroupedFormRowTitle>{_("No XDG autostart entries")}</GroupedFormRowTitle>
                <GroupedFormRowDescription>
                  {_("Entries in ~/.config/autostart/*.desktop and /etc/xdg/autostart appear here.")}
                </GroupedFormRowDescription>
              </GroupedFormRowLabel>
            </GroupedFormRow>
          ) : (
            autostartEntries.map((entry) => (
              <GroupedFormRow key={entry.id}>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>{entry.name}</GroupedFormRowTitle>
                  <GroupedFormRowDescription>
                    {entry.comment || entry.exec || entry.id}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
                <GroupedFormRowControl>
                  <Switch
                    checked={entry.enabled}
                    onCheckedChange={(checked) =>
                      void toggleAutostart(entry, Boolean(checked))
                    }
                  />
                </GroupedFormRowControl>
              </GroupedFormRow>
            ))
          )}
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Testing")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Full GNOME Settings")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_(
                  "Show all GNOME Control Center panels instead of hiding panels already managed by Piloti Settings."
                )}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                aria-label={_("Full GNOME Settings")}
                checked={settings.hiddenGnomePanels.length === 0}
                onCheckedChange={(checked) =>
                  updateSettings({
                    hiddenGnomePanels: checked
                      ? []
                      : [...DEFAULT_HIDDEN_GNOME_PANELS],
                  })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Runtime Engine")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_("Active engine: %s.", `engine:${effectiveEngine}`)}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Simulated USB Pen Drive")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {usbMounted
                  ? _("Mounted at %s", SIMULATED_USB_PATH)
                  : _("Simulate plugging in a removable USB flash drive")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                type="button"
                size="sm"
                variant={usbMounted ? "outline" : "default"}
                className="gap-1.5"
                onClick={toggleSimulatedUsb}
              >
                <UsbIcon className="size-3.5" />
                {usbMounted ? _("Eject USB Drive") : _("Mount USB Drive")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Send Test Notification")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={!settings.notificationsEnabled}
                onClick={() =>
                  pushNotification({
                    appName: "Piloti System",
                    summary: "Wayland Compositor Synced",
                    body: `Workspace ${settings.activeWorkspace} active · Volume ${settings.volume}%`,
                    actions: [
                      {
                        key: "notifications-settings",
                        label: "Notification Settings",
                      },
                    ],
                  })
                }
              >
                {_("Normal")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!settings.notificationsEnabled}
                onClick={() =>
                  pushNotification({
                    appName: "System Monitor",
                    summary: "Critical Battery / Alert Preview",
                    body: "Urgent notifications stay pinned until you dismiss them.",
                    urgency: "critical",
                  })
                }
              >
                {_("Urgent")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Dock Badge & Progress")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const count = Math.floor(Math.random() * 9) + 1;
                  setXdgAppBadgeCount("app-store", count);
                }}
              >
                {_("Badge")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // One demo run at a time; cleared on unmount.
                  window.clearInterval(progressDemoTimerRef.current);
                  let p = 0;
                  progressDemoTimerRef.current = window.setInterval(() => {
                    p += 0.1;
                    if (p >= 1) {
                      window.clearInterval(progressDemoTimerRef.current);
                      setXdgAppProgress("app-store", undefined);
                    } else {
                      setXdgAppProgress("app-store", p);
                    }
                  }, 120);
                }}
              >
                {_("Progress")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setXdgAppProgress("app-store", null);
                  window.setTimeout(() => setXdgAppProgress("app-store", undefined), 2200);
                }}
              >
                {_("Indeterminate")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setXdgAppUrgent("app-store", true)}
              >
                {_("Attention")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Dock Folder Stack")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const current = settings.dockFolders ?? [];
                  const testFolder = `${VFS_HOME}/Documents`;
                  if (!current.includes(testFolder)) {
                    updateSettings({ dockFolders: [...current, testFolder] });
                  }
                }}
              >
                {_("Dock Documents")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

