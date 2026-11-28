import * as React from "react";
import { AppSquircleIcon } from "@/ui/components/common/AppSymbol";
import { DockItem } from "@/ui/components/ui/dock";
import { cn } from "@/core/util/utils";
import type { DriveInfo } from "@/core/ports/hardware";

/** `plays` replays the animated icon on the way in and out. */
type Shown = { drive: DriveInfo; state: "entering" | "idle" | "exiting"; plays: number };
const EXIT_MS = 480;

/** One tile per removable drive, popping in; a removed one stays to pop out. */
export function DockDrives({
  drives,
  iconUrl,
  onOpen,
}: {
  drives: readonly DriveInfo[];
  iconUrl: (drive: DriveInfo) => string | undefined;
  onOpen: (drive: DriveInfo, tile: HTMLElement) => void;
}) {
  // Drives present from the start are simply there.
  const [shown, setShown] = React.useState<Shown[]>(() => drives.map((drive) => ({ drive, state: "idle", plays: 0 })));

  React.useEffect(() => {
    setShown((prev) => {
      const before = new Map(prev.map((s) => [s.drive.id, s]));
      const now = drives.map((drive): Shown => {
        const was = before.get(drive.id);
        const back = !was || was.state === "exiting";
        return { drive, state: back ? "entering" : was.state, plays: (was?.plays ?? 0) + (back ? 1 : 0) };
      });
      const leaving = prev
        .filter((s) => !drives.some((d) => d.id === s.drive.id))
        .map((s): Shown => ({ ...s, state: "exiting", plays: s.plays + (s.state === "exiting" ? 0 : 1) }));
      return [...now, ...leaving];
    });
  }, [drives]);

  React.useEffect(() => {
    if (shown.every((s) => s.state === "idle")) return;
    const frame = window.requestAnimationFrame(() =>
      setShown((prev) => prev.map((s) => (s.state === "entering" ? { ...s, state: "idle" } : s))),
    );
    const timer = shown.some((s) => s.state === "exiting")
      ? window.setTimeout(() => setShown((prev) => prev.filter((s) => s.state !== "exiting")), EXIT_MS)
      : 0;
    return () => {
      window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
    };
  }, [shown]);

  return shown.map(({ drive, state, plays }) => (
    <DockItem
      key={drive.id}
      label={drive.label}
      tileProps={{
        "data-dock-context": `drive:${drive.id}`,
        ...(drive.mountPath ? { "data-vfs-drop-path": drive.mountPath } : {}),
        className: cn(
          "transition-all duration-300 ease-out",
          state === "entering" && "scale-75 opacity-0",
          state === "idle" && "scale-100 opacity-100",
          state === "exiting" && "scale-75 -translate-y-1 opacity-0",
        ),
      }}
      onClick={(e) => onOpen(drive, e.currentTarget as HTMLElement)}
    >
      <AppSquircleIcon iconUrl={iconUrl(drive)} animateOnHover playNonce={plays} className="size-full" />
    </DockItem>
  ));
}
