import * as React from "react";
import { createPortal } from "react-dom";
import { Window, WindowControls, WindowMain } from "@/components/ui/window";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { useApps } from "@/context/DesktopStateContext";
import type { AppDefinition } from "@/data/catalog";
import { _ } from "@/lib/core/i18n";
import { PILOTI_VERSION } from "@/lib/core/version";

const WIDTH = 280;

/**
 * "About <App>": one small vibrant window per app (Help ▸ About), moved by
 * dragging it anywhere. Rendered on the page body, so it can go anywhere on
 * the desktop. `index` staggers several open About windows.
 */
export function AppAboutWindow({
  app,
  index,
  onClose,
}: {
  app: AppDefinition;
  index: number;
  onClose: () => void;
}) {
  const { getAppIconUrl } = useApps();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = React.useState(240);
  const [pos, setPos] = React.useState(() => ({
    x: Math.max(24, Math.round((window.innerWidth - WIDTH) / 2) + index * 24),
    y: Math.max(48, Math.round((window.innerHeight - 260) / 2) + index * 24),
  }));

  // The window is as tall as its content.
  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return createPortal(
    <Window
      position={pos}
      onPositionChange={setPos}
      size={{ width: WIDTH, height }}
      draggable
      resizable={false}
      onClose={onClose}
      style={{ position: "fixed", top: 0, left: 0, zIndex: 420 + index }}
    >
      <WindowMain className="relative bg-adw-sidebar">
        <div className="absolute top-2.5 right-2.5 z-10" data-window-no-drag>
          <WindowControls side="right" />
        </div>
        {/* Drag it from anywhere. */}
        <div
          ref={contentRef}
          data-window-drag-region=""
          className="flex flex-col items-center gap-1.5 px-5 pt-6 pb-5 text-center"
        >
          <AppSquircleIcon
            iconName={app.iconName}
            iconUrl={getAppIconUrl(app.id) ?? app.iconUrl}
            gradient={app.gradient}
            squircle={false}
            className="mb-1 size-16"
            glyphClassName="size-9"
          />
          {/* font-bold maps to the UI's semibold weight: the title is heavier. */}
          <h2 className="text-adw-title-2 font-extrabold text-adw-label">{_(app.name)}</h2>
          <p className="text-adw-callout text-adw-label-secondary">{_(app.description)}</p>
          <span className="mt-1.5 rounded-full bg-black/6 px-2.5 py-0.5 text-adw-subheadline font-medium tabular-nums text-adw-label-secondary dark:bg-white/10">
            {_("Version %s", PILOTI_VERSION)}
          </span>
        </div>
      </WindowMain>
    </Window>,
    document.body
  );
}
