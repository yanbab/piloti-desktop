import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { usePortalRequests } from "@domicile-desktop/react/portals";
import {
  CastSource,
  CastSourceKind,
  FileChooserMode,
  PortalAnswer,
  PortalKind,
  type PortalRequest,
} from "@domicile-desktop/sdk/portal";
import { FileType } from "@domicile-desktop/sdk/system";
import {
  AppWindowIcon,
  CameraIcon,
  FolderIcon,
  FileIcon,
  KeyboardIcon,
  MonitorIcon,
  PipetteIcon,
  PrinterIcon,
  ShieldCheckIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";
import { useApps, useSettings } from "@/context/DesktopStateContext";
import { listVfsDir } from "@/lib/web-vfs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <div className="relative flex max-h-[82vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-xl border border-white/20 shadow-2xl">
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
            <h3 className="text-[14px] font-bold">Share Screen or Window</h3>
            <p className="text-[11px] text-adw-label-secondary">
              Requested by {request.appId || "Application"}
            </p>
          </div>
        </div>

        <div className="max-h-64 space-y-1.5 overflow-y-auto py-1">
          {request.body.sources.map((src, idx) => {
            const active = selected.has(idx);
            const label =
              src.kind === CastSourceKind.Monitor
                ? `Display: ${src.description || src.name}`
                : src.kind === CastSourceKind.Window
                  ? `Window: ${src.title || src.appId || src.id}`
                  : src.kind === CastSourceKind.BrowserWindow
                    ? `Browser: ${src.title}`
                    : "Selected Region";

            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleIndex(idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-adw-item px-3 py-2 text-left text-xs transition-colors",
                  active
                    ? "bg-adw-accent text-white"
                    : "bg-adw-fill-tertiary hover:bg-adw-fill-secondary"
                )}
              >
                <MonitorIcon className="size-4 shrink-0" />
                <span className="truncate font-medium">{label}</span>
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
  const { isBrowserRuntime } = useSettings();
  const body = request.body;
  const startDir = body.currentFolder || body.home || "/home/user";
  const [cwd, setCwd] = React.useState(startDir);
  const [entries, setEntries] = React.useState<
    Array<{ name: string; path: string; isDir: boolean }>
  >([]);
  const [selectedPaths, setSelectedPaths] = React.useState<string[]>([]);
  const [saveName, setSaveName] = React.useState(body.currentName ?? "");
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
      if (isBrowserRuntime) {
        const list = listVfsDir(cwd)
          .filter((e) => !e.name.startsWith("."))
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
            .filter((i) => i.name && !i.name.startsWith("."))
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
  }, [cwd, domicile.files, isBrowserRuntime]);

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

  const places = [
    { label: "Home", path: body.home },
    { label: "Desktop", path: `${body.home}/Desktop` },
    { label: "Documents", path: `${body.home}/Documents` },
    { label: "Downloads", path: `${body.home}/Downloads` },
  ];

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[82vh] w-full max-w-[580px] flex-col overflow-hidden rounded-adw-menu text-adw-label shadow-adw-menu adw-material-menu">
        <div className="flex items-center justify-between border-b border-adw-separator px-4 py-3">
          <div>
            <h3 className="text-[14px] font-bold">
              {body.title ||
                (body.mode === FileChooserMode.Save ? "Save File" : "Open File")}
            </h3>
            <p className="truncate font-mono text-[11px] text-adw-label-secondary">
              {cwd}
            </p>
          </div>
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
              Up
            </Button>
          )}
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
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors",
                  cwd === p.path
                    ? "bg-adw-accent text-white"
                    : "hover:bg-black/6 dark:hover:bg-white/10"
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
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                        selected
                          ? "bg-adw-accent text-white"
                          : "hover:bg-black/6 dark:hover:bg-white/10"
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
          {body.mode === FileChooserMode.Save && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-adw-label-secondary">
                Name
              </span>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-7 flex-1 rounded-md border border-adw-separator bg-black/5 px-2 text-xs text-adw-label outline-none focus:border-adw-accent dark:bg-white/10"
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
                  <label key={c.id} className="flex items-center gap-1.5 text-xs">
                    <span className="text-adw-label-secondary">{c.label}:</span>
                    <select
                      value={choiceValues[c.id]}
                      onChange={(e) =>
                        setChoiceValues((prev) => ({
                          ...prev,
                          [c.id]: e.target.value,
                        }))
                      }
                      className="rounded border border-adw-separator bg-adw-window px-1.5 py-0.5 text-xs"
                    >
                      {c.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {body.filters.length > 0 ? (
              <select
                value={filterIdx}
                onChange={(e) => setFilterIdx(Number(e.target.value))}
                className="h-7 max-w-[200px] rounded border border-adw-separator bg-adw-window px-2 text-xs"
              >
                {body.filters.map((f, idx) => (
                  <option key={f.name} value={idx}>
                    {f.name}
                  </option>
                ))}
              </select>
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
  const { installedXdgApps } = useApps();
  const [selected, setSelected] = React.useState(
    request.body.lastChoice ?? request.body.choices[0] ?? ""
  );

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[380px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <AppWindowIcon className="size-5 text-adw-accent" />
          <div>
            <h3 className="text-[14px] font-bold">Open With</h3>
            <p className="truncate text-[11px] text-adw-label-secondary">
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
                onDoubleClick={() => onAnswer(PortalAnswer.AppChooser(choice))}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  selected === choice
                    ? "border-adw-accent bg-adw-accent/15 font-medium"
                    : "border-transparent hover:bg-black/6 dark:hover:bg-white/10"
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
            disabled={!selected}
            onClick={() => onAnswer(PortalAnswer.AppChooser(selected))}
          >
            Open
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
              className="size-10 rounded-lg object-contain"
            />
          ) : (
            <SparklesIcon className="size-6 text-adw-accent" />
          )}
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold">Install Application Launcher</h3>
            {request.body.target && (
              <p className="truncate text-[11px] text-adw-label-secondary">
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
          className="h-8 w-full rounded-md border border-adw-separator bg-black/5 px-2.5 text-xs text-adw-label outline-none focus:border-adw-accent disabled:opacity-70 dark:bg-white/10"
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

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[440px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
        <div className="mb-3 flex items-center gap-2.5">
          <KeyboardIcon className="size-5 text-adw-accent" />
          <div>
            <h3 className="text-[14px] font-bold">Global Shortcuts</h3>
            <p className="text-[11px] text-adw-label-secondary">
              {request.appId || "Application"} requests global shortcuts
            </p>
          </div>
        </div>
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {request.body.shortcuts.map((sc) => (
            <div
              key={sc.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-adw-separator/60 px-3 py-2"
            >
              <span className="truncate text-xs">{sc.description || sc.id}</span>
              <input
                type="text"
                value={triggers[sc.id] ?? ""}
                placeholder="None"
                onChange={(e) =>
                  setTriggers((prev) => ({
                    ...prev,
                    [sc.id]: e.target.value || undefined,
                  }))
                }
                className="h-6 w-28 rounded border border-adw-separator bg-black/5 px-2 text-center font-mono text-[11px] outline-none focus:border-adw-accent dark:bg-white/10"
              />
            </div>
          ))}
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
            Save
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
            <p className="text-[11px] text-adw-label-secondary">
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
          <label className="block">
            <span className="text-adw-label-secondary">Printer</span>
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="mt-1 h-8 w-full rounded border border-adw-separator bg-adw-window px-2"
            >
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value={pdfTarget.name}>Save to PDF</option>
            </select>
          </label>
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
    return (
      <div
        className="fixed inset-0 z-[800] flex cursor-crosshair items-center justify-center bg-black/20"
        onClick={(e) => {
          answer(
            PortalAnswer.PickColor({
              x: Math.max(0, Math.round(e.clientX)),
              y: Math.max(0, Math.round(e.clientY)),
            })
          );
        }}
      >
        <div className="pointer-events-none flex items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 text-xs font-medium text-white shadow-xl">
          <PipetteIcon className="size-4 text-sky-400" />
          <span>Click anywhere to sample pixel color (Esc to cancel)</span>
        </div>
      </div>
    );
  }

  if (
    current.kind === PortalKind.Access ||
    current.kind === PortalKind.Account ||
    current.kind === PortalKind.Wallpaper ||
    current.kind === PortalKind.InputCapture ||
    current.kind === PortalKind.Usb
  ) {
    const title =
      current.kind === PortalKind.Wallpaper
        ? "Set Desktop Wallpaper?"
        : current.kind === PortalKind.Account
          ? "Share Account Information?"
          : current.kind === PortalKind.Usb
            ? "Allow USB Device Access?"
            : "Permission Request";

    return (
      <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-[380px] rounded-adw-menu p-5 text-adw-label shadow-adw-menu adw-material-menu">
          <div className="mb-3 flex items-center gap-2.5">
            <ShieldCheckIcon className="size-5 text-adw-accent" />
            <div>
              <h3 className="text-[14px] font-bold">{title}</h3>
              <p className="text-[11px] text-adw-label-secondary">
                {current.appId || "System Application"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => answer(PortalAnswer.Canceled())}
            >
              Deny
            </Button>
            <Button
              size="sm"
              onClick={() =>
                answer(
                  current.kind === PortalKind.InputCapture
                    ? PortalAnswer.InputCapture()
                    : PortalAnswer.Access()
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

