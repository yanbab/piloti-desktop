import * as React from "react";
import { DownloadIcon, FolderOpenIcon, XIcon } from "lucide-react";
import { DownloadState, type Download } from "@domicile-desktop/sdk/desktop/downloads";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { usePiloti } from "@/platform/shared/piloti";
import { useOpenPath } from "@/ui/hooks/use-open-path";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import {
  downloadFileName,
  downloadFolder,
  downloadsProgress,
  formatDownloadSize,
} from "@/ui/shell/windows/browser-downloads";

const NO_DOWNLOADS: readonly Download[] = [];

/** The downloads list, at most four times a second while bytes come in. */
function useDownloads(): readonly Download[] {
  const piloti = usePiloti();
  const [list, setList] = React.useState(() => piloti.downloads.list ?? NO_DOWNLOADS);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      timer = null;
      setList(piloti.downloads.list ?? NO_DOWNLOADS);
    };
    const off = piloti.downloads.on("change", () => {
      timer ??= setTimeout(read, 250);
    });
    read();
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [piloti]);
  return list;
}

function statusText(d: Download): string {
  if (d.state === DownloadState.Failed) return _("Failed");
  if (d.state === DownloadState.Complete) return formatDownloadSize(d.totalBytes || d.receivedBytes);
  return d.totalBytes > 0
    ? _("%s of %s", formatDownloadSize(d.receivedBytes), formatDownloadSize(d.totalBytes))
    : formatDownloadSize(d.receivedBytes);
}

/** A ring around the button's icon while downloads run. */
function ProgressRing({ progress }: { progress: number | null }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 26 26" aria-hidden className="pointer-events-none absolute inset-0 size-full -rotate-90">
      <circle cx="13" cy="13" r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={2} />
      <circle
        cx="13"
        cy="13"
        r={r}
        fill="none"
        stroke="var(--ui-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={progress === null ? c * 0.75 : c * (1 - progress)}
        className={cn("transition-[stroke-dashoffset] duration-200", progress === null && "origin-center animate-spin")}
      />
    </svg>
  );
}

/**
 * The Web Browser's downloads: a toolbar button, shown once there is one, with
 * the overall progress around it; the menu opens, shows or cancels each.
 */
export function BrowserDownloadsMenu() {
  const piloti = usePiloti();
  const { openPath } = useOpenPath();
  const downloads = useDownloads();
  if (downloads.length === 0) return null;
  const progress = downloadsProgress(downloads);
  const newestFirst = [...downloads].reverse();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={_("Downloads")}
        title={_("Downloads")}
        data-slot="browser-downloads"
        className="relative flex size-7 items-center justify-center rounded-ui-control outline-none transition-colors hover-fill:bg-black/8 data-[popup-open]:bg-black/14 dark:hover-fill:bg-white/10 dark:data-[popup-open]:bg-white/18"
      >
        <SymbolicIcon name="folder-download" fallback={DownloadIcon} className="size-3.5" />
        {progress !== undefined && <ProgressRing progress={progress} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{_("Downloads")}</DropdownMenuLabel>
        {newestFirst.slice(0, 8).map((d) => {
          const running = d.state === DownloadState.InProgress;
          const fraction = d.totalBytes > 0 ? d.receivedBytes / d.totalBytes : null;
          return (
            <div key={d.id} className="flex items-center gap-1">
              <DropdownMenuItem
                disabled={d.state === DownloadState.Failed}
                onClick={() => {
                  if (d.state === DownloadState.Complete) openPath(d.path);
                }}
                title={d.path}
                className="min-w-0 flex-1 flex-col items-stretch gap-0.5"
              >
                <span className="truncate font-medium">{downloadFileName(d.path)}</span>
                {running && (
                  <span className="block h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/12">
                    <span
                      className={cn("block h-full rounded-full bg-ui-accent", fraction === null && "w-1/3 animate-pulse")}
                      style={fraction === null ? undefined : { width: `${Math.round(fraction * 100)}%` }}
                    />
                  </span>
                )}
                <span
                  className={cn(
                    "text-ui-caption text-ui-label-secondary tabular-nums",
                    d.state === DownloadState.Failed && "text-ui-red"
                  )}
                >
                  {statusText(d)}
                </span>
              </DropdownMenuItem>
              <button
                type="button"
                aria-label={running ? _("Cancel Download") : _("Show in Folder")}
                title={running ? _("Cancel Download") : _("Show in Folder")}
                onClick={(e) => {
                  e.stopPropagation();
                  if (running) piloti.downloads.cancel(d.id);
                  else openPath(downloadFolder(d.path));
                }}
                className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-ui-control transition-colors hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
              >
                {running ? (
                  <SymbolicIcon name="window-close" fallback={XIcon} className="size-3.5" />
                ) : (
                  <SymbolicIcon name="folder-open" fallback={FolderOpenIcon} className="size-3.5" />
                )}
              </button>
            </div>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openPath(downloadFolder(newestFirst[0].path))}>
          {_("Open Downloads Folder")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={downloads.every((d) => d.state === DownloadState.InProgress)}
          onClick={() => piloti.downloads.clear()}
        >
          {_("Clear List")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
