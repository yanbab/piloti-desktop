import { VFS_HOME } from "@/lib/engine/vfs-home";
import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { usePortalRequests } from "@domicile-desktop/react/portals";
import {
  CastSource,
  CastSourceKind,
  FileChooserMode,
  PortalAnswer,
  PortalKind,
  WallpaperTarget,
  type PortalRequest,
} from "@domicile-desktop/sdk/portal";
import { FileType } from "@domicile-desktop/sdk/system";
import {
  AlertTriangleIcon,
  AppWindowIcon,
  CameraIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  FileIcon,
  ImageIcon,
  KeyboardIcon,
  MonitorIcon,
  PipetteIcon,
  PrinterIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsbIcon,
  UserIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { useApps, useSettings } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { listVfsDir } from "@/lib/engine-web/web-vfs";
import { setDefaultMimeApp } from "@/lib/xdg/xdg-mimeapps";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";

function ScreenshotPortalOverlay({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.Screenshot }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const { frame, width, height, windows } = request.body;
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [dragEnd, setDragEnd] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [copyToClipboard, setCopyToClipboard] = React.useState(false);

  const selectionRect = React.useMemo(() => {
    if (!dragStart || !dragEnd) return null;
    const x = Math.min(dragStart.x, dragEnd.x);
    const y = Math.min(dragStart.y, dragEnd.y);
    const w = Math.abs(dragEnd.x - dragStart.x);
    const h = Math.abs(dragEnd.y - dragStart.y);
    return w > 8 && h > 8 ? { x, y, w, h } : null;
  }, [dragStart, dragEnd]);

  const mapToFrameCoords = (rect: { x: number; y: number; w: number; h: number }) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0, width, height };
    const bounds = img.getBoundingClientRect();
    const scaleX = width / (bounds.width || 1);
    const scaleY = height / (bounds.height || 1);
    return {
      x: Math.max(0, Math.round((rect.x - bounds.left) * scaleX)),
      y: Math.max(0, Math.round((rect.y - bounds.top) * scaleY)),
      width: Math.max(1, Math.min(width, Math.round(rect.w * scaleX))),
      height: Math.max(1, Math.min(height, Math.round(rect.h * scaleY))),
    };
  };

  return (
    <div className="fixed inset-0 z-[800] flex flex-col items-center justify-center bg-black/85 select-none">
      <div className="relative flex max-h-[82vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-adw-group border border-white/20 shadow-2xl">
        <img
          ref={imgRef}
          src={frame}
          alt="Desktop Screenshot Preview"
          draggable={false}
          onPointerDown={(e) => {
            setDragStart({ x: e.clientX, y: e.clientY });
            setDragEnd({ x: e.clientX, y: e.clientY });
          }}
          onPointerMove={(e) => {
            if (dragStart) setDragEnd({ x: e.clientX, y: e.clientY });
          }}
          onPointerUp={() => {
            // Keep selection visible until confirmed
          }}
          className="max-h-[80vh] max-w-[88vw] cursor-crosshair object-contain"
        />
        {selectionRect && (
          <div
            style={{
              left: `${selectionRect.x}px`,
              top: `${selectionRect.y}px`,
              width: `${selectionRect.w}px`,
              height: `${selectionRect.h}px`,
            }}
            className="pointer-events-none fixed border-2 border-sky-400 bg-sky-400/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          />
        )}
      </div>

      {/* Floating Capture Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-full bg-zinc-900/95 px-4 py-2 text-xs text-white shadow-xl ring-1 ring-white/15">
        <CameraIcon className="size-4 text-sky-400" />
        <span className="font-medium">Drag to select area</span>

        <label className="ml-2 flex cursor-default items-center gap-1.5 text-white/80">
          <input
            type="checkbox"
            checked={copyToClipboard}
            onChange={(e) => setCopyToClipboard(e.target.checked)}
          />
          Copy to Clipboard
        </label>

        {selectionRect && (
          <Button
            size="sm"
            onClick={() =>
              onAnswer(
                PortalAnswer.Screenshot(
                  mapToFrameCoords(selectionRect),
                  copyToClipboard
                )
              )
            }
          >
            Capture Selection
          </Button>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onAnswer(
              PortalAnswer.Screenshot(
                { x: 0, y: 0, width, height },
                copyToClipboard
              )
            )
          }
        >
          Entire Screen
        </Button>

        {windows.slice(0, 3).map((w) => (
          <Button
            key={w.id}
            size="sm"
            variant="secondary"
            onClick={() =>
              onAnswer(PortalAnswer.ScreenshotWindow(w.id, copyToClipboard))
            }
          >
            {w.title || w.appId || "Window"}
          </Button>
        ))}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAnswer(PortalAnswer.Canceled())}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ScreenCastPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.ScreenCast }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const [selected, setSelected] = React.useState<Set<number>>(
    () => new Set(request.body.sources.length > 0 ? [0] : [])
  );

  const toggleIndex = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(request.body.multiple ? prev : []);
      if (prev.has(idx) && request.body.multiple) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[460px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <VideoIcon className="size-5 text-adw-accent" />
          <div>
            <h3 className="text-[14px] font-bold">{_("Share Screen or Window")}</h3>
            <p className="text-adw-subheadline text-adw-label-secondary">
              {_("Requested by %s", request.appId || _("Application"))}
            </p>
          </div>
        </div>

        {request.body.desk && (
          <div className="mb-3 overflow-hidden rounded-adw-item border border-adw-separator/70 bg-black/30">
            <img
              src={request.body.desk.frame}
              alt={_("Desktop preview")}
              className="max-h-32 w-full object-contain"
              draggable={false}
            />
          </div>
        )}

        <div className="max-h-64 space-y-1.5 overflow-y-auto py-1">
          {request.body.sources.map((src, idx) => {
            const active = selected.has(idx);
            const label =
              src.kind === CastSourceKind.Monitor
                ? `${_("Display")}: ${src.description || src.name}`
                : src.kind === CastSourceKind.Window
                  ? `${_("Window")}: ${src.title || src.appId || src.id}`
                  : src.kind === CastSourceKind.BrowserWindow
                    ? `${_("Browser")}: ${src.title}`
                    : _("Selected Region");
            const meta =
              src.kind === CastSourceKind.Monitor
                ? `${src.size[0]}×${src.size[1]}`
                : undefined;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleIndex(idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-adw-item px-3 py-2 text-left text-xs transition-colors",
                  active
                    ? "bg-adw-accent text-white"
                    : "bg-adw-fill-tertiary hover-fill:bg-adw-fill-secondary"
                )}
              >
                <MonitorIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                {meta && (
                  <span className="shrink-0 font-mono text-adw-footnote opacity-75">
                    {meta}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={() => {
              const chosen: CastSource[] = Array.from(selected)
                .map((i) => request.body.sources[i])
                .filter(Boolean);
              onAnswer(PortalAnswer.ScreenCast(chosen));
            }}
          >
            Share Selected
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Human-readable label for portal kinds rendered by the fallback dialog.
 */
function describePortalKind(req: PortalRequest): string {
  switch (req.kind) {
    case PortalKind.AppChooser:
      return "an application chooser";
    case PortalKind.FileChooser:
      return "a file chooser";
    case PortalKind.Print:
      return "a print dialog";
    case PortalKind.RemoteDesktop:
      return "remote desktop access";
    case PortalKind.DynamicLauncher:
      return "a launcher installation";
    case PortalKind.GlobalShortcuts:
      return "global shortcut bindings";
    case PortalKind.Unknown:
      return `an unsupported portal (${req.wireKind})`;
    default:
      return "a desktop portal dialog";
  }
}

/**
 * Renders interactive XDG Desktop Portal dialogs pushed by Domicile
 * (Screenshots, ScreenCast source pickers, PickColor, Access, Account, Wallpaper).
 * Non-interactive state entries like `PortalKind.Inhibit` are ignored because the
 * compositor keeps them open until the app releases its inhibitor lock.
 */
function FileChooserPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.FileChooser }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const domicile = useDomicile();
  const { realFilesystem } = useCapabilities();
  const body = request.body;
  const startDir = body.currentFolder || body.home || `${VFS_HOME}`;
  const [cwd, setCwd] = React.useState(startDir);
  const [entries, setEntries] = React.useState<
    Array<{ name: string; path: string; isDir: boolean }>
  >([]);
  const [selectedPaths, setSelectedPaths] = React.useState<string[]>([]);
  const [saveName, setSaveName] = React.useState(body.currentName ?? "");
  const [showHidden, setShowHidden] = React.useState(false);
  const [filterIdx, setFilterIdx] = React.useState<number>(
    body.currentFilter ?? 0
  );
  const [choiceValues, setChoiceValues] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(body.choices.map((c) => [c.id, c.initial]))
  );

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!realFilesystem) {
        const list = listVfsDir(cwd)
          .filter((e) => showHidden || !e.name.startsWith("."))
          .map((e) => ({
            name: e.name,
            path: e.path,
            isDir: e.kind === "directory",
          }));
        if (active) setEntries(list);
        return;
      }
      const res = await domicile.files.readDir(cwd);
      const list = res.match({
        Ok: (items) =>
          items
            .filter((i) => i.name && (showHidden || !i.name.startsWith(".")))
            .map((i) => ({
              name: i.name,
              path: `${cwd.replace(/\/$/, "")}/${i.name}`,
              isDir: i.fileType === FileType.Directory,
            })),
        Err: () => [],
      });
      if (active) setEntries(list);
    };
    void load();
    return () => {
      active = false;
    };
  }, [cwd, domicile.files, realFilesystem, showHidden]);

  const activeFilter = body.filters[filterIdx];
  const visibleEntries = React.useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)
    );
    if (body.directory) return sorted.filter((e) => e.isDir);
    if (!activeFilter || activeFilter.extensions.length === 0) return sorted;
    return sorted.filter(
      (e) =>
        e.isDir ||
        activeFilter.extensions.some((ext) =>
          e.name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)
        )
    );
  }, [activeFilter, body.directory, entries]);

  const canConfirm =
    body.mode === FileChooserMode.Save
      ? saveName.trim().length > 0
      : body.mode === FileChooserMode.SaveFiles || body.directory
        ? true
        : selectedPaths.length > 0;

  const confirm = () => {
    let paths: string[];
    if (body.mode === FileChooserMode.Save) {
      paths = [`${cwd.replace(/\/$/, "")}/${saveName.trim()}`];
    } else if (body.mode === FileChooserMode.SaveFiles) {
      paths = selectedPaths.length > 0 ? [selectedPaths[0]] : [cwd];
    } else if (body.directory) {
      paths = selectedPaths.length > 0 ? selectedPaths : [cwd];
    } else {
      paths = selectedPaths;
    }
    onAnswer(
      PortalAnswer.FileChooser({
        paths,
        currentFilter: body.filters.length > 0 ? filterIdx : undefined,
        choices: new Map(Object.entries(choiceValues)),
      })
    );
  };

  const homeBase = (body.home || `${VFS_HOME}`).replace(/\/$/, "");
  const places = [
    { label: _("Home"), path: homeBase },
    { label: _("Desktop"), path: `${homeBase}/Desktop` },
    { label: _("Documents"), path: `${homeBase}/Documents` },
    { label: _("Downloads"), path: `${homeBase}/Downloads` },
    { label: _("Pictures"), path: `${homeBase}/Pictures` },
    { label: _("Music"), path: `${homeBase}/Music` },
    { label: _("Videos"), path: `${homeBase}/Videos` },
  ];

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[82vh] w-full max-w-[600px] flex-col overflow-hidden rounded-adw-menu text-adw-label shadow-adw-menu adw-material-menu">
        <div className="flex items-center justify-between gap-2 border-b border-adw-separator px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold">
              {body.title ||
                (body.mode === FileChooserMode.Save
                  ? _("Save File")
                  : body.mode === FileChooserMode.SaveFiles
                    ? _("Save Files")
                    : body.directory
                      ? _("Select Folder")
                      : _("Open File"))}
            </h3>
            <p className="truncate font-mono text-adw-subheadline text-adw-label-secondary">
              {cwd}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant={showHidden ? "default" : "secondary"}
              onClick={() => setShowHidden((v) => !v)}
              title={_("Toggle hidden files")}
            >
              {showHidden ? (
                <EyeIcon className="size-3.5" />
              ) : (
                <EyeOffIcon className="size-3.5" />
              )}
            </Button>
            {cwd !== "/" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const parent = cwd.slice(0, cwd.lastIndexOf("/")) || "/";
                  setCwd(parent);
                  setSelectedPaths([]);
                }}
              >
                {_("Up")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-h-[260px] flex-1 overflow-hidden">
          <aside className="w-36 shrink-0 space-y-1 border-r border-adw-separator p-2">
            {places.map((p) => (
              <button
                key={p.path}
                type="button"
                onClick={() => {
                  setCwd(p.path);
                  setSelectedPaths([]);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-adw-control px-2.5 py-1.5 text-left text-adw-callout transition-colors",
                  cwd === p.path
                    ? "bg-adw-accent text-white"
                    : "hover-fill:bg-black/6 dark:hover-fill:bg-white/10"
                )}
              >
                <FolderIcon className="size-3.5 shrink-0" />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </aside>

          <div className="flex-1 overflow-y-auto p-2">
            {visibleEntries.length === 0 ? (
              <div className="py-12 text-center text-xs text-adw-label-secondary">
                Empty folder
              </div>
            ) : (
              <div className="space-y-0.5">
                {visibleEntries.map((entry) => {
                  const selected = selectedPaths.includes(entry.path);
                  return (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => {
                        if (entry.isDir && !body.directory) {
                          setCwd(entry.path);
                          setSelectedPaths([]);
                          return;
                        }
                        if (body.mode === FileChooserMode.Save && !entry.isDir) {
                          setSaveName(entry.name);
                          return;
                        }
                        if (body.multiple) {
                          setSelectedPaths((prev) =>
                            prev.includes(entry.path)
                              ? prev.filter((p) => p !== entry.path)
                              : [...prev, entry.path]
                          );
                        } else {
                          setSelectedPaths([entry.path]);
                        }
                      }}
                      onDoubleClick={() => {
                        if (entry.isDir) {
                          setCwd(entry.path);
                          setSelectedPaths([]);
                        } else {
                          onAnswer(
                            PortalAnswer.FileChooser({
                              paths: [entry.path],
                              currentFilter:
                                body.filters.length > 0 ? filterIdx : undefined,
                              choices: new Map(Object.entries(choiceValues)),
                            })
                          );
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-adw-control px-2.5 py-1.5 text-left text-adw-callout transition-colors",
                        selected
                          ? "bg-adw-accent text-white"
                          : "hover-fill:bg-black/6 dark:hover-fill:bg-white/10"
                      )}
                    >
                      {entry.isDir ? (
                        <FolderIcon className="size-4 shrink-0 text-sky-500" />
                      ) : (
                        <FileIcon className="size-4 shrink-0 opacity-75" />
                      )}
                      <span className="truncate">{entry.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-adw-separator px-4 py-3">
          {body.mode === FileChooserMode.SaveFiles && body.files.length > 0 && (
            <div className="rounded-adw-control bg-black/5 px-2.5 py-1.5 text-adw-subheadline text-adw-label-secondary dark:bg-white/8">
              {_("Files to save (%d):", body.files.length)}{" "}
              <span className="font-mono text-adw-label">
                {body.files.slice(0, 4).join(", ")}
                {body.files.length > 4 ? ` +${body.files.length - 4}` : ""}
              </span>
            </div>
          )}
          {body.mode === FileChooserMode.Save && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-adw-label-secondary">
                {_("Name")}
              </span>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConfirm) {
                    e.preventDefault();
                    confirm();
                  }
                }}
                className="h-7 flex-1 rounded-adw-control border border-adw-separator bg-black/5 px-2 text-xs text-adw-label outline-none focus:border-adw-accent dark:bg-white/10"
              />
            </div>
          )}

          {body.choices.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {body.choices.map((c) =>
                c.options.length === 0 ? (
                  <label
                    key={c.id}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={choiceValues[c.id] === "true"}
                      onChange={(e) =>
                        setChoiceValues((prev) => ({
                          ...prev,
                          [c.id]: e.target.checked ? "true" : "false",
                        }))
                      }
                    />
                    <span>{c.label}</span>
                  </label>
                ) : (
                  <div key={c.id} className="flex items-center gap-1.5 text-xs">
                    <span className="text-adw-label-secondary">{c.label}:</span>
                    <Select
                      value={choiceValues[c.id]}
                      items={c.options.map((o) => ({ value: o.id, label: o.label }))}
                      onValueChange={(val) =>
                        setChoiceValues((prev) => ({
                          ...prev,
                          [c.id]: String(val),
                        }))
                      }
                    >
                      <SelectTrigger size="sm" aria-label={c.label}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {c.options.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {body.filters.length > 0 ? (
              <Select
                value={filterIdx}
                items={body.filters.map((f, idx) => ({ value: idx, label: f.name }))}
                onValueChange={(val) => setFilterIdx(Number(val))}
              >
                <SelectTrigger aria-label={_("File type")} className="max-w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {body.filters.map((f, idx) => (
                    <SelectItem key={f.name} value={idx}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAnswer(PortalAnswer.Canceled())}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={!canConfirm} onClick={confirm}>
                {body.acceptLabel ||
                  (body.mode === FileChooserMode.Save ? "Save" : "Open")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppChooserPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.AppChooser }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const domicile = useDomicile();
  const { realFilesystem } = useCapabilities();
  const { installedXdgApps } = useApps();
  const [selected, setSelected] = React.useState(
    request.body.lastChoice ?? request.body.choices[0] ?? ""
  );
  const [rememberDefault, setRememberDefault] = React.useState(false);

  const confirmChoice = (choice: string) => {
    if (!choice) return;
    if (rememberDefault && request.body.contentType) {
      const desktopId = choice.endsWith(".desktop")
        ? choice
        : `${choice}.desktop`;
      void setDefaultMimeApp(domicile, request.body.contentType,
        desktopId
      ).catch(() => undefined);
    }
    onAnswer(PortalAnswer.AppChooser(choice));
  };

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[380px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <AppWindowIcon className="size-5 text-adw-accent" />
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold">{_("Open With")}</h3>
            <p className="truncate text-adw-subheadline text-adw-label-secondary">
              {request.body.filename || request.body.contentType || request.body.uri}
            </p>
          </div>
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {request.body.choices.map((choice) => {
            const xdg = installedXdgApps.find(
              (a) => a.appId === choice || a.desktopId === `${choice}.desktop`
            );
            return (
              <button
                key={choice}
                type="button"
                onClick={() => setSelected(choice)}
                onDoubleClick={() => confirmChoice(choice)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-adw-item border px-3 py-2 text-left text-xs transition-colors",
                  selected === choice
                    ? "border-adw-accent bg-adw-accent/15 font-medium"
                    : "border-transparent hover-fill:bg-black/6 dark:hover-fill:bg-white/10"
                )}
              >
                {xdg?.iconUrl ? (
                  <img src={xdg.iconUrl} alt="" className="size-5 shrink-0" />
                ) : (
                  <SparklesIcon className="size-4 shrink-0 text-adw-label-secondary" />
                )}
                <span className="truncate">{xdg?.name ?? choice}</span>
              </button>
            );
          })}
        </div>
        {request.body.contentType && (
          <label className="mt-3 flex items-center gap-2 text-xs text-adw-label-secondary">
            <input
              type="checkbox"
              checked={rememberDefault}
              onChange={(e) => setRememberDefault(e.target.checked)}
            />
            <span>{_("Always use for %s", request.body.contentType)}</span>
          </label>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            {_("Cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!selected}
            onClick={() => confirmChoice(selected)}
          >
            {_("Open")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DynamicLauncherPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.DynamicLauncher }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const [name, setName] = React.useState(request.body.name);
  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[380px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-3">
          {request.body.icon ? (
            <img
              src={request.body.icon}
              alt=""
              className="size-10 rounded-adw-item object-contain"
            />
          ) : (
            <SparklesIcon className="size-6 text-adw-accent" />
          )}
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold">Install Application Launcher</h3>
            {request.body.target && (
              <p className="truncate text-adw-subheadline text-adw-label-secondary">
                {request.body.target}
              </p>
            )}
          </div>
        </div>
        <input
          type="text"
          disabled={!request.body.editableName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-full rounded-adw-control border border-adw-separator bg-black/5 px-2.5 text-xs text-adw-label outline-none focus:border-adw-accent disabled:opacity-70 dark:bg-white/10"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => onAnswer(PortalAnswer.DynamicLauncher(name.trim()))}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatKeyboardEventChord(e: React.KeyboardEvent): string | null {
  const key = e.key;
  if (
    key === "Control" ||
    key === "Alt" ||
    key === "Shift" ||
    key === "Meta" ||
    key === "OS" ||
    key === "Super"
  ) {
    return null;
  }
  const parts: string[] = [];
  if (e.metaKey) parts.push("Super");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const normalizedKey =
    key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key;
  parts.push(normalizedKey);
  return parts.join("+");
}

function GlobalShortcutsPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.GlobalShortcuts }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const [triggers, setTriggers] = React.useState<Record<string, string | undefined>>(
    () =>
      Object.fromEntries(
        request.body.shortcuts.map((s) => [s.id, s.trigger])
      )
  );
  const [recordingId, setRecordingId] = React.useState<string | null>(null);

  const takenMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of request.body.taken) {
      map.set(t.chord.toLowerCase(), t.appId);
    }
    return map;
  }, [request.body.taken]);

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[460px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <KeyboardIcon className="size-5 text-adw-accent" />
          <div>
            <h3 className="text-[14px] font-bold">{_("Global Shortcuts")}</h3>
            <p className="text-adw-subheadline text-adw-label-secondary">
              {_("%s requests global shortcuts", request.appId || _("Application"))}
            </p>
          </div>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {request.body.shortcuts.map((sc) => {
            const currentChord = triggers[sc.id];
            const conflictApp = currentChord
              ? takenMap.get(currentChord.toLowerCase())
              : undefined;
            const isRecording = recordingId === sc.id;
            return (
              <div
                key={sc.id}
                className="flex flex-col gap-1 rounded-adw-item border border-adw-separator/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">
                    {sc.description || sc.id}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setRecordingId(isRecording ? null : sc.id)
                      }
                      onKeyDown={(e) => {
                        if (!isRecording) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.key === "Escape") {
                          setRecordingId(null);
                          return;
                        }
                        if (e.key === "Backspace" || e.key === "Delete") {
                          setTriggers((prev) => ({
                            ...prev,
                            [sc.id]: undefined,
                          }));
                          setRecordingId(null);
                          return;
                        }
                        const chord = formatKeyboardEventChord(e);
                        if (chord) {
                          setTriggers((prev) => ({ ...prev, [sc.id]: chord }));
                          setRecordingId(null);
                        }
                      }}
                      className={cn(
                        "h-6 min-w-[96px] rounded border px-2 text-center font-mono text-adw-subheadline outline-none transition-colors",
                        isRecording
                          ? "border-adw-accent bg-adw-accent/15 text-adw-accent"
                          : "border-adw-separator bg-black/5 hover-fill:bg-black/10 dark:bg-white/10 dark:hover-fill:bg-white/15"
                      )}
                    >
                      {isRecording
                        ? _("Press keys…")
                        : currentChord || _("Unassigned")}
                    </button>
                    {currentChord && (
                      <button
                        type="button"
                        aria-label={_("Clear shortcut")}
                        onClick={() =>
                          setTriggers((prev) => ({
                            ...prev,
                            [sc.id]: undefined,
                          }))
                        }
                        className="flex size-6 items-center justify-center rounded text-adw-label-secondary hover-fill:bg-black/10 dark:hover-fill:bg-white/15"
                      >
                        <XIcon className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
                {conflictApp && (
                  <div className="flex items-center gap-1 text-adw-footnote text-amber-600 dark:text-amber-400">
                    <AlertTriangleIcon className="size-3 shrink-0" />
                    <span>
                      {_("Already used by %s", conflictApp)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            {_("Cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onAnswer(
                PortalAnswer.GlobalShortcuts(
                  request.body.shortcuts.map((s) => ({
                    id: s.id,
                    trigger: triggers[s.id],
                  }))
                )
              )
            }
          >
            {_("Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RemoteDesktopPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.RemoteDesktop }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const [keyboard, setKeyboard] = React.useState(request.body.devices.keyboard);
  const [pointer, setPointer] = React.useState(request.body.devices.pointer);
  const [touchscreen, setTouchscreen] = React.useState(
    request.body.devices.touchscreen
  );
  const [clipboard, setClipboard] = React.useState(request.body.clipboard);

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[380px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <MonitorIcon className="size-5 text-adw-accent" />
          <div>
            <h3 className="text-[14px] font-bold">Remote Desktop Access</h3>
            <p className="text-adw-subheadline text-adw-label-secondary">
              {request.appId || "Application"} requests remote control
            </p>
          </div>
        </div>
        <div className="space-y-1.5 text-xs">
          {request.body.devices.keyboard && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={keyboard}
                onChange={(e) => setKeyboard(e.target.checked)}
              />
              <span>Keyboard input</span>
            </label>
          )}
          {request.body.devices.pointer && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pointer}
                onChange={(e) => setPointer(e.target.checked)}
              />
              <span>Pointer control</span>
            </label>
          )}
          {request.body.devices.touchscreen && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={touchscreen}
                onChange={(e) => setTouchscreen(e.target.checked)}
              />
              <span>Touchscreen input</span>
            </label>
          )}
          {request.body.clipboard && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={clipboard}
                onChange={(e) => setClipboard(e.target.checked)}
              />
              <span>Shared clipboard</span>
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            Deny
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onAnswer(
                PortalAnswer.RemoteDesktop(
                  { keyboard, pointer, touchscreen },
                  clipboard
                )
              )
            }
          >
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrintPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.Print }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const printers = request.body.printers;
  const pdfTarget = request.body.pdf;
  const [selectedPrinter, setSelectedPrinter] = React.useState(
    request.body.printer ?? printers[0]?.name ?? pdfTarget.name
  );
  const [copies, setCopies] = React.useState(1);
  const [pdfPath, setPdfPath] = React.useState(
    `${request.body.home.replace(/\/$/, "")}/output.pdf`
  );
  const isPdf = selectedPrinter === pdfTarget.name;

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[400px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <PrinterIcon className="size-5 text-adw-accent" />
          <h3 className="text-[14px] font-bold">{request.body.title || "Print"}</h3>
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="block">
            <span className="text-adw-label-secondary">Printer</span>
            <Select
              value={selectedPrinter}
              items={[
                ...printers.map((p) => ({ value: p.name, label: p.name })),
                { value: pdfTarget.name, label: "Save to PDF" },
              ]}
              onValueChange={(val) => setSelectedPrinter(String(val))}
            >
              <SelectTrigger size="lg" aria-label="Printer" className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {printers.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
                <SelectItem value={pdfTarget.name}>Save to PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isPdf ? (
            <label className="block">
              <span className="text-adw-label-secondary">PDF Path</span>
              <input
                type="text"
                value={pdfPath}
                onChange={(e) => setPdfPath(e.target.value)}
                className="mt-1 h-8 w-full rounded border border-adw-separator bg-black/5 px-2 font-mono dark:bg-white/10"
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-adw-label-secondary">Copies</span>
              <input
                type="number"
                min={1}
                max={99}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 h-8 w-24 rounded border border-adw-separator bg-black/5 px-2 dark:bg-white/10"
              />
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const opts = {
                colorMode: undefined,
                copies,
                media: undefined,
                orientation: undefined,
                pages: [],
                quality: undefined,
                sides: undefined,
              };
              onAnswer(
                isPdf
                  ? PortalAnswer.SaveToPdf(pdfPath, opts)
                  : PortalAnswer.Print(selectedPrinter, opts)
              );
            }}
          >
            {request.body.acceptLabel || "Print"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PickColorPortalOverlay({
  onAnswer,
}: {
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(
    null
  );

  return (
    <div
      className="fixed inset-0 z-[800] flex cursor-crosshair items-center justify-center bg-black/15 select-none"
      onPointerMove={(e) =>
        setCursor({
          x: Math.max(0, Math.round(e.clientX)),
          y: Math.max(0, Math.round(e.clientY)),
        })
      }
      onClick={(e) => {
        onAnswer(
          PortalAnswer.PickColor({
            x: Math.max(0, Math.round(e.clientX)),
            y: Math.max(0, Math.round(e.clientY)),
          })
        );
      }}
    >
      <div className="pointer-events-none flex items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 text-xs font-medium text-white shadow-xl ring-1 ring-white/15">
        <PipetteIcon className="size-4 text-sky-400" />
        <span>
          {_("Click anywhere to sample pixel color (Esc to cancel)")}
        </span>
      </div>
      {cursor && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 110, cursor.x + 16)}px`,
            top: `${Math.min(window.innerHeight - 36, cursor.y + 16)}px`,
          }}
          className="pointer-events-none fixed flex items-center gap-1.5 rounded-full bg-zinc-900/92 px-2.5 py-1 font-mono text-adw-subheadline text-white shadow-lg ring-1 ring-white/20"
        >
          <PipetteIcon className="size-3 text-sky-400" />
          <span>
            {cursor.x}, {cursor.y}
          </span>
        </div>
      )}
    </div>
  );
}

type PermissionPortalRequest = Extract<
  PortalRequest,
  {
    kind:
      | PortalKind.Access
      | PortalKind.Account
      | PortalKind.Wallpaper
      | PortalKind.InputCapture
      | PortalKind.Usb;
  }
>;

function PermissionPortalDialog({
  request,
  onAnswer,
}: {
  request: PermissionPortalRequest;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const domicile = useDomicile();
  const { realFilesystem } = useCapabilities();
  const [wallpaperPreviewUrl, setWallpaperPreviewUrl] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (request.kind !== PortalKind.Wallpaper || !realFilesystem) {
      setWallpaperPreviewUrl(null);
      return;
    }
    let active = true;
    void domicile.files
      .read(request.body.path)
      .then((res) => {
        if (!active) return;
        const bytes = res.match({ Ok: (b) => b, Err: () => null });
        if (!bytes || bytes.length === 0) return;
        const ext = request.body.path.toLowerCase();
        const mime = ext.endsWith(".png")
          ? "image/png"
          : ext.endsWith(".webp")
            ? "image/webp"
            : ext.endsWith(".svg")
              ? "image/svg+xml"
              : "image/jpeg";
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        const url = URL.createObjectURL(new Blob([copy], { type: mime }));
        setWallpaperPreviewUrl(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [domicile.files, realFilesystem, request]);

  React.useEffect(() => {
    return () => {
      if (wallpaperPreviewUrl) URL.revokeObjectURL(wallpaperPreviewUrl);
    };
  }, [wallpaperPreviewUrl]);

  let title = _("Permission Request");
  let subtitle = request.appId || _("System Application");
  let bodyText: string | undefined;
  let grantLabel = _("Allow");
  let denyLabel = _("Deny");
  let destructive = false;
  let icon: React.ReactNode = (
    <ShieldCheckIcon className="size-5 shrink-0 text-adw-accent" />
  );

  if (request.kind === PortalKind.Access) {
    title = request.body.title || title;
    subtitle = request.body.subtitle || subtitle;
    bodyText = request.body.body || undefined;
    grantLabel = request.body.grantLabel || grantLabel;
    denyLabel = request.body.denyLabel || denyLabel;
    destructive = Boolean(request.body.destructive);
    if (destructive) {
      icon = <AlertTriangleIcon className="size-5 shrink-0 text-rose-500" />;
    }
  } else if (request.kind === PortalKind.Account) {
    title = _("Share Account Information?");
    bodyText =
      request.body.reason ||
      _("Allow %s to access your user name and profile picture.", subtitle);
    icon = <UserIcon className="size-5 shrink-0 text-adw-accent" />;
  } else if (request.kind === PortalKind.Wallpaper) {
    title = _("Set Desktop Wallpaper?");
    const targetLabel =
      request.body.setOn === WallpaperTarget.Lockscreen
        ? _("Lock Screen")
        : request.body.setOn === WallpaperTarget.Both
          ? _("Desktop & Lock Screen")
          : _("Desktop Background");
    bodyText = _("Apply image to %s.", targetLabel);
    grantLabel = _("Set Wallpaper");
    icon = <ImageIcon className="size-5 shrink-0 text-adw-accent" />;
  } else if (request.kind === PortalKind.Usb) {
    title = _("Allow USB Device Access?");
    bodyText = _(
      "%s wants to access the following USB devices:",
      subtitle
    );
    icon = <UsbIcon className="size-5 shrink-0 text-adw-accent" />;
  } else if (request.kind === PortalKind.InputCapture) {
    title = _("Allow Input Capture?");
    bodyText = _(
      "%s requests permission to capture pointer or keyboard input across screen edges.",
      subtitle
    );
  }

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[400px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          {icon}
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold">{title}</h3>
            <p className="truncate text-adw-subheadline text-adw-label-secondary">
              {subtitle}
            </p>
          </div>
        </div>

        {bodyText && (
          <p className="mb-3 text-xs leading-relaxed text-adw-label-secondary">
            {bodyText}
          </p>
        )}

        {request.kind === PortalKind.Account && request.body.name && (
          <div className="mb-3 flex items-center gap-2.5 rounded-adw-item bg-black/5 px-3 py-2 text-xs dark:bg-white/8">
            <UserIcon className="size-4 text-adw-accent" />
            <span className="font-medium">{request.body.name}</span>
          </div>
        )}

        {request.kind === PortalKind.Wallpaper && (
          <div className="mb-3 space-y-1.5">
            {wallpaperPreviewUrl && (
              <div className="overflow-hidden rounded-adw-item border border-adw-separator/70 bg-black/25">
                <img
                  src={wallpaperPreviewUrl}
                  alt={_("Wallpaper preview")}
                  className="max-h-36 w-full object-cover"
                />
              </div>
            )}
            <p className="truncate font-mono text-adw-subheadline text-adw-label-secondary">
              {request.body.path}
            </p>
          </div>
        )}

        {request.kind === PortalKind.Usb && request.body.devices.length > 0 && (
          <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
            {request.body.devices.map((dev) => (
              <div
                key={dev.id}
                className="flex items-center justify-between gap-2 rounded-adw-item bg-black/5 px-2.5 py-1.5 text-xs dark:bg-white/8"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {dev.product || dev.id}
                  </div>
                  {dev.vendor && (
                    <div className="truncate text-adw-footnote text-adw-label-secondary">
                      {dev.vendor}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-adw-footnote font-medium",
                    dev.writable
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      : "bg-black/8 text-adw-label-secondary dark:bg-white/10"
                  )}
                >
                  {dev.writable ? _("Read/Write") : _("Read-Only")}
                </span>
              </div>
            ))}
          </div>
        )}

        {request.kind === PortalKind.InputCapture && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {request.body.devices.keyboard && (
              <span className="rounded-full bg-black/8 px-2.5 py-0.5 text-adw-subheadline font-medium dark:bg-white/10">
                {_("Keyboard")}
              </span>
            )}
            {request.body.devices.pointer && (
              <span className="rounded-full bg-black/8 px-2.5 py-0.5 text-adw-subheadline font-medium dark:bg-white/10">
                {_("Pointer")}
              </span>
            )}
            {request.body.devices.touchscreen && (
              <span className="rounded-full bg-black/8 px-2.5 py-0.5 text-adw-subheadline font-medium dark:bg-white/10">
                {_("Touchscreen")}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(PortalAnswer.Canceled())}
          >
            {denyLabel}
          </Button>
          <Button
            size="sm"
            variant={destructive ? "destructive" : "default"}
            onClick={() =>
              onAnswer(
                request.kind === PortalKind.InputCapture
                  ? PortalAnswer.InputCapture()
                  : PortalAnswer.Access()
              )
            }
          >
            {grantLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PortalDialogs() {
  const domicile = useDomicile();
  const requests = usePortalRequests();
  const [dismissedIds, setDismissedIds] = React.useState<Set<number>>(
    () => new Set()
  );

  React.useEffect(() => {
    if (!requests) return;
    setDismissedIds((prev) => {
      if (prev.size === 0) return prev;
      const activeIds = new Set(requests.map((r) => r.id));
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (activeIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [requests]);

  const current = requests?.find(
    (r) => r.kind !== PortalKind.Inhibit && !dismissedIds.has(r.id)
  );

  React.useEffect(() => {
    if (!current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      domicile.portals.answer(
        current.id,
        current.kind === PortalKind.Unknown
          ? PortalAnswer.Refused()
          : PortalAnswer.Canceled()
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, domicile.portals]);

  if (!current) return null;

  const answer = (ans: PortalAnswer) => {
    domicile.portals.answer(current.id, ans);
  };

  const dismissFallback = () => {
    setDismissedIds((prev) => new Set(prev).add(current.id));
    answer(
      current.kind === PortalKind.Unknown
        ? PortalAnswer.Refused()
        : PortalAnswer.Canceled()
    );
  };

  if (current.kind === PortalKind.Screenshot) {
    return <ScreenshotPortalOverlay request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.ScreenCast) {
    return <ScreenCastPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.FileChooser) {
    return <FileChooserPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.AppChooser) {
    return <AppChooserPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.DynamicLauncher) {
    return <DynamicLauncherPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.GlobalShortcuts) {
    return <GlobalShortcutsPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.RemoteDesktop) {
    return <RemoteDesktopPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.Print) {
    return <PrintPortalDialog request={current} onAnswer={answer} />;
  }

  if (current.kind === PortalKind.PickColor) {
    return <PickColorPortalOverlay onAnswer={answer} />;
  }

  if (
    current.kind === PortalKind.Access ||
    current.kind === PortalKind.Account ||
    current.kind === PortalKind.Wallpaper ||
    current.kind === PortalKind.InputCapture ||
    current.kind === PortalKind.Usb
  ) {
    return <PermissionPortalDialog request={current} onAnswer={answer} />;
  }

  // Fallback for unhandled portal request kinds (e.g. AppChooser / FileChooser / Print)
  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[380px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <h3 className="text-[14px] font-bold">Application Portal Request</h3>
        <p className="mt-1 text-xs text-adw-label-secondary">
          {current.appId || "Application"} requested{" "}
          {describePortalKind(current)}.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={dismissFallback}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

