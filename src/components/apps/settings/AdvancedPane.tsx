import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { FolderOpenIcon, PlusIcon, PuzzleIcon, RefreshCwIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useWindowActions } from "@/context/DesktopStateContext";
import { usePlugins } from "@/context/PluginsContext";
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
} from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSettings } from "@/context/DesktopStateContext";

export function AdvancedPane() {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { launchApp } = useWindowActions();
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
    useWatch(domicile.extensions, "change", () => domicile.extensions.list) ??
    [];

  const [unpackedPaths, setUnpackedPaths] = React.useState<string[]>([]);
  const [webStoreIds, setWebStoreIds] = React.useState<string[]>([]);
  const [newExtInput, setNewExtInput] = React.useState("");
  const [extConfigNote, setExtConfigNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isBrowserRuntime) return;
    let cancelled = false;
    domicile.files
      .readText(".config/domicile/config.json")
      .then((res) => {
        if (cancelled) return;
        res.match({
          Ok: (text) => {
            const parsed = JSON.parse(text) as {
              extensions?: { unpacked?: string[]; web_store?: string[] };
            };
            setUnpackedPaths(parsed.extensions?.unpacked ?? []);
            setWebStoreIds(parsed.extensions?.web_store ?? []);
          },
          Err: () => undefined,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [domicile.files, isBrowserRuntime]);

  const saveDomicileExtensionsConfig = async (
    nextUnpacked: string[],
    nextWebStore: string[]
  ) => {
    try {
      await domicile.files.createDir(".config/domicile").catch(() => undefined);
      let existing: Record<string, unknown> = {};
      const readRes = await domicile.files
        .readText(".config/domicile/config.json")
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
      await domicile.files.write(
        ".config/domicile/config.json",
        JSON.stringify(updated, null, 2) + "\n"
      );
      setUnpackedPaths(nextUnpacked);
      setWebStoreIds(nextWebStore);
      setExtConfigNote(
        _("Saved to ~/.config/domicile/config.json. Restart Domicile to apply.")
      );
    } catch {
      setExtConfigNote(_("Could not write ~/.config/domicile/config.json."));
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
  const systemLanguageName = systemLocale === "fr" ? "Français" : "English";
  const defaultLabel = `${_("Default")} (${systemLanguageName})`;

  const languageItems = [
    { value: "default" as const, label: defaultLabel },
    { value: "en" as const, label: _("English") },
    { value: "fr" as const, label: _("French") },
  ];

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Advanced")}</GroupedFormSectionTitle>
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
                  if (val === "default" || val === "en" || val === "fr") {
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
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Computer Model")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="inline-flex rounded-lg bg-black/8 p-0.5 dark:bg-white/10">
                {(["pc", "mac"] as const).map((model) => {
                  const selected = settings.computerModel === model;
                  return (
                    <button
                      key={model}
                      type="button"
                      onClick={() => updateSettings({ computerModel: model })}
                      className={cn(
                        "rounded-md px-3 py-1 text-[12px] font-medium transition-all",
                        selected
                          ? "bg-white text-black shadow-xs dark:bg-white/16 dark:text-white"
                          : "text-adw-label-secondary hover:text-adw-label"
                      )}
                    >
                      {model === "mac" ? "Mac" : "PC"}
                    </button>
                  );
                })}
              </div>
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
        <GroupedFormSectionTitle>{_("Browser Extensions")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          {isBrowserRuntime ? (
            <>
              <GroupedFormRow>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>
                    {_("Demo Extension (Web Preview)")}
                  </GroupedFormRowTitle>
                  <GroupedFormRowDescription>
                    {_(
                      "Simulates a toolbar extension in Web windows. Real Chrome extensions run in native Domicile."
                    )}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
                <GroupedFormRowControl>
                  <Switch
                    checked={settings.demoExtensionEnabled !== false}
                    onCheckedChange={(checked) =>
                      updateSettings({ demoExtensionEnabled: checked })
                    }
                  />
                </GroupedFormRowControl>
              </GroupedFormRow>
              {settings.demoExtensionEnabled !== false && (
                <GroupedFormRow>
                  <GroupedFormRowLabel>
                    <div className="flex items-center gap-2">
                      <PuzzleIcon className="size-4 text-adw-accent" />
                      <GroupedFormRowTitle>
                        Piloti Demo Extension
                      </GroupedFormRowTitle>
                    </div>
                    <GroupedFormRowDescription>
                      {_("Manifest V3 sample also available in extensions/piloti-demo/")}
                    </GroupedFormRowDescription>
                  </GroupedFormRowLabel>
                  <GroupedFormRowControl className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        launchApp("nautilus", {
                          payload: "/home/user/.config/domicile",
                          forceNew: true,
                        })
                      }
                    >
                      <FolderOpenIcon className="mr-1 size-3.5" />
                      {_("Open Folder")}
                    </Button>
                    <span className="rounded-full bg-black/6 px-2 py-0.5 text-[11px] font-medium text-adw-label-secondary dark:bg-white/10">
                      {_("Active")}
                    </span>
                  </GroupedFormRowControl>
                </GroupedFormRow>
              )}
            </>
          ) : (
            <>
              <GroupedFormRow>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>
                    {_("Add Extension (Web Store ID or Unpacked Path)")}
                  </GroupedFormRowTitle>
                  <GroupedFormRowDescription>
                    {_(
                      "Configure extensions.unpacked or extensions.web_store in ~/.config/domicile/config.json"
                    )}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
                <GroupedFormRowControl className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      launchApp("nautilus", {
                        payload: "/home/user/.config/domicile",
                        forceNew: true,
                      })
                    }
                  >
                    <FolderOpenIcon className="mr-1 size-3.5" />
                    {_("Open Folder")}
                  </Button>
                  <input
                    type="text"
                    value={newExtInput}
                    onChange={(e) => setNewExtInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddExtensionEntry();
                    }}
                    placeholder="/path/to/ext or Web Store ID"
                    className="h-7 w-48 rounded-md border border-adw-separator bg-black/4 px-2 text-xs text-adw-label outline-none focus:border-adw-accent dark:bg-white/6"
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
                        "Add a Chrome Web Store ID or unpacked path (e.g. extensions/piloti-demo/) above."
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
                          <PuzzleIcon className="size-4 text-adw-label-secondary" />
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
                        onClick={() => domicile.extensions.activate(ext.id)}
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
                        className="size-7 p-0 text-adw-label-secondary hover:text-destructive"
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
        <GroupedFormSectionTitle>{_("User Plugins")}</GroupedFormSectionTitle>
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
                className="h-7 px-2 text-xs"
                onClick={() =>
                  launchApp("nautilus", {
                    payload: "/home/user/.config/piloti/plugins",
                    forceNew: true,
                  })
                }
              >
                <FolderOpenIcon className="mr-1 size-3.5" />
                {_("Open Folder")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => void createSamplePlugin("css")}
              >
                <SparklesIcon className="mr-1 size-3" />
                {_("Sample CSS")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => void createSamplePlugin("js")}
              >
                <SparklesIcon className="mr-1 size-3" />
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
                      <span className="rounded-md bg-black/6 px-1.5 py-0.5 text-[10px] font-medium text-adw-label-secondary dark:bg-white/10">
                        {kindLabel}
                      </span>
                      {plugin.version && (
                        <span className="text-[11px] text-adw-label-secondary">
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
    </GroupedForm>
  );
}

