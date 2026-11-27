/**
 * Screenshots and screen recording. Linux asks Domicile
 * (`context/backends/use-capture.ts`); the demo records the browser's own
 * screen share (`engine-web/capture.ts`), set by the web entry point.
 */
import type { Capturing } from "@domicile-desktop/sdk/portal";
import type { NotificationActionItem } from "@/lib/shell/notifications";

export interface CaptureBackend {
  capturingSessions: readonly Capturing[];
  takeScreenshot: () => Promise<void>;
  startScreenRecording: () => Promise<void>;
  stopCapturing: (id: number) => void;
  pauseRecording: (id: number) => void;
  resumeRecording: (id: number) => void;
  discardRecording: (id: number) => void;
}

export type Notify = (n: {
  appName: string;
  summary: string;
  body: string;
  actions?: readonly NotificationActionItem[];
}) => void;

/** A React hook: it holds the recordings under way. */
export type DemoCaptureHook = (notify: Notify) => CaptureBackend;

const none = async () => undefined;
const useNoCapture: DemoCaptureHook = () => ({
  capturingSessions: [],
  takeScreenshot: none,
  startScreenRecording: none,
  stopCapturing: () => undefined,
  pauseRecording: () => undefined,
  resumeRecording: () => undefined,
  discardRecording: () => undefined,
});

let demo: DemoCaptureHook = useNoCapture;

/** Set before the shell renders: the hook must not change while it runs. */
export function setDemoCapture(hook: DemoCaptureHook): void {
  demo = hook;
}

export const demoCapture = (): DemoCaptureHook => demo;
