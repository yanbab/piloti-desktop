import { HeaderBar } from "@/components/elements/header-bar";
import { Segmented } from "@/components/ui/segmented";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useDisplays } from "@domicile-desktop/react/displays";
import { usePiloti } from "@/lib/engine/piloti";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  AppWindowIcon,
  BellIcon,
  GaugeIcon,
  ChevronRightIcon,
  CpuIcon,
  DatabaseIcon,
  LayoutGridIcon,
  Maximize2Icon,
  MinusIcon,
  MonitorIcon,
  ScrollTextIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { ObjectView, themeGitHubLight, themeOneDark } from "react-obj-view";
import "react-obj-view/dist/react-obj-view.css";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { InlineCompletionInput } from "@/components/ui/inline-completion-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getWebAppFaviconUrl } from "@/data/web-apps";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import {
  abbreviateDataImageUri,
  evaluateReplCode,
  formatInspectValue,
  clearConsoleEntries,
  type ConsoleLogLevel,
  useConsoleEntries,
} from "@/lib/core/console-store";
import { parseIniText } from "@/lib/config/piloti-ini";
import { _ } from "@/lib/core/i18n";
import { getRenderCounts, resetRenderCounts } from "@/lib/core/render-stats";
import { cn } from "@/lib/core/utils";
import {
  WEB_VFS_CHANGED_EVENT,
  getVfsSnapshotEntries,
  getWebVfsPerfStats,
  listWebVfsBackingStorageEntries,
  resetWebVfsPerfStats,
  type WebVfsPerfStats,
} from "@/lib/engine-web/web-vfs";
import { type WebVfsEntry } from "@/lib/core/vfs-paths";
import {
  parseVfsStateString,
  readVfsStateString,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateString,
  listVfsStateFiles,
} from "@/lib/engine/vfs-state";

export type ConsoleModuleId =
  | "logs"
  | "inspector"
  | "storage"
  | "vfs-events";

type InspectorSectionId =
  | "windows"
  | "displays"
  | "system"
  | "apps"
  | "settings"
  | "state"
  | "notifications"
  | "performance";

/** Live web-VFS persistence counters (writes, coalesced flushes, listener fan-out). */
function VfsPerformanceSection() {
  const [stats, setStats] = React.useState<WebVfsPerfStats>(() => getWebVfsPerfStats());
  const [renders, setRenders] = React.useState(() => getRenderCounts());
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setStats(getWebVfsPerfStats());
      setRenders(getRenderCounts());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = Math.max(1 / 60, (Date.now() - stats.startedAt) / 60_000);
  const avgFlush = stats.flushes > 0 ? stats.totalFlushMs / stats.flushes : 0;
  const delivered = stats.listenerCalls + stats.listenerSkips;
  const tiles = [
    { label: _("VFS writes / min"), value: (stats.writes / minutes).toFixed(1) },
    { label: _("Storage flushes / min"), value: (stats.flushes / minutes).toFixed(1) },
    {
      label: _("Writes per flush"),
      value: stats.flushes > 0 ? (stats.writes / stats.flushes).toFixed(1) : "—",
    },
    { label: _("Last flush"), value: `${stats.lastFlushMs.toFixed(1)} ms` },
    { label: _("Average flush"), value: `${avgFlush.toFixed(1)} ms` },
    { label: _("VFS JSON size"), value: `${(stats.lastJsonChars / 1024).toFixed(0)} KB` },
    { label: _("Listener wake-ups"), value: stats.listenerCalls },
    {
      label: _("Skipped by path filter"),
      value: delivered > 0 ? `${stats.listenerSkips} (${Math.round((stats.listenerSkips / delivered) * 100)}%)` : "0",
    },
    { label: _("Reloads from other windows"), value: stats.reloads },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-adw-callout text-adw-label-secondary">
          {_("Since %s", new Date(stats.startedAt).toLocaleTimeString())}
        </span>
        <button
          type="button"
          onClick={() => {
            resetWebVfsPerfStats();
            resetRenderCounts();
            setStats(getWebVfsPerfStats());
            setRenders(getRenderCounts());
          }}
          className="rounded-adw-control bg-black/6 px-2.5 py-1 text-adw-subheadline font-medium text-adw-label hover-fill:bg-black/10 dark:bg-white/10 dark:hover-fill:bg-white/15"
        >
          {_("Reset")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tiles.map((stat) => (
          <div
            key={stat.label}
            className="rounded-adw-group bg-adw-group px-3.5 py-2.5"
          >
            <div className="text-adw-subheadline font-medium text-adw-label-secondary">{stat.label}</div>
            <div className="mt-0.5 truncate font-mono text-[14px] font-semibold text-adw-label">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
      <InspectorJsonCard
        title={_("Component renders")}
        data={renders}
        themeMode={document.documentElement.classList.contains("dark") ? "dark" : "light"}
        count={Object.keys(renders).length}
      />
    </div>
  );
}

function InspectorJsonCard({
  title,
  data,
  themeMode,
  expandLevel = 1,
  count,
}: {
  title: string;
  data: unknown;
  themeMode: string;
  expandLevel?: number;
  count?: number;
}) {
  const isObject = typeof data === "object" && data !== null;
  return (
    <div className="overflow-hidden rounded-adw-group bg-adw-group">
      <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
        <span className="text-adw-callout font-semibold text-adw-label">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
            {count}
          </span>
        )}
      </div>
      <div className="p-3">
        {isObject ? (
          <ObjectView
            valueGetter={() => data}
            name={title}
            expandLevel={expandLevel}
            style={
              {
                ...(themeMode === "light" ? themeGitHubLight : themeOneDark),
                backgroundColor: "transparent",
                "--bigobjview-bg-color": "transparent",
                fontSize: "12px",
              } as React.CSSProperties
            }
          />
        ) : (
          <pre className="font-mono text-adw-callout text-adw-label-secondary select-text">
            {String(data ?? "null")}
          </pre>
        )}
      </div>
    </div>
  );
}


function InspectorModule() {
  const piloti = usePiloti();
  const displays = useDisplays() ?? [];
  const { settings } = useSettings();
  const { systemServices } = useCapabilities();
  const {
    installedXdgApps,
    xdgUserDirs,
    activeIconTheme,
    dockIconsReady,
    getAppIconUrl,
  } = useApps();
  const {
    availableGnomePanels,
    audioSinks,
    batteryInfo,
    gnomeCapabilities,
    mprisMedia,
    notifications,
  } = useSystemBackends();
  const { windows, focusedWindowId, waylandPopups } = useWindowManager();
  const browserWindows =
    useWatch(piloti.browser, "change", () => piloti.browser.windows) ?? [];

  const [activeSection, setActiveSection] =
    React.useState<InspectorSectionId>("windows");
  const [expandedStatePath, setExpandedStatePath] = React.useState<string | null>(
    null
  );
  const inspectorSidebarRef = React.useRef<HTMLElement | null>(null);
  const inspectorContentRef = React.useRef<HTMLDivElement | null>(null);

  const sections: { id: InspectorSectionId; label: string; icon: React.ReactNode }[] = [
    { id: "windows", label: "Windows", icon: <AppWindowIcon className="size-4 shrink-0" /> },
    { id: "displays", label: "Displays", icon: <MonitorIcon className="size-4 shrink-0" /> },
    { id: "system", label: "System Backends", icon: <CpuIcon className="size-4 shrink-0" /> },
    { id: "apps", label: "Installed Apps", icon: <LayoutGridIcon className="size-4 shrink-0" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="size-4 shrink-0" /> },
    { id: "state", label: "State", icon: <DatabaseIcon className="size-4 shrink-0" /> },
    { id: "notifications", label: "Notifications", icon: <BellIcon className="size-4 shrink-0" /> },
    { id: "performance", label: _("Performance"), icon: <GaugeIcon className="size-4 shrink-0" /> },
  ];

  const {
    highlightedId: highlightedSection,
    onSidebarKeyDown: onInspectorSidebarKeyDown,
    onSidebarKeyUp: onInspectorSidebarKeyUp,
    onContentKeyDown: onInspectorContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: sections.map((s) => s.id),
    activeId: activeSection,
    onActivate: (id) => setActiveSection(id),
    sidebarRef: inspectorSidebarRef,
    contentRef: inspectorContentRef,
  });

  const renderSectionTables = () => {
    switch (activeSection) {
      case "windows": {
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: _("Focused"), value: focusedWindowId ?? "—" },
                { label: _("Windows"), value: windows.length },
                { label: _("Wayland Popups"), value: waylandPopups.length },
                { label: _("Browser Windows"), value: browserWindows.length },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-adw-group bg-adw-group px-3.5 py-2.5"
                >
                  <div className="text-adw-subheadline font-medium text-adw-label-secondary">
                    {stat.label}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[14px] font-semibold text-adw-label">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-adw-group bg-adw-group">
              <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
                <span className="text-adw-callout font-semibold text-adw-label">
                  {_("Windows")}
                </span>
                <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                  {windows.length}
                </span>
              </div>
              {windows.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-adw-callout text-adw-label-tertiary">
                  {_("No open windows.")}
                </div>
              ) : (
                <div className="divide-y divide-adw-separator">
                  {windows.map((w) => {
                    const flags = [
                      w.id === focusedWindowId ? "focused" : null,
                      w.minimized ? "minimized" : null,
                      w.maximized ? "maximized" : null,
                      w.fullscreen ? "fullscreen" : null,
                      w.tiled ? `tiled:${w.tiled}` : null,
                    ].filter((f): f is string => Boolean(f));
                    return (
                      <div
                        key={w.id}
                        className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover-fill:bg-black/3 dark:hover-fill:bg-white/4"
                      >
                        <AppSquircleIcon
                          iconUrl={w.iconUrl ?? getAppIconUrl(w.appId)}
                          className="size-7 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-adw-callout font-semibold text-adw-label">
                              {w.title || w.appId}
                            </span>
                            <span className="rounded bg-black/6 px-1.5 py-0.5 font-mono text-adw-footnote text-adw-label-secondary dark:bg-white/10">
                              {w.appId}
                            </span>
                            {flags.map((flag) => (
                              <span
                                key={flag}
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-adw-footnote font-medium",
                                  flag === "focused"
                                    ? "bg-adw-accent/15 text-adw-accent"
                                    : "bg-black/6 text-adw-label-secondary dark:bg-white/10"
                                )}
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-adw-subheadline text-adw-label-tertiary">
                            <span>id: {w.id}</span>
                            <span>ws: {w.workspace}</span>
                            <span>
                              {w.size.width}×{w.size.height} @ {w.position.x},{w.position.y}
                            </span>
                            <span>z: {w.zIndex}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {waylandPopups.length > 0 && (
              <InspectorJsonCard
                title={_("Wayland Popups")}
                data={waylandPopups}
                themeMode={settings.themeMode}
                count={waylandPopups.length}
              />
            )}
            {browserWindows.length > 0 && (
              <InspectorJsonCard
                title={_("Browser Windows")}
                data={browserWindows}
                themeMode={settings.themeMode}
                count={browserWindows.length}
              />
            )}
          </div>
        );
      }
      case "displays":
        return (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-adw-group bg-adw-group">
              <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
                <span className="text-adw-callout font-semibold text-adw-label">
                  {_("Displays")}
                </span>
                <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                  {displays.length}
                </span>
              </div>
              {displays.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-adw-callout text-adw-label-tertiary">
                  {_("No displays reported.")}
                </div>
              ) : (
                <div className="divide-y divide-adw-separator">
                  {displays.map((d, idx) => {
                    const rec = d as unknown as Record<string, unknown>;
                    const x = rec.x ?? 0;
                    const y = rec.y ?? 0;
                    const w = rec.width ?? "—";
                    const h = rec.height ?? "—";
                    const name = String(rec.name ?? rec.model ?? rec.id ?? `Display ${idx + 1}`);
                    return (
                      <div
                        key={String(rec.id ?? idx)}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <MonitorIcon className="size-4 shrink-0 text-adw-label-secondary" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-adw-callout font-semibold text-adw-label">
                                {name}
                              </span>
                              {Boolean(rec.primary) && (
                                <span className="rounded-full bg-adw-accent/15 px-1.5 py-0.5 text-adw-footnote font-medium text-adw-accent">
                                  {_("Primary")}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-adw-subheadline text-adw-label-tertiary">
                              {String(w)}×{String(h)} @ {String(x)},{String(y)} · {String(rec.scale ?? 1)}×
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-adw-subheadline text-adw-label-tertiary">
                          {String(rec.id ?? "—")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {displays.length > 0 && (
              <InspectorJsonCard
                title={_("Display Descriptors")}
                data={displays}
                themeMode={settings.themeMode}
              />
            )}
          </div>
        );
      case "system":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                {
                  label: _("Runtime"),
                  value: !systemServices ? "Browser Harness" : "Domicile Wayland",
                },
                { label: _("Icon Theme"), value: activeIconTheme },
                {
                  label: _("Dock Icons"),
                  value: dockIconsReady ? _("Ready") : _("Loading"),
                },
                {
                  label: _("Wi-Fi"),
                  value: settings.wifiEnabled
                    ? settings.connectedWifi || _("Enabled")
                    : _("Disabled"),
                },
                { label: _("Audio Sinks"), value: audioSinks.length },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-adw-group bg-adw-group px-3.5 py-2.5"
                >
                  <div className="text-adw-subheadline font-medium text-adw-label-secondary">
                    {item.label}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-adw-callout font-semibold text-adw-label">
                    {String(item.value)}
                  </div>
                </div>
              ))}
            </div>
            {gnomeCapabilities && (
              <InspectorJsonCard
                title={_("GNOME Capabilities")}
                data={gnomeCapabilities}
                themeMode={settings.themeMode}
                expandLevel={2}
              />
            )}
            <InspectorJsonCard
              title={_("Battery & Power")}
              data={batteryInfo}
              themeMode={settings.themeMode}
              expandLevel={2}
            />
            <InspectorJsonCard
              title={_("MPRIS Media")}
              data={mprisMedia}
              themeMode={settings.themeMode}
              expandLevel={2}
            />
            <InspectorJsonCard
              title={_("Audio Sinks")}
              data={audioSinks}
              themeMode={settings.themeMode}
              count={audioSinks.length}
            />
          </div>
        );
      case "apps":
        return (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-adw-group bg-adw-group">
              <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
                <span className="text-adw-callout font-semibold text-adw-label">
                  {_("Installed XDG Apps")}
                </span>
                <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                  {installedXdgApps.length}
                </span>
              </div>
              {installedXdgApps.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-adw-callout text-adw-label-tertiary">
                  {_("No XDG apps indexed.")}
                </div>
              ) : (
                <div className="grid grid-cols-1 divide-y divide-adw-separator sm:grid-cols-2 sm:divide-y-0">
                  {installedXdgApps.map((a) => (
                    <div
                      key={a.desktopId}
                      className="flex items-center gap-3 border-b border-adw-separator/50 px-3.5 py-2.5 transition-colors hover-fill:bg-black/3 dark:hover-fill:bg-white/4"
                    >
                      <AppSquircleIcon
                        iconUrl={getAppIconUrl(a.desktopId)}
                        className="size-7 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-adw-callout font-semibold text-adw-label">
                          {a.name}
                        </div>
                        <div className="truncate font-mono text-adw-footnote text-adw-label-tertiary">
                          {a.desktopId}
                        </div>
                        {a.exec && (
                          <div className="truncate font-mono text-adw-footnote text-adw-label-secondary">
                            {a.exec}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-adw-group bg-adw-group">
              <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
                <span className="text-adw-callout font-semibold text-adw-label">
                  {_("Installed Web Apps")}
                </span>
                <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                  {settings.installedWebApps.length}
                </span>
              </div>
              {settings.installedWebApps.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-adw-callout text-adw-label-tertiary">
                  {_("No installed web apps.")}
                </div>
              ) : (
                <div className="divide-y divide-adw-separator">
                  {settings.installedWebApps.map((a) => {
                    const iconUrl =
                      (a.iconUrl && /^(https?:|data:|blob:|\/)/i.test(a.iconUrl)
                        ? a.iconUrl
                        : undefined) || getWebAppFaviconUrl(a.url);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover-fill:bg-black/3 dark:hover-fill:bg-white/4"
                      >
                        <AppSquircleIcon
                          iconUrl={iconUrl}
                          fallbackIconUrl={getAppIconUrl("browser")}
                          className="size-7 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-adw-callout font-semibold text-adw-label">
                              {a.title}
                            </span>
                            <span className="rounded bg-black/6 px-1.5 py-0.5 font-mono text-adw-footnote text-adw-label-secondary dark:bg-white/10">
                              {a.id}
                            </span>
                          </div>
                          <div className="truncate font-mono text-adw-subheadline text-adw-label-tertiary">
                            {a.url}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <InspectorJsonCard
              title={_("XDG User Dirs")}
              data={xdgUserDirs}
              themeMode={settings.themeMode}
              expandLevel={2}
            />

            <div className="overflow-hidden rounded-adw-group bg-adw-group">
              <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
                <span className="text-adw-callout font-semibold text-adw-label">
                  {_("Available GNOME Panels")}
                </span>
                <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                  {availableGnomePanels.length}
                </span>
              </div>
              {availableGnomePanels.length === 0 ? (
                <div className="px-3.5 py-4 text-adw-callout text-adw-label-tertiary">
                  {_("No GNOME panels detected.")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-3">
                  {availableGnomePanels.map((panel) => (
                    <span
                      key={panel.desktopId || panel.panelId}
                      className="rounded-adw-control bg-black/6 px-2 py-0.5 font-mono text-adw-subheadline text-adw-label dark:bg-white/10"
                    >
                      {panel.name || panel.panelId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case "settings":
        return (
          <InspectorJsonCard
            title={_("Settings")}
            data={settings}
            themeMode={settings.themeMode}
            expandLevel={2}
          />
        );
      case "state": {
        const stateRoots = [
          { label: "~/.config/piloti", prefix: `${VFS_HOME}/.config/piloti` },
          { label: "~/.local/state/piloti", prefix: `${VFS_HOME}/.local/state/piloti` },
          { label: "~/.local/share", prefix: `${VFS_HOME}/.local/share` },
          { label: "~/.cache/piloti", prefix: `${VFS_HOME}/.cache/piloti` },
        ];
        const allFiles = listVfsStateFiles().sort((a, b) => a.path.localeCompare(b.path));
        return (
          <div className="space-y-4">
            {stateRoots.map((group) => {
              const groupFiles = allFiles.filter(
                (f) =>
                  f.path === group.prefix ||
                  f.path.startsWith(`${group.prefix}/`)
              );
              return (
                <div
                  key={group.prefix}
                  className="overflow-hidden rounded-adw-group bg-adw-group"
                >
                  <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
                    <span className="font-mono text-adw-callout font-semibold text-adw-label">
                      {group.label}
                    </span>
                    <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                      {groupFiles.length}
                    </span>
                  </div>
                  {groupFiles.length === 0 ? (
                    <div className="px-3.5 py-4 text-adw-callout text-adw-label-tertiary">
                      {_("No files found.")}
                    </div>
                  ) : (
                    <div className="divide-y divide-adw-separator">
                      {groupFiles.map((file) => {
                        const isOpen = expandedStatePath === file.path;
                        const content = file.content ?? "";
                        let parsedObj: Record<string, unknown> | unknown[] | null =
                          null;
                        if (file.path.endsWith(".json")) {
                          try {
                            const parsed = JSON.parse(content);
                            if (typeof parsed === "object" && parsed !== null) {
                              parsedObj = parsed as Record<string, unknown>;
                            }
                          } catch {
                            // fallback to plain text
                          }
                        } else if (file.path.endsWith(".ini")) {
                          try {
                            parsedObj = parseIniText(content);
                          } catch {
                            // fallback
                          }
                        }
                        return (
                          <div key={file.path}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedStatePath(isOpen ? null : file.path)
                              }
                              className={cn(
                                "flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors",
                                isOpen
                                  ? "bg-black/4 dark:bg-white/6"
                                  : "hover-fill:bg-black/3 dark:hover-fill:bg-white/4"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-mono text-adw-subheadline font-medium text-adw-label">
                                  {file.path.slice(group.prefix.length + 1) || file.name}
                                </div>
                                <div className="font-mono text-adw-footnote text-adw-label-tertiary">
                                  {formatByteSize(content.length)} ·{" "}
                                  {file.updatedAt
                                    ? new Date(file.updatedAt).toLocaleString()
                                    : "—"}
                                </div>
                              </div>
                            </button>
                            {isOpen && (
                              <div className="border-t border-adw-separator/60 bg-black/[0.02] p-3 dark:bg-white/[0.02]">
                                {parsedObj ? (
                                  <ObjectView
                                    valueGetter={() => parsedObj}
                                    name={file.name}
                                    expandLevel={2}
                                    style={
                                      {
                                        ...(settings.themeMode === "light"
                                          ? themeGitHubLight
                                          : themeOneDark),
                                        backgroundColor: "transparent",
                                        "--bigobjview-bg-color": "transparent",
                                        fontSize: "12px",
                                      } as React.CSSProperties
                                    }
                                  />
                                ) : (
                                  <pre className="max-h-64 overflow-auto font-mono text-adw-subheadline break-words whitespace-pre-wrap text-adw-label select-text">
                                    {content || "—"}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
      case "performance":
        return <VfsPerformanceSection />;
      case "notifications":
        return (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-adw-group bg-adw-group">
              <div className="flex items-center justify-between border-b border-adw-separator px-3.5 py-2">
                <span className="text-adw-callout font-semibold text-adw-label">
                  {_("Notifications")}
                </span>
                <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                  {notifications.length}
                </span>
              </div>
              {notifications.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-adw-callout text-adw-label-tertiary">
                  {_("No notifications.")}
                </div>
              ) : (
                <div className="divide-y divide-adw-separator">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-3.5 py-2.5"
                    >
                      <AppSquircleIcon
                        iconUrl={
                          n.icon ||
                          (n.appName ? getAppIconUrl(n.appName.toLowerCase()) : undefined)
                        }
                        className="size-7 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-adw-callout font-semibold text-adw-label">
                              {n.summary}
                            </span>
                            {n.appName && (
                              <span className="rounded bg-black/6 px-1.5 py-0.5 text-adw-footnote text-adw-label-secondary dark:bg-white/10">
                                {n.appName}
                              </span>
                            )}
                            {n.urgency && (
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-adw-footnote font-medium",
                                  n.urgency === "critical"
                                    ? "bg-rose-500/15 text-rose-500"
                                    : "bg-black/6 text-adw-label-secondary dark:bg-white/10"
                                )}
                              >
                                {n.urgency}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-adw-footnote text-adw-label-tertiary">
                            {new Date(n.time).toLocaleTimeString()}
                          </span>
                        </div>
                        {n.body && (
                          <div className="mt-0.5 text-adw-callout text-adw-label-secondary">
                            {n.body}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {notifications.length > 0 && (
              <InspectorJsonCard
                title={_("Raw Notifications")}
                data={notifications}
                themeMode={settings.themeMode}
                count={notifications.length}
              />
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Settings-style Left Sidebar (collapses to VS Code-style icon bar when narrow) */}
      <TooltipProvider delay={450}>
        <aside
          ref={inspectorSidebarRef}
          onKeyDown={onInspectorSidebarKeyDown}
          onKeyUp={onInspectorSidebarKeyUp}
          className="flex min-h-0 w-[52px] shrink-0 flex-col space-y-1 overflow-x-hidden overflow-y-auto border-r border-adw-separator bg-adw-sidebar p-1.5 transition-[width] duration-150 sm:w-44 sm:p-2"
        >
          {sections.map((section) => {
            const active = highlightedSection === section.id;
            const btn = (
              <button
                key={section.id}
                type="button"
                aria-label={section.label}
                data-sidebar-item={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex w-full shrink-0 items-center gap-2.5 rounded-adw-item px-2.5 py-2 text-left text-adw-callout transition-colors",
                  active
                    ? "bg-adw-accent font-medium text-white shadow-xs"
                    : "font-normal text-adw-label/85 hover-fill:bg-black/5 dark:hover-fill:bg-white/6"
                )}
              >
                <span className="shrink-0 opacity-85">{section.icon}</span>
                <span className="truncate opacity-0 transition-opacity duration-150 sm:opacity-100">
                  {section.label}
                </span>
              </button>
            );
            return (
              <Tooltip key={section.id}>
                <TooltipTrigger render={btn} />
                <TooltipContent
                  side="right"
                  sideOffset={-36}
                  className={cn(
                    "pointer-events-none h-[34px] gap-2.5 rounded-adw-item border border-adw-separator px-2.5 py-2 text-adw-callout shadow-md sm:hidden",
                    active
                      ? "bg-adw-accent font-medium text-white shadow-xs"
                      : "bg-adw-sidebar font-normal text-adw-label"
                  )}
                >
                  <span className="shrink-0 opacity-85">{section.icon}</span>
                  <span className="whitespace-nowrap">{section.label}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </aside>
      </TooltipProvider>

      {/* Right Content: Structured Tables */}
      <div
        ref={inspectorContentRef}
        onKeyDown={onInspectorContentKeyDown}
        className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black/2 dark:bg-white/2"
      >
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {renderSectionTables()}
        </div>
      </div>
    </div>
  );
}

interface StorageEntry {
  key: string;
  rawValue: string;
  byteSize: number;
  isJson: boolean;
  formattedJson: string | null;
  parsedJson?: unknown;
}

function formatStorageKeyLabel(key: string): string {
  return key.replace(/^(?:piloti|residence)\./i, "").replace(/\.v\d+$/i, "");
}

interface DataImagePreview {
  label: string;
  src: string;
}

function isDataImageUri(val: string): boolean {
  return /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(val.trim());
}

function extractDataImages(entry: StorageEntry): DataImagePreview[] {
  const trimmed = entry.rawValue.trim();
  if (isDataImageUri(trimmed)) {
    return [{ label: entry.key, src: trimmed }];
  }
  if (!entry.isJson) return [];

  const found: DataImagePreview[] = [];
  const visit = (node: unknown, path: string) => {
    if (found.length >= 256) return;
    if (typeof node === "string") {
      if (isDataImageUri(node)) {
        found.push({ label: path || entry.key, src: node.trim() });
      }
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const [k, v] of Object.entries(node)) {
        visit(v, path ? `${path}.${k}` : k);
      }
    }
  };

  try {
    visit(JSON.parse(entry.rawValue), "");
  } catch {
    // ignore
  }
  return found;
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readLocalStorageEntries(): StorageEntry[] {
  const rawEntries = listWebVfsBackingStorageEntries();
  const encoder =
    typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const entries: StorageEntry[] = [];
  for (const item of rawEntries) {
    const { key, value: rawValue } = item;
    const byteSize = encoder ? encoder.encode(rawValue).length : rawValue.length;
    let isJson = false;
    let formattedJson: string | null = null;
    let parsedJson: unknown;
    try {
      const parsed: unknown = JSON.parse(rawValue);
      isJson = true;
      formattedJson = JSON.stringify(
        parsed,
        (_k, val) => (typeof val === "string" ? abbreviateDataImageUri(val) : val),
        2
      );
      parsedJson = JSON.parse(formattedJson);
    } catch {
      // Plain non-JSON string value
    }
    entries.push({ key, rawValue, byteSize, isJson, formattedJson, parsedJson });
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries;
}

type EventCategory = "log" | "vfs" | "shell" | "window";
type EventCategoryFilter = "all" | "issues" | EventCategory;

interface InspectorEventLog {
  id: number;
  /** Epoch ms of the last occurrence (events are merged with console logs by time). */
  ts: number;
  time: string;
  type: string;
  detail: string;
  category: EventCategory;
  level?: ConsoleLogLevel;
  count: number;
}

interface VfsDiffItem {
  kind: "added" | "modified" | "removed";
  path: string;
  entryType: "file" | "directory";
  sizeDelta?: number;
}

function readVfsSnapshotMap(): Map<string, WebVfsEntry> {
  const map = new Map<string, WebVfsEntry>();
  for (const entry of getVfsSnapshotEntries()) {
    if (entry?.path) map.set(entry.path, entry);
  }
  return map;
}

function VfsEventsModule({ active }: { active: boolean }) {
  const { windows, focusedWindowId } = useWindowManager();
  const [baseline, setBaseline] = React.useState<Map<string, WebVfsEntry>>(() =>
    readVfsSnapshotMap()
  );
  const [currentMap, setCurrentMap] = React.useState<Map<string, WebVfsEntry>>(
    () => readVfsSnapshotMap()
  );
  const [events, setEvents] = React.useState<InspectorEventLog[]>([]);
  const [filter, setFilter] = React.useState<EventCategoryFilter>("all");
  const [showDiffDrawer, setShowDiffDrawer] = React.useState(false);
  const nextEventIdRef = React.useRef(1);
  const prevWinSummaryRef = React.useRef<string>("");
  const eventsScrollRef = React.useRef<HTMLDivElement | null>(null);

  const pushEvent = React.useCallback(
    (
      type: string,
      detail: string,
      category: Exclude<EventCategory, "log">
    ) => {
      const ts = Date.now();
      const time = new Date(ts).toLocaleTimeString();
      setEvents((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.type === type && last.detail === detail) {
          return [
            ...prev.slice(0, -1),
            { ...last, count: last.count + 1, time, ts },
          ];
        }
        return [
          ...prev.slice(-199),
          { id: nextEventIdRef.current++, ts, time, type, detail, category, count: 1 },
        ];
      });
    },
    []
  );

  const logEntries = useConsoleEntries();
  const rows = React.useMemo(() => {
    const logRows = logEntries.map((entry) => ({
      id: -entry.id,
      ts: entry.timestamp,
      time: new Date(entry.timestamp).toLocaleTimeString(),
      type: entry.level,
      detail: entry.message,
      category: "log" as const,
      level: entry.level,
      count: entry.count,
    }));
    return [...events, ...logRows].sort((a, b) => a.ts - b.ts || b.id - a.id);
  }, [events, logEntries]);

  const filteredEvents = React.useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "issues") {
      return rows.filter((ev) => ev.level === "error" || ev.level === "warn");
    }
    return rows.filter((ev) => ev.category === filter);
  }, [rows, filter]);

  const lastFilteredCount = filteredEvents[filteredEvents.length - 1]?.count ?? 0;

  React.useEffect(() => {
    const el = eventsScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredEvents.length, lastFilteredCount, filter, active]);

  React.useEffect(() => {
    const summary = JSON.stringify({
      focusedWindowId,
      wins: windows.map((w) => ({
        id: w.id,
        appId: w.appId,
        ws: w.workspace,
        min: w.minimized,
        max: w.maximized,
      })),
    });
    if (prevWinSummaryRef.current && prevWinSummaryRef.current !== summary) {
      pushEvent(
        "WindowEvent",
        `focused=${focusedWindowId ?? "none"} count=${windows.length}`,
        "window"
      );
    }
    prevWinSummaryRef.current = summary;
  }, [focusedWindowId, pushEvent, windows]);

  React.useEffect(() => {
    const eventNames = [
      "piloti:app-action",
      "piloti:app-menu-state",
      "piloti:open-launcher",
      "piloti:workspace-zoom-from-thumb",
      "piloti:xdg-webapps-changed",
      "residence:file-drop-dock",
      "residence:file-drop-window",
      "residence:desktop-drop-position",
      WEB_VFS_CHANGED_EVENT,
    ];
    const listeners = eventNames.map((name) => {
      const fn = (e: Event) => {
        if (name === WEB_VFS_CHANGED_EVENT) {
          setCurrentMap(readVfsSnapshotMap());
        }
        const detail = (e as CustomEvent<unknown>).detail;
        let detailStr = "";
        try {
          detailStr = detail ? JSON.stringify(detail) : "";
        } catch {
          detailStr = String(detail);
        }
        pushEvent(
          name,
          detailStr.slice(0, 180),
          name === WEB_VFS_CHANGED_EVENT ? "vfs" : "shell"
        );
      };
      window.addEventListener(name, fn);
      return { name, fn };
    });
    return () => {
      for (const { name, fn } of listeners) {
        window.removeEventListener(name, fn);
      }
    };
  }, [pushEvent]);

  const diffs = React.useMemo<VfsDiffItem[]>(() => {
    const items: VfsDiffItem[] = [];
    for (const [path, cur] of currentMap.entries()) {
      const base = baseline.get(path);
      if (!base) {
        items.push({
          kind: "added",
          path,
          entryType: cur.kind,
          sizeDelta: cur.content?.length ?? 0,
        });
      } else if (
        base.content !== cur.content ||
        base.updatedAt !== cur.updatedAt
      ) {
        items.push({
          kind: "modified",
          path,
          entryType: cur.kind,
          sizeDelta: (cur.content?.length ?? 0) - (base.content?.length ?? 0),
        });
      }
    }
    for (const [path, base] of baseline.entries()) {
      if (!currentMap.has(path)) {
        items.push({
          kind: "removed",
          path,
          entryType: base.kind,
          sizeDelta: -(base.content?.length ?? 0),
        });
      }
    }
    return items.sort((a, b) => a.path.localeCompare(b.path));
  }, [baseline, currentMap]);

  const vfsEventsCount = React.useMemo(
    () =>
      events
        .filter((ev) => ev.category === "vfs")
        .reduce((sum, ev) => sum + ev.count, 0),
    [events]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-adw-content">
      {/* Unified Header Toolbar with Filter Pills */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-adw-separator bg-adw-window/60 px-4">
        <div className="flex shrink-0 items-center gap-1">
          {(
            [
              { id: "all", label: _("All") },
              { id: "log", label: _("Logs") },
              { id: "issues", label: _("Issues") },
              { id: "vfs", label: "VFS" },
              { id: "shell", label: _("Shell") },
              { id: "window", label: _("Window") },
            ] as const
          ).map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setFilter(pill.id)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-adw-subheadline font-medium transition-colors",
                filter === pill.id
                  ? "bg-adw-accent text-white"
                  : "bg-black/6 text-adw-label-secondary hover-fill:bg-black/10 hover-fill:text-adw-label dark:bg-white/8 dark:hover-fill:bg-white/14"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            title={`${_("VFS Diff")} (${diffs.length}) · ${_("VFS Events")} (${vfsEventsCount})`}
            onClick={() => setShowDiffDrawer((prev) => !prev)}
            className={cn(
              // One line; ellipsized when the toolbar is narrow.
              "min-w-0 truncate whitespace-nowrap rounded-full px-2.5 py-0.5 text-adw-subheadline font-medium transition-colors",
              showDiffDrawer
                ? "bg-adw-accent/15 text-adw-accent"
                : "bg-black/6 text-adw-label-secondary hover-fill:bg-black/10 hover-fill:text-adw-label dark:bg-white/8 dark:hover-fill:bg-white/14"
            )}
          >
            {_("VFS Diff")} ({diffs.length}) · {_("VFS Events")} ({vfsEventsCount})
          </button>
          <button
            type="button"
            onClick={() => {
              const snap = readVfsSnapshotMap();
              setBaseline(snap);
              setCurrentMap(snap);
            }}
            className="shrink-0 whitespace-nowrap rounded-adw-control bg-black/6 px-2 py-0.5 text-adw-subheadline font-medium text-adw-label transition-colors hover-fill:bg-black/12 dark:bg-white/8 dark:hover-fill:bg-white/14"
          >
            {_("Snapshot")}
          </button>
          <button
            type="button"
            onClick={() => {
              setEvents([]);
              clearConsoleEntries();
            }}
            className="shrink-0 whitespace-nowrap rounded-adw-control bg-black/6 px-2 py-0.5 text-adw-subheadline font-medium text-adw-label transition-colors hover-fill:bg-black/12 dark:bg-white/8 dark:hover-fill:bg-white/14"
          >
            {_("Clear")}
          </button>
        </div>
      </div>

      {showDiffDrawer && (
        <div className="max-h-44 shrink-0 overflow-y-auto border-b border-adw-separator bg-black/2 px-4 py-2 font-mono text-adw-subheadline dark:bg-white/2">
          {diffs.length === 0 ? (
            <div className="py-1 text-adw-dim">
              {_("No VFS changes since baseline (%d entries tracked).", currentMap.size)}
            </div>
          ) : (
            diffs.map((d) => (
              <div
                key={`${d.kind}:${d.path}`}
                className="flex items-center justify-between gap-2 rounded px-2 py-0.5 hover-fill:bg-black/5 dark:hover-fill:bg-white/5"
              >
                <span
                  className={cn(
                    "truncate",
                    d.kind === "added" && "text-emerald-500",
                    d.kind === "modified" && "text-amber-500",
                    d.kind === "removed" && "text-rose-500"
                  )}
                >
                  {d.kind === "added" ? "+ " : d.kind === "modified" ? "~ " : "- "}
                  {d.path}
                </span>
                {typeof d.sizeDelta === "number" && d.entryType === "file" && (
                  <span className="shrink-0 text-adw-footnote text-adw-dim">
                    {d.sizeDelta >= 0 ? `+${d.sizeDelta}B` : `${d.sizeDelta}B`}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Chronological Event Stream */}
      <div
        ref={eventsScrollRef}
        className="min-h-0 flex-1 overflow-y-auto font-mono text-adw-subheadline"
      >
        {filteredEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center font-sans text-xs text-adw-label-tertiary">
            {_("Listening for logs, VFS, Shell and Window events…")}
          </div>
        ) : (
          <div role="table" aria-label={_("Events")}>
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                role="row"
                className={cn(
                  "grid grid-cols-[4.75rem_3.5rem_minmax(0,9rem)_minmax(0,1fr)_2.25rem] items-baseline gap-x-3 border-b border-adw-separator/50 px-4 py-1 select-text",
                  ev.level === "error" && "bg-rose-500/8 text-rose-600 dark:text-rose-400",
                  ev.level === "warn" && "bg-amber-500/8 text-amber-700 dark:text-amber-300",
                  !ev.level || ev.level === "log" || ev.level === "info"
                    ? "hover-fill:bg-black/3 dark:hover-fill:bg-white/4"
                    : ""
                )}
              >
                <span className="text-adw-footnote text-adw-label-tertiary tabular-nums">{ev.time}</span>
                <span
                  className={cn(
                    "justify-self-start rounded px-1.5 py-0.5 text-[9.5px] leading-none font-semibold uppercase",
                    ev.category === "log" && "bg-black/8 text-adw-label-secondary dark:bg-white/10",
                    ev.category === "vfs" &&
                      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    ev.category === "window" && "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                    ev.category === "shell" && "bg-adw-accent/15 text-adw-accent"
                  )}
                >
                  {ev.category}
                </span>
                <span className="truncate font-semibold">{ev.type}</span>
                <span
                  className={cn(
                    "min-w-0",
                    ev.category === "log"
                      ? "break-words whitespace-pre-wrap"
                      : "truncate text-adw-label-secondary"
                  )}
                >
                  {ev.detail}
                </span>
                <span className="justify-self-end text-adw-footnote font-semibold text-adw-label-tertiary tabular-nums">
                  {ev.count > 1 ? ev.count : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StorageModule() {
  const { settings } = useSettings();
  const [entries, setEntries] = React.useState<StorageEntry[]>(() =>
    readLocalStorageEntries()
  );
  const [selectedKey, setSelectedKey] = React.useState<string | null>(
    () => entries[0]?.key ?? null
  );
  const storageSidebarRef = React.useRef<HTMLElement | null>(null);
  const storageContentRef = React.useRef<HTMLDivElement | null>(null);
  const {
    highlightedId: highlightedStorageKey,
    onSidebarKeyDown: onStorageSidebarKeyDown,
    onSidebarKeyUp: onStorageSidebarKeyUp,
    onContentKeyDown: onStorageContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: entries.map((e) => e.key),
    activeId: selectedKey ?? entries[0]?.key ?? null,
    onActivate: (key) => setSelectedKey(key),
    sidebarRef: storageSidebarRef,
    contentRef: storageContentRef,
  });

  const refresh = React.useCallback(() => {
    const next = readLocalStorageEntries();
    setEntries(next);
    setSelectedKey((prev) =>
      prev && next.some((item) => item.key === prev)
        ? prev
        : (next[0]?.key ?? null)
    );
  }, []);

  React.useEffect(() => {
    refresh();
    const handleStorage = () => refresh();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refresh]);

  const activeEntry = React.useMemo(
    () =>
      entries.find((entry) => entry.key === selectedKey) ??
      entries[0] ??
      null,
    [entries, selectedKey]
  );

  const activeDisplayValue = activeEntry
    ? activeEntry.formattedJson !== null
      ? activeEntry.formattedJson
      : abbreviateDataImageUri(activeEntry.rawValue)
    : "";

  const activeImages = React.useMemo(
    () => (activeEntry ? extractDataImages(activeEntry) : []),
    [activeEntry]
  );

  const groupedStorageEntries = React.useMemo(() => {
    // "piloti.web.vfs.favorites.v1" -> section "VFS", entry "Favorites".
    const ACRONYMS: Record<string, string> = { vfs: "VFS", xdg: "XDG", usb: "USB", ini: "INI" };
    const capitalize = (text: string): string => {
      const words = text.replace(/[-_]+/g, " ").trim();
      if (!words) return "";
      const lower = words.toLowerCase();
      return ACRONYMS[lower] ?? words.charAt(0).toUpperCase() + words.slice(1);
    };
    const classify = (key: string): { section: string; shortLabel: string } => {
      const bare = key
        .replace(/^(?:piloti|residence)[.-]/i, "")
        .replace(/^web[.-]/i, "")
        .replace(/\.v\d+$/i, "");
      const dot = bare.split(".").filter(Boolean);
      let head = dot[0] ?? bare;
      let rest = dot.slice(1).join(" ");
      if (dot.length <= 1) {
        const dash = head.indexOf("-");
        if (dash > 0) {
          rest = head.slice(dash + 1);
          head = head.slice(0, dash);
        }
      }
      return { section: capitalize(head) || "Other", shortLabel: capitalize(rest) || _("Default") };
    };

    const map = new Map<string, Array<{ entry: StorageEntry; shortLabel: string }>>();
    for (const entry of entries) {
      const { section, shortLabel } = classify(entry.key);
      const list = map.get(section) ?? [];
      list.push({ entry, shortLabel });
      map.set(section, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, items]) => ({ section, items }));
  }, [entries]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Split Explorer */}
      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-adw-label-secondary">
          <DatabaseIcon className="size-7 opacity-40" />
          <div className="text-adw-callout font-medium">
            {_("No keys stored in localStorage.")}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Left: Sectioned Sidebar with simple labels */}
          <aside
            ref={storageSidebarRef}
            onKeyDown={onStorageSidebarKeyDown}
            onKeyUp={onStorageSidebarKeyUp}
            className="w-40 shrink-0 space-y-3 overflow-y-auto border-r border-adw-separator bg-adw-sidebar p-2 sm:w-44"
          >
            {groupedStorageEntries.map((group) => (
              <div key={group.section} className="space-y-0.5">
                <div className="px-2.5 pb-1 text-adw-footnote font-semibold tracking-wider text-adw-dim uppercase">
                  {group.section}
                </div>
                {group.items.map(({ entry, shortLabel }) => {
                  const isSelected = highlightedStorageKey === entry.key;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      data-sidebar-item={entry.key}
                      onClick={() => setSelectedKey(entry.key)}
                      className={cn(
                        "flex w-full items-center rounded-adw-item px-3 py-1.5 text-left transition-colors",
                        isSelected
                          ? "bg-adw-accent font-medium text-white shadow-xs"
                          : "font-normal text-adw-label/85 hover-fill:bg-black/5 dark:hover-fill:bg-white/6"
                      )}
                    >
                      <span className="truncate text-adw-callout font-medium">
                        {shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Right: Selected Entry Value Inspector with small key header */}
          {activeEntry ? (
            <div
              ref={storageContentRef}
              onKeyDown={onStorageContentKeyDown}
              className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black/2 dark:bg-white/2"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-adw-separator bg-adw-window/60 px-4 py-1.5">
                <span className="truncate font-mono text-adw-subheadline font-medium text-adw-dim select-text">
                  {activeEntry.key}
                </span>
                <span className="shrink-0 font-mono text-adw-footnote text-adw-dim tabular-nums">
                  {activeEntry.rawValue.length} chars
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                {activeImages.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-3 border-b border-adw-separator pb-4">
                    {activeImages.map((img) => (
                      <div
                        key={img.label}
                        className="flex flex-col gap-1.5 rounded-adw-item bg-black/4 p-2 dark:bg-white/5"
                      >
                        <img
                          src={img.src}
                          alt={img.label}
                          className="max-h-[512px] max-w-[512px] rounded object-contain"
                        />
                        <span className="max-w-[512px] truncate font-mono text-adw-footnote text-adw-label-secondary">
                          {img.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {activeEntry.isJson &&
                typeof activeEntry.parsedJson === "object" &&
                activeEntry.parsedJson !== null ? (
                  <div className="rounded-adw-group bg-adw-group p-3.5">
                    <ObjectView
                      key={activeEntry.key}
                      valueGetter={() => activeEntry.parsedJson}
                      name={formatStorageKeyLabel(activeEntry.key)}
                      expandLevel={2}
                      style={
                        {
                          ...(settings.themeMode === "light"
                            ? themeGitHubLight
                            : themeOneDark),
                          backgroundColor: "transparent",
                          "--bigobjview-bg-color": "transparent",
                          fontSize: "12.5px",
                        } as React.CSSProperties
                      }
                    />
                  </div>
                ) : (
                  <pre className="rounded-adw-group bg-adw-group p-3.5 font-mono text-adw-callout leading-relaxed break-words whitespace-pre-wrap text-adw-label select-text">
                    {activeDisplayValue}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4 text-adw-callout text-adw-label-tertiary">
              {_("Select a key to inspect its stored state.")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConsoleApp({
  initialModule,
}: {
  initialModule?: string;
}) {
  const piloti = usePiloti();
  const { settings, updateSettings } = useSettings();
  const { systemServices } = useCapabilities();
  const { installedXdgApps } = useApps();
  const {
    availableGnomePanels,
    gnomeCapabilities,
    notifications,
    pushNotification,
  } = useSystemBackends();
  const {
    windows,
    focusedWindow,
    waylandPopups,
    launchApp,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    openGnomeSettings,
    openWebUrl,
  } = useWindowManager();

  const DEVTOOLS_ACTIVE_MODULE_KEY = "piloti.devtools.activeModule.v1";
  const isModuleId = (v: string | null | undefined): v is ConsoleModuleId =>
    v === "logs" || // legacy: merged into Events
    v === "inspector" ||
    v === "storage" ||
    v === "vfs-events";

  const [activeModule, setActiveModule] = React.useState<ConsoleModuleId>(
    () => {
      if (isModuleId(initialModule)) return initialModule === "logs" ? "vfs-events" : initialModule;
      try {
        const saved = readVfsStateString(
          VFS_STATE_PATHS.devtoolsModule,
          DEVTOOLS_ACTIVE_MODULE_KEY
        )?.trim();
        if (isModuleId(saved)) return saved === "logs" ? "vfs-events" : saved;
      } catch {
        // ignore storage errors
      }
      return "inspector";
    }
  );

  React.useEffect(() => {
    if (isModuleId(initialModule)) {
      setActiveModule(initialModule);
    }
  }, [initialModule]);

  React.useEffect(() => {
    return subscribeVfsPath(VFS_STATE_PATHS.devtoolsModule, (raw) => {
      const mod = parseVfsStateString(raw);
      if (isModuleId(mod)) {
        setActiveModule(mod);
      }
    });
  }, []);

  React.useEffect(() => {
    try {
      writeVfsStateString(VFS_STATE_PATHS.devtoolsModule, activeModule);
    } catch {
      // ignore storage errors
    }
  }, [activeModule]);

  const consoleEntries = useConsoleEntries();
  const errorCount = React.useMemo(
    () => consoleEntries.filter((e) => e.level === "error").length,
    [consoleEntries]
  );

  const modules: { id: ConsoleModuleId; label: string; badge?: number }[] = [
    { id: "inspector", label: _("Infos") },
    {
      id: "vfs-events",
      label: _("Events"),
      badge: errorCount > 0 ? errorCount : undefined,
    },
    { id: "storage", label: "Storage" },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label">
      {/* Header / Module Switcher */}
      <HeaderBar>
        <HeaderBar.Title interactive>
          <Segmented value={activeModule} onChange={setActiveModule} options={modules} />
        </HeaderBar.Title>
      </HeaderBar>

      {/* Active module (Events stays mounted so its log persists across tab switches) */}
      {activeModule === "inspector" && <InspectorModule />}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          activeModule === "vfs-events" ? "flex" : "hidden"
        )}
      >
        <VfsEventsModule active={activeModule === "vfs-events"} />
      </div>
      {activeModule === "storage" && <StorageModule />}
    </div>
  );
}

