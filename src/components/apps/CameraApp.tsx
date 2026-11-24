import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { CameraIcon, MicIcon, VideoIcon } from "lucide-react";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { emitShellEvent } from "@/lib/shell/shell-events";
import { useApps, useSettings } from "@/context/DesktopStateContext";
import { resolveUserDirPath } from "@/lib/xdg/xdg-user-dirs";
import { WindowControls } from "@/components/ui/window";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { toDomicilePath } from "@/lib/engine/fs-bridge";
import { listVfsDir, WEB_VFS_HOME, writeVfsTextFile } from "@/lib/engine-web/web-vfs";
import {
  audioBaseName,
  captureStamp,
  formatCaptureDuration,
  uniqueCaptureName,
  videoBaseName,
} from "@/lib/shell/capture-files";

type CameraMode = "photo" | "video" | "audio";

export interface CameraAppProps {
  windowId?: string;
  isCsd?: boolean;
}

const MODES: { id: CameraMode; label: string; icon: React.ReactNode }[] = [
  { id: "photo", label: "Photo", icon: <CameraIcon className="size-3.5" /> },
  { id: "video", label: "Cam", icon: <VideoIcon className="size-3.5" /> },
  { id: "audio", label: "Mic", icon: <MicIcon className="size-3.5" /> },
];

function pickMime(candidates: string[]): string {
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Grabs the current frame of a playing <video> as a JPEG data URL, longest side `maxSide`. */
function frameDataUrl(video: HTMLVideoElement, maxSide: number, type: string, quality?: number) {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const CameraApp: React.FC<CameraAppProps> = ({ windowId = "", isCsd = true }) => {
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const { xdgUserDirs } = useApps();
  const [mode, setMode] = React.useState<CameraMode>("photo");
  const [error, setError] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [status, setStatus] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const startedAtRef = React.useRef(0);
  const ownerId = windowId || "camera";

  const stopStream = React.useCallback(() => {
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [ownerId]);

  // (Re)open the device whenever the mode changes. Opening a device = "capture is on".
  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    const constraints: MediaStreamConstraints =
      mode === "audio" ? { audio: true } : { video: true, audio: mode === "video" };
    const open = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          // Cam mode without a microphone: fall back to video only.
          if (mode !== "video") throw err;
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void open();
    return () => {
      cancelled = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      stopStream();
    };
  }, [mode, ownerId, stopStream]);

  React.useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  React.useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  /** Saves a capture to ~/Desktop. Metadata is stored on the entry when the engine supports it. */
  const saveToDesktop = React.useCallback(
    async (blob: Blob, base: string, ext: string, mime: string, meta: Record<string, unknown>) => {
      const dir = isBrowserRuntime
        ? `${WEB_VFS_HOME}/Desktop`
        : resolveUserDirPath("DESKTOP", xdgUserDirs, WEB_VFS_HOME);
      const name = uniqueCaptureName(listVfsDir(dir).map((e) => e.name), base, ext);
      const path = `${dir}/${name}`;
      const metadata = {
        "standard::content-type": mime,
        "metadata::created": new Date().toISOString(),
        ...meta,
      };
      if (isBrowserRuntime) {
        writeVfsTextFile(path, await blobToDataUrl(blob), { metadata });
      } else {
        await domicile.files.write(toDomicilePath(path), new Uint8Array(await blob.arrayBuffer()));
      }
      setStatus(_("Saved to Desktop") + ` — ${name}`);
    },
    [domicile, isBrowserRuntime, xdgUserDirs],
  );

  const takePhoto = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const dataUrl = frameDataUrl(video, Math.max(w, h), "image/png");
    const blob = await (await fetch(dataUrl)).blob();
    const thumb = frameDataUrl(video, 256, "image/jpeg", 0.78);
    await saveToDesktop(blob, `Photo ${w}x${h} ${captureStamp()}`, "png", "image/png", {
      "metadata::width": w,
      "metadata::height": h,
      "metadata::thumbnail": thumb,
    });
  }, [saveToDesktop]);

  const startRecording = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const isAudio = mode === "audio";
    const mimeType = isAudio
      ? pickMime(["audio/webm;codecs=opus", "audio/webm"])
      : pickMime(["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]);
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    const video = videoRef.current;
    // Video thumbnail: the first frame, drawn to a canvas while the stream plays, stored as
    // `metadata::thumbnail` (a JPEG data URL) — Chromium's WebM carries no poster or duration.
    const thumb =
      !isAudio && video && video.videoWidth > 0 ? frameDataUrl(video, 256, "image/jpeg", 0.78) : undefined;
    const width = video?.videoWidth ?? 0;
    const height = video?.videoHeight ?? 0;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current;
      setRecording(false);
      recorderRef.current = null;
      if (chunks.length === 0) return;
      const type = (mimeType || (isAudio ? "audio/webm" : "video/webm")).split(";")[0] ?? "video/webm";
      const blob = new Blob(chunks, { type });
      const base = isAudio ? audioBaseName(durationMs) : videoBaseName(durationMs);
      void saveToDesktop(blob, base, "webm", type, {
        "metadata::duration": Math.round(durationMs / 1000),
        ...(width ? { "metadata::width": width, "metadata::height": height } : {}),
        ...(thumb ? { "metadata::thumbnail": thumb } : {}),
      }).catch((err) => setError(String(err)));
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start(250);
    setRecording(true);
  }, [mode, saveToDesktop]);

  const onRecordClick = () => {
    if (error) return;
    if (mode === "photo") {
      void takePhoto().catch((err) => setError(String(err)));
    } else if (recording) {
      recorderRef.current?.stop();
    } else {
      startRecording();
    }
  };

  const requestClose = () => {
    if (windowId) emitShellEvent("piloti:request-animated-close", { windowId });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black text-white select-none">
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        className="relative flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-adw-titlebar px-2.5 text-adw-label"
      >
        <div className="flex items-center gap-2" data-window-no-drag>
          {windowId && (
            <WindowMenuButton side="left" windowId={windowId} appId="camera" iconName="sparkles" />
          )}
        </div>
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2" data-window-no-drag>
          {recording && (
            <span className="font-mono text-[11px] tabular-nums text-adw-label">
              {formatCaptureDuration(elapsed)}
            </span>
          )}
          <button
            type="button"
            aria-label={mode === "photo" ? _("Take Photo") : recording ? _("Stop") : _("Record")}
            title={mode === "photo" ? _("Take Photo") : recording ? _("Stop") : _("Record")}
            disabled={Boolean(error)}
            onClick={onRecordClick}
            className="flex size-7 items-center justify-center rounded-full border-2 border-rose-500/40 outline-none transition-transform active:scale-90 disabled:opacity-40"
          >
            <span
              className={cn(
                "bg-rose-500 transition-all duration-150",
                recording ? "size-2.5 rounded-[2px]" : "size-4 rounded-full",
              )}
            />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2" data-window-no-drag>
          <div
            role="tablist"
            className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                aria-label={_(m.label)}
                title={_(m.label)}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                disabled={recording}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center rounded-[6px] px-2 py-1 text-[13px] font-medium transition-all outline-none disabled:opacity-60",
                  mode === m.id
                    ? "bg-white text-black dark:bg-white/18 dark:text-white"
                    : "text-adw-label-secondary hover:text-adw-label",
                )}
              >
                {m.icon}
              </button>
            ))}
          </div>
          {windowId && isCsd && <WindowControls side="right" onClose={requestClose} />}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className={cn("size-full object-contain", mode === "audio" && "hidden")}
        />
        {mode === "audio" && !error && (
          <div className="flex flex-col items-center gap-1 text-[12px] text-white/40">
            {recording ? _("Recording…") : _("Microphone ready")}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[12px] text-white/70">
            {error}
          </div>
        )}
        {status && (
          <div className="absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded-full bg-black/70 px-3 py-1 text-[11px] text-white">
            {status}
          </div>
        )}
      </div>
    </div>
  );
};
