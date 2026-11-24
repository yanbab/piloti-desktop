import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { Button } from "@/components/ui/button";
import {
  Window,
  WindowContent,
  WindowControls,
  WindowMain,
  WindowTitlebar,
} from "@/components/ui/window";
import pkg from "../../../package.json";
import {
  useSettings,
  useWindowActions,
  useWindowManagerSelector,
} from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { type ComputerInfo, probeComputerInfo } from "@/lib/core/system-info";

export function ComputerHardwareIllustration({
  className,
  screenContent,
}: {
  className?: string;
  screenContent?: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 160 112"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient
          id="piloti-computer-screen"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor="#46a3ff" />
          <stop offset="100%" stopColor="#1b6bd4" />
        </linearGradient>
        <linearGradient
          id="piloti-computer-body"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor="#dcdce0" />
          <stop offset="100%" stopColor="#aeaeb4" />
        </linearGradient>
      </defs>
      {/* Display lid + bezel */}
      <rect
        x="24"
        y="12"
        width="112"
        height="72"
        rx="6"
        fill="#161618"
        stroke="#4a4a50"
        strokeWidth="1.5"
      />
      {/* Active Wallpaper Viewport */}
      {screenContent ? (
        <foreignObject x="29" y="17" width="102" height="62">
          <div className="relative h-full w-full overflow-hidden rounded-[2px]">
            {screenContent}
          </div>
        </foreignObject>
      ) : (
        <rect
          x="29"
          y="17"
          width="102"
          height="62"
          rx="2"
          fill="url(#piloti-computer-screen)"
        />
      )}
      {/* Subtle Topbar Hint inside illustration */}
      <rect
        x="29"
        y="17"
        width="102"
        height="5"
        fill="rgb(0 0 0 / 0.25)"
      />
      {/* Camera dot */}
      <circle cx="80" cy="14.5" r="1" fill="#52525a" />
      {/* Unibody deck / base */}
      <path
        d="M10 86h140l-5 8c-1.2 2-3.3 3-6 3H21c-2.7 0-4.8-1-6-3l-5-8Z"
        fill="url(#piloti-computer-body)"
      />
      {/* Thumb notch */}
      <path
        d="M66 86h28c0 2-1.5 3.5-3.5 3.5h-21c-2 0-3.5-1.5-3.5-3.5Z"
        fill="#8e8e95"
      />
      {/* Shadow */}
      <ellipse cx="80" cy="100" rx="64" ry="4" fill="rgb(0 0 0 / 0.22)" />
    </svg>
  );
}

/**
 * macOS "About This Mac"-inspired About Computer window built with Adwaita grouped rows.
 */
export function AboutComputerDialog() {
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const aboutOpen = useWindowManagerSelector((wm) => wm.aboutOpen);
  const { setAboutOpen, launchApp } = useWindowActions();
  const [info, setInfo] = React.useState<ComputerInfo>({
    computerName: "Piloti Desktop",
    modelSubtitle: isBrowserRuntime
      ? "Wayland Web Shell"
      : "Domicile Wayland Computer",
    processor: "Detecting…",
    graphics: "Detecting…",
    memory: "Detecting…",
    osName: "Piloti Desktop",
  });

  React.useEffect(() => {
    if (!aboutOpen) return;
    let cancelled = false;
    void probeComputerInfo(domicile, isBrowserRuntime).then((next) => {
      if (!cancelled) setInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, [aboutOpen, domicile, isBrowserRuntime]);

  const platformLabel = React.useMemo(() => {
    if (!isBrowserRuntime) {
      return info.kernel ? `Linux ${info.kernel}` : info.osName;
    }
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Firefox\//.test(ua)) return "Web Engine (Gecko)";
    if (/Edg\//.test(ua) || /Chrome\//.test(ua)) return "Web Engine (Blink)";
    if (/Safari\//.test(ua)) return "Web Engine (WebKit)";
    return "Web Engine";
  }, [info.kernel, info.osName, isBrowserRuntime]);

  const rows = [
    { label: _("Desktop"), value: `Piloti v${pkg.version}` },
    { label: _("Platform"), value: platformLabel },
    { label: _("Processor"), value: _(info.processor) },
    { label: _("Graphics"), value: _(info.graphics) },
    { label: _("Memory"), value: _(info.memory) },
  ];

  const [pos, setPos] = React.useState(() => ({
    x:
      typeof window !== "undefined"
        ? Math.max(24, Math.round((window.innerWidth - 300) / 2))
        : 240,
    y:
      typeof window !== "undefined"
        ? Math.max(48, Math.round((window.innerHeight - 340) / 2))
        : 120,
  }));

  if (!aboutOpen) return null;

  return (
    <Window
      position={pos}
      onPositionChange={setPos}
      size={{ width: 300, height: 376 }}
      draggable
      resizable={false}
      bounds="parent"
      onClose={() => setAboutOpen(false)}
      style={{ position: "fixed", top: 0, left: 0, zIndex: 420 }}
    >
      <WindowMain className="bg-adw-sidebar">
        <WindowTitlebar className="justify-end">
          <WindowControls side="right" />
        </WindowTitlebar>
        <WindowContent className="flex flex-col justify-between gap-3 p-4 pt-2">
          <div className="flex flex-col items-center gap-0.5 text-center">
            <ComputerHardwareIllustration className="mx-auto mb-1 h-18 w-28 drop-shadow-md" />
            <h2 className="text-[18px] font-bold tracking-tight text-adw-label">
              {info.computerName}
            </h2>
            <p className="text-adw-callout text-adw-label-secondary">
              {info.modelSubtitle}
            </p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2.5 rounded-adw-group bg-black/4 px-4 py-3.5 text-adw-body dark:bg-white/5">
            {rows.map((row) => (
              <React.Fragment key={row.label}>
                <dt className="font-medium text-adw-label">{row.label}</dt>
                <dd className="truncate text-right text-adw-label-secondary select-text">
                  {row.value}
                </dd>
              </React.Fragment>
            ))}
          </dl>

          <div className="flex justify-center pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setAboutOpen(false);
                launchApp("console", { payload: "inspector" });
              }}
            >
              {_("More info…")}
            </Button>
          </div>
        </WindowContent>
      </WindowMain>
    </Window>
  );
}

