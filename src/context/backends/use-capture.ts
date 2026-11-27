import * as React from "react";
import { useCapturing } from "@domicile-desktop/react/portals";
import { ScreenshotKeptKind } from "@domicile-desktop/sdk/system";
import { getEngine } from "@/lib/engine/engine";
import type { Piloti } from "@/lib/engine/piloti";
import { _ } from "@/lib/core/i18n";
import { type CaptureBackend, demoCapture, type Notify } from "@/lib/ports/capture";
import { captureOpenAction } from "@/lib/shell/capture-files";
import { playSoundThemeEvent } from "@/lib/shell/sound-effects";

interface CaptureHost {
  piloti: Piloti;
  pushNotification: Notify;
  volume: number;
  muted: boolean;
}

const NO_SESSIONS: never[] = [];

/** Screenshots and recordings through Domicile. */
function useNativeCapture({ piloti, pushNotification, volume, muted }: CaptureHost): CaptureBackend {
  const capturingSessions = useCapturing() ?? NO_SESSIONS;

  const takeScreenshot = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screenshot");
    const res = await piloti.capture.screenshot();
    res.match({
      Ok: (kept) => {
        void playSoundThemeEvent("screenshot", volume, muted);
        if (kept.kind === ScreenshotKeptKind.Saved) {
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Saved",
            body: kept.path,
            actions: [{ key: `open:${kept.path}`, label: _("Open") }],
          });
        } else {
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Copied to Clipboard",
            body: "Ready to paste in any application.",
          });
        }
      },
      Err: () => {},
    });
  }, [piloti.capture, pushNotification, muted, volume]);

  const startScreenRecording = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screen recording");
    const res = await piloti.capture.screenRecord();
    res.match({
      Ok: (filePath) => {
        pushNotification({
          appName: "Screen Recorder",
          summary: "Screen Recording Saved",
          body: filePath,
          actions: [captureOpenAction(filePath)],
        });
      },
      Err: () => {},
    });
  }, [piloti.capture, pushNotification]);

  return React.useMemo<CaptureBackend>(
    () => ({
      capturingSessions,
      takeScreenshot,
      startScreenRecording,
      stopCapturing: (id) => void piloti.portals.stopCapturing(id),
      pauseRecording: (id) => void piloti.portals.pauseRecording(id),
      resumeRecording: (id) => void piloti.portals.resumeRecording(id),
      discardRecording: (id) => void piloti.portals.discardRecording(id),
    }),
    [capturingSessions, takeScreenshot, startScreenRecording, piloti.portals],
  );
}

/** The engine's capture backend; which one never changes while the shell runs. */
export function useCapture(host: CaptureHost): CaptureBackend {
  const useBackend = getEngine().capabilities.systemServices
    ? useNativeCapture
    : (h: CaptureHost) => demoCapture()(h.pushNotification);
  return useBackend(host);
}
