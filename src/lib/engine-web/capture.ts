/** The demo's screenshots and recordings: the browser's screen share, saved to the demo Desktop. */
import * as React from "react";
import { type Capturing, CapturingKind } from "@domicile-desktop/sdk/portal";
import { listVfsDir, writeVfsTextFile } from "@/lib/engine-web/web-vfs";
import { WEB_VFS_HOME } from "@/lib/core/vfs-paths";
import type { CaptureBackend, DemoCaptureHook } from "@/lib/ports/capture";
import {
  captureOpenAction,
  screenshotBaseName,
  uniqueCaptureName,
  videoBaseName,
} from "@/lib/files/capture-files";

const desktopCaptureName = (base: string, ext: string) =>
  uniqueCaptureName(
    listVfsDir(`${WEB_VFS_HOME}/Desktop`).map((e) => e.name),
    base,
    ext,
  );

export const useWebCapture: DemoCaptureHook = (pushNotification) => {
  const [browserCapturingSessions, setBrowserCapturingSessions] = React.useState<Capturing[]>([]);
  const browserRecordersRef = React.useRef<
    Map<number, { recorder: MediaRecorder; stream: MediaStream; discarded: boolean }>
  >(new Map());

  const takeScreenshot = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screenshot");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      pushNotification({
        appName: "Screenshot",
        summary: "Screen Capture Unavailable",
        body: "navigator.mediaDevices.getDisplayMedia is not supported in this browser.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      for (const track of stream.getTracks()) track.stop();
      const dataUrl = canvas.toDataURL("image/png");
      const filename = desktopCaptureName(screenshotBaseName(canvas.width, canvas.height), "png");
      const savedPath = `${WEB_VFS_HOME}/Desktop/${filename}`;
      try {
        writeVfsTextFile(savedPath, dataUrl);
        pushNotification({
          appName: "Screenshot",
          summary: "Screenshot Captured",
          body: `${WEB_VFS_HOME}/Desktop/${filename}`,
          actions: [captureOpenAction(savedPath)],
        });
      } catch {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = filename;
        link.click();
        pushNotification({
          appName: "Screenshot",
          summary: "Screenshot Captured",
          body: `Downloaded ${filename} (Desktop storage full)`,
        });
      }
    } catch (err) {
      if ((err as Error)?.name !== "NotAllowedError" && (err as Error)?.name !== "AbortError") {
        pushNotification({
          appName: "Screenshot",
          summary: "Screenshot Failed",
          body: String(err),
        });
      }
    }
  }, [pushNotification]);

  const startScreenRecording = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screen recording");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      pushNotification({
        appName: "Screen Recorder",
        summary: "Screen Recording Unavailable",
        body: "navigator.mediaDevices.getDisplayMedia is not supported in this browser.",
      });
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
      }
      const id = Date.now();
      const chunks: BlobPart[] = [];
      let firstFrameThumb: string | undefined;
      if (typeof document !== "undefined") {
        try {
          const video = document.createElement("video");
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          const grab = () => {
            if (firstFrameThumb || video.videoWidth <= 0 || video.videoHeight <= 0) return;
            const maxSide = 256;
            const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
            const w = Math.max(1, Math.round(video.videoWidth * scale));
            const h = Math.max(1, Math.round(video.videoHeight * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              firstFrameThumb = canvas.toDataURL("image/jpeg", 0.78);
            }
            video.pause();
            video.srcObject = null;
          };
          video.addEventListener("loadeddata", grab, { once: true });
          void video.play().then(grab).catch(() => {});
        } catch {
          // ignore thumbnail capture errors
        }
      }
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const entry = { recorder, stream, discarded: false };
      browserRecordersRef.current.set(id, entry);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        browserRecordersRef.current.delete(id);
        setBrowserCapturingSessions((prev) => prev.filter((c) => c.id !== id));
        if (!entry.discarded && chunks.length > 0) {
          const blob = new Blob(chunks, { type: "video/webm" });
          const filename = desktopCaptureName(videoBaseName(Date.now() - id), "webm");
          const fallbackDownload = () => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            pushNotification({
              appName: "Screen Recorder",
              summary: "Screen Recording Saved",
              body: `Downloaded ${filename} (Desktop storage full)`,
            });
          };
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : null;
            if (!dataUrl) {
              fallbackDownload();
              return;
            }
            try {
              const savedPath = `${WEB_VFS_HOME}/Desktop/${filename}`;
              writeVfsTextFile(savedPath, dataUrl, {
                metadata: {
                  "standard::content-type": "video/webm",
                  ...(firstFrameThumb ? { "metadata::thumbnail": firstFrameThumb } : {}),
                },
              });
              pushNotification({
                appName: "Screen Recorder",
                summary: "Screen Recording Saved",
                body: `${WEB_VFS_HOME}/Desktop/${filename}`,
                actions: [captureOpenAction(savedPath)],
              });
            } catch {
              fallbackDownload();
            }
          };
          reader.onerror = fallbackDownload;
          reader.readAsDataURL(blob);
        }
      };
      for (const track of stream.getVideoTracks()) {
        track.onended = () => {
          if (recorder.state !== "inactive") recorder.stop();
        };
      }
      recorder.start(250);
      setBrowserCapturingSessions((prev) => [
        ...prev,
        {
          id,
          kind: CapturingKind.Recording,
          runningSinceMs: Date.now(),
        } as Capturing,
      ]);
    } catch (err) {
      if ((err as Error)?.name !== "NotAllowedError" && (err as Error)?.name !== "AbortError") {
        pushNotification({
          appName: "Screen Recorder",
          summary: "Screen Recording Failed",
          body: String(err),
        });
      }
    }
  }, [pushNotification]);

  return React.useMemo<CaptureBackend>(
    () => ({
      capturingSessions: browserCapturingSessions,
      takeScreenshot,
      startScreenRecording,
      stopCapturing: (id: number) => {
        const rec = browserRecordersRef.current.get(id);
        if (rec && rec.recorder.state !== "inactive") rec.recorder.stop();
      },
      pauseRecording: (id: number) => {
        const rec = browserRecordersRef.current.get(id);
        if (rec && rec.recorder.state === "recording") {
          rec.recorder.pause();
          setBrowserCapturingSessions((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, runningSinceMs: undefined } : c
            )
          );
        }
      },
      resumeRecording: (id: number) => {
        const rec = browserRecordersRef.current.get(id);
        if (rec && rec.recorder.state === "paused") {
          rec.recorder.resume();
          setBrowserCapturingSessions((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, runningSinceMs: Date.now() } : c
            )
          );
        }
      },
      discardRecording: (id: number) => {
        const rec = browserRecordersRef.current.get(id);
        if (rec) {
          rec.discarded = true;
          if (rec.recorder.state !== "inactive") rec.recorder.stop();
        }
      },
    }),
    [browserCapturingSessions, takeScreenshot, startScreenRecording],
  );
};
