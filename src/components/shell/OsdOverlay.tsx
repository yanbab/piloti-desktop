import * as React from "react";
import { SunIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import {
  useSettings,
  useWindowManagerSelector,
} from "@/context/DesktopStateContext";

interface OsdPayload {
  kind: "volume" | "brightness";
  value: number;
  muted?: boolean;
}

/**
 * Adwaita On-Screen Display (OSD) pill shown briefly when volume, mute, or
 * display brightness changes via hardware keys or shortcuts.
 */
export function OsdOverlay() {
  const { settings, updateSettings } = useSettings();
  const controlPanelOpen = useWindowManagerSelector((wm) => wm.controlPanelOpen);
  const [osd, setOsd] = React.useState<OsdPayload | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = React.useRef({
    volume: settings.volume,
    muted: settings.muted,
    brightness: settings.brightness,
    mounted: false,
  });

  const showOsd = React.useCallback((payload: OsdPayload) => {
    setOsd(payload);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOsd(null);
    }, 1500);
  }, []);

  React.useEffect(() => {
    const prev = prevRef.current;
    if (!prev.mounted) {
      prev.mounted = true;
      prev.volume = settings.volume;
      prev.muted = settings.muted;
      prev.brightness = settings.brightness;
      return;
    }

    if (
      prev.volume !== settings.volume ||
      prev.muted !== settings.muted
    ) {
      prev.volume = settings.volume;
      prev.muted = settings.muted;
      showOsd({
        kind: "volume",
        value: settings.muted ? 0 : settings.volume,
        muted: settings.muted,
      });
    } else if (prev.brightness !== settings.brightness) {
      prev.brightness = settings.brightness;
      showOsd({
        kind: "brightness",
        value: settings.brightness,
      });
    }
  }, [
    controlPanelOpen,
    settings.brightness,
    settings.muted,
    settings.volume,
    showOsd,
  ]);

  // Hardware media / brightness key handling
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "AudioVolumeUp") {
        e.preventDefault();
        updateSettings({
          muted: false,
          volume: Math.min(100, settings.volume + 5),
        });
      } else if (e.key === "AudioVolumeDown") {
        e.preventDefault();
        const nextVol = Math.max(0, settings.volume - 5);
        updateSettings({
          volume: nextVol,
          muted: nextVol === 0,
        });
      } else if (e.key === "AudioVolumeMute") {
        e.preventDefault();
        updateSettings({ muted: !settings.muted });
      } else if (e.key === "BrightnessUp") {
        e.preventDefault();
        updateSettings({
          brightness: Math.min(100, settings.brightness + 5),
        });
      } else if (e.key === "BrightnessDown") {
        e.preventDefault();
        updateSettings({
          brightness: Math.max(25, settings.brightness - 5),
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settings.brightness, settings.muted, settings.volume, updateSettings]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!osd) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 left-1/2 z-[450] flex w-56 -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2.5 text-adw-label shadow-adw-menu ring-1 ring-adw-border adw-material-hud animate-in fade-in zoom-in-95 duration-150"
    >
      {osd.kind === "volume" ? (
        osd.muted || osd.value === 0 ? (
          <VolumeXIcon className="size-4.5 shrink-0 text-adw-label-secondary" />
        ) : (
          <Volume2Icon className="size-4.5 shrink-0 text-adw-label" />
        )
      ) : (
        <SunIcon className="size-4.5 shrink-0 text-adw-label" />
      )}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/15 dark:bg-white/20">
        <div
          style={{ width: `${Math.max(0, Math.min(100, osd.value))}%` }}
          className="h-full rounded-full bg-adw-accent transition-[width] duration-100"
        />
      </div>
      <span className="w-8 text-right text-[11px] font-semibold tabular-nums text-adw-label-secondary">
        {osd.muted ? "Mute" : `${osd.value}%`}
      </span>
    </div>
  );
}

