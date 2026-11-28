import { hostFiles } from "@/platform/shared/host-files";
import { VFS_HOME } from "@/platform/shared/vfs-home";
import * as React from "react";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { usePiloti } from "@/platform/shared/piloti";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  FolderOpenIcon,
  PlusIcon,
  PuzzleIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "@/ui/components/ui/symbols";
import {
  useWindowActions,
  useDesktopSettings,
  useUpdateSettings,
} from "@/ui/context/DesktopStateContext";
import { usePlugins } from "@/ui/context/PluginsContext";
import { Button } from "@/ui/components/ui/button";
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
} from "@/ui/components/ui/grouped-form";
import { Switch } from "@/ui/components/ui/switch";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import {
  CHROME_WEB_STORE_URL,
  RECOMMENDED_EXTENSIONS,
  SAMPLE_LOCAL_EXTENSION,
  isExtensionEnabled,
  normalizeExtensionsConfig,
  setExtensionEnabled,
} from "@/platform/shared/browser-extensions";

export function ExtensionsPane() {
  const piloti = usePiloti();
  const settings = useDesktopSettings(["darkReaderWebEnabled", "demoExtensionEnabled"]);
  const updateSettings = useUpdateSettings();
  const { systemServices } = useCapabilities();
  const { launchApp, openWebUrl } = useWindowActions();
  const {
    plugins: userPlugins,
    safeMode: pluginsSafeMode,
    loading: pluginsLoading,
    togglePlugin,
    reloadPlugin,
    refreshPlugins,
    createSamplePlugin,
  } = usePlugins();
  const extensions =
    useWatch(piloti.extensions, "change", () => piloti.extensions.list) ??
    [];

  const [unpackedPaths, setUnpackedPaths] = React.useState<string[]>([]);
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

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Extensions")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                {_("Plugins Folder (~/.config/piloti/plugins/)")}
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {pluginsSafeMode
                  ? _("Safe mode active (?safe-mode=1): JS plugins are skipped.")
                  : systemServices
                    ? _("Drop a .css file or folder (manifest.json optional).")
                    : _("Drop a .css file, .js file, or folder (manifest.json optional).")}
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
                className="h-7 px-2 text-ui-body"
                onClick={() => void createSamplePlugin("css")}
              >
                {_("Sample CSS")}
              </Button>
              {!systemServices && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-ui-body"
                  onClick={() => void createSamplePlugin("js")}
                >
                  {_("Sample JS")}
                </Button>
              )}
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
                  {systemServices
                    ? _("Click Sample CSS above to create your first plugin.")
                    : _("Click Sample CSS or Sample JS above to create your first plugin.")}
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
                      : _("Manifest");
              return (
                <GroupedFormRow key={plugin.id}>
                  <GroupedFormRowLabel>
                    <div className="flex items-center gap-2">
                      <GroupedFormRowTitle>{plugin.name}</GroupedFormRowTitle>
                      {plugin.scope === "system" && (
                        <span className="rounded-ui-control bg-ui-accent/15 px-1.5 py-0.5 text-ui-caption font-medium text-ui-accent">
                          {_("System")}
                        </span>
                      )}
                      <span className="rounded-ui-control bg-black/6 px-1.5 py-0.5 text-ui-caption font-medium text-ui-label-secondary dark:bg-white/10">
                        {kindLabel}
                      </span>
                      {plugin.version && (
                        <span className="text-ui-small text-ui-label-secondary">
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
                className="h-7 gap-1.5 px-2.5 text-ui-body"
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
                    <PuzzleIcon className="size-4 text-ui-accent" />
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
                <PuzzleIcon className="size-4 text-ui-accent" />
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
                    placeholder={_("/path/to/ext or Web Store ID")}
                    className="h-7 w-48 rounded-ui-control border border-ui-separator bg-black/4 px-2 text-ui-body text-ui-label outline-none focus:border-ui-accent dark:bg-white/6"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-ui-body"
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
                          <PuzzleIcon className="size-4 text-ui-label-secondary" />
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
                        className="h-7 text-ui-body"
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
                      <GroupedFormRowTitle className="font-mono text-ui-body">
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
                        className="size-7 p-0 text-ui-label-secondary hover-fill:text-destructive"
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
    </GroupedForm>
  );
}
