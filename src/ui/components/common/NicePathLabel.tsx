import * as React from "react";
import { HomeIcon } from "@/ui/components/ui/symbols";
import { useApps } from "@/ui/context/DesktopStateContext";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import {
  looksLikeAbsolutePath,
  NICE_PATH_DEVICE_ICON_KEY,
  NICE_PATH_SEPARATOR,
  resolveNicePath,
} from "@/core/files/nice-path";

/** Finder-style location: [device icon] Desktop ▸ Screenshot.png (full path in tooltip). */
export function NicePathLabel({
  path,
  className,
  showIcon = true,
}: {
  path: string;
  className?: string;
  showIcon?: boolean;
}) {
  const { getAppIconUrl } = useApps();
  const nice = React.useMemo(() => resolveNicePath(path), [path]);
  const iconKey = NICE_PATH_DEVICE_ICON_KEY[nice.device];
  const iconUrl = iconKey ? getAppIconUrl(iconKey) : undefined;
  const showDeviceLabel = nice.device !== "home" || nice.segments.length === 0;
  const parts = [
    ...(showDeviceLabel ? [_(nice.deviceLabel)] : []),
    ...nice.segments.map((seg, i) => (nice.device === "home" && i === 0 ? _(seg) : seg)),
  ];
  return (
    <span
      title={nice.volumeLabel ? `${nice.volumeLabel} — ${path}` : path}
      className={cn("inline-flex max-w-full min-w-0 items-center gap-1 align-middle", className)}
    >
      {showIcon &&
        (iconUrl ? (
          <img src={iconUrl} alt="" draggable={false} className="size-3.5 shrink-0 object-contain" />
        ) : nice.device === "home" ? (
          <HomeIcon className="size-3 shrink-0 opacity-70" />
        ) : null)}
      <span className="min-w-0 truncate">{parts.join(NICE_PATH_SEPARATOR)}</span>
    </span>
  );
}

/** Renders notification body text; lines that are absolute paths become nice paths. */
export function NotificationBodyText({ body }: { body: string }) {
  const lines = body.split("\n");
  if (!lines.some(looksLikeAbsolutePath)) return <>{body}</>;
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {looksLikeAbsolutePath(line) ? <NicePathLabel path={line.trim()} /> : line}
        </React.Fragment>
      ))}
    </>
  );
}
