import { DesktopBackgroundLayers } from "@/shell/desktop/DesktopBackgroundLayers";
import * as React from "react";
import { usePiloti } from "@/lib/engine/piloti";
import { Button } from "@/components/ui/button";
import {
  Window,
  isCloseOnLeft,
  WindowControls,
  WindowMain,
} from "@/components/ui/window";
import { PILOTI_VERSION } from "@/lib/core/version";
import {
  useWindowActions,
  useWindowManagerSelector,
  useSettingsSelector,
  useDesktopSetting,
} from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { type ComputerInfo, probeComputerInfo } from "@/lib/core/system-info";
import { useCapabilities } from "@/hooks/use-capabilities";

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

/** An external monitor on a stand, same size and style as the laptop. */
export function MonitorHardwareIllustration({
  className,
  screenContent,
}: {
  className?: string;
  screenContent?: React.ReactNode;
}) {
  return (
    <svg viewBox="0 0 160 112" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="piloti-monitor-stand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcdce0" />
          <stop offset="100%" stopColor="#aeaeb4" />
        </linearGradient>
      </defs>
      {/* Stand */}
      <path d="M70 84h20l3 14H67l3-14Z" fill="url(#piloti-monitor-stand)" />
      <rect x="52" y="97" width="56" height="4" rx="2" fill="#a2a2a8" />
      {/* Bezel */}
      <rect x="10" y="6" width="140" height="80" rx="5" fill="#161618" stroke="#4a4a50" strokeWidth="1.5" />
      {screenContent ? (
        <foreignObject x="14" y="10" width="132" height="72">
          <div className="relative h-full w-full overflow-hidden rounded-[2px]">{screenContent}</div>
        </foreignObject>
      ) : (
        <rect x="14" y="10" width="132" height="72" rx="2" fill="#2a6fd6" />
      )}
      <rect x="14" y="10" width="132" height="5" fill="rgb(0 0 0 / 0.25)" />
      {/* Shadow */}
      <ellipse cx="80" cy="104" rx="40" ry="3" fill="rgb(0 0 0 / 0.22)" />
    </svg>
  );
}

const PENDING_INFO: ComputerInfo = {
  computerName: "",
  modelSubtitle: "",
  processor: "Detecting…",
  graphics: "Detecting…",
  memory: "Detecting…",
  osName: "Piloti Desktop",
};
let lastInfo: ComputerInfo | null = null;

/**
 * macOS "About This Mac"-inspired About Computer window built with Adwaita grouped rows.
 */
export function AboutComputerDialog() {
  const piloti = usePiloti();
  const { simulatedHardware } = useCapabilities();
  const closeOnLeft = isCloseOnLeft(useDesktopSetting("windowButtonLayout"));
  const aboutOpen = useWindowManagerSelector((wm) => wm.aboutOpen);
  const { setAboutOpen, launchApp } = useWindowActions();
  // The last probe, or blank: never a made-up name that changes under the eyes.
  const [info, setInfo] = React.useState<ComputerInfo>(() => lastInfo ?? PENDING_INFO);

  React.useEffect(() => {
    if (!aboutOpen) return;
    let cancelled = false;
    void probeComputerInfo(piloti, simulatedHardware).then((next) => {
      lastInfo = next;
      if (!cancelled) setInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, [aboutOpen, piloti, simulatedHardware]);

  const platformLabel = React.useMemo(() => {
    if (!simulatedHardware) {
      return info.kernel ? `Linux ${info.kernel}` : info.osName;
    }
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Firefox\//.test(ua)) return "Web Engine (Gecko)";
    if (/Edg\//.test(ua) || /Chrome\//.test(ua)) return "Web Engine (Blink)";
    if (/Safari\//.test(ua)) return "Web Engine (WebKit)";
    return "Web Engine";
  }, [info.kernel, info.osName, simulatedHardware]);

  const rows = [
    { label: _("Desktop"), value: `Piloti v${PILOTI_VERSION}` },
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
        ? Math.max(48, Math.round((window.innerHeight - 420) / 2))
        : 120,
  }));

  // The window fits its content (measured once rendered).
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = React.useState(420);
  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!aboutOpen || !el) return;
    const measure = () => setContentHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aboutOpen]);

  if (!aboutOpen) return null;

  return (
    <Window
      position={pos}
      onPositionChange={setPos}
      size={{ width: 300, height: contentHeight }}
      draggable
      resizable={false}
      bounds="parent"
      buttonLayout={closeOnLeft ? "close:" : ":close"}
      onClose={() => setAboutOpen(false)}
      style={{ position: "fixed", top: 0, left: 0, zIndex: 420 }}
    >
      <WindowMain className="relative">
        {/* Measured: the window is exactly as tall as its content. */}
        <div ref={contentRef} className="flex flex-col rounded-[inherit]">
          {/* Vibrant header strip, edge to edge, over a solid body; drag it
              to move. */}
          <header
            data-window-drag-region=""
            className="relative flex flex-col items-center gap-1 rounded-t-[inherit] border-b border-ui-separator bg-ui-sidebar px-4 pt-4 pb-4 text-center"
          >
            <div className={cn("absolute top-2.5", closeOnLeft ? "left-2.5" : "right-2.5")} data-window-no-drag>
              <WindowControls side={closeOnLeft ? "left" : "right"} />
            </div>
            <ComputerHardwareIllustration
              className="pointer-events-none mb-1 h-24 w-38 shrink-0 drop-shadow-md"
              screenContent={<DesktopBackgroundLayers />}
            />
            {/* font-bold maps to the UI's semibold weight: the title is heavier. */}
            {/* A no-break space holds each line until the probe answers. */}
            <h2 className="w-full truncate text-ui-title font-extrabold text-ui-label">
              {info.computerName || "\u00a0"}
            </h2>
            {/* Two lines: the model, then the architecture. */}
            <p className="w-full text-ui-body text-ui-label-secondary">
              {[0, 1].map((line) => (
                <span key={line} className="block truncate">
                  {info.modelSubtitle.split(" · ")[line] || "\u00a0"}
                </span>
              ))}
            </p>
          </header>

          <div className="flex flex-col gap-4 rounded-b-[inherit] bg-ui-window p-4">
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2.5 rounded-ui-box bg-black/4 px-4 py-3.5 text-ui-body dark:bg-white/5">
            {rows.map((row) => (
              <React.Fragment key={row.label}>
                <dt className="font-medium text-ui-label">{row.label}</dt>
                <dd className="truncate text-right text-ui-label-secondary select-text">
                  {row.value}
                </dd>
              </React.Fragment>
            ))}
          </dl>

          <div className="flex justify-center">
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
          </div>
        </div>
      </WindowMain>
    </Window>
  );
}

