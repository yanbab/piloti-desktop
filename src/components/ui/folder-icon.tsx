import { isLottieIconUrl, LottieIcon } from "@/components/ui/lottie-icon";
import { useOptionalApps } from "@/context/AppsContext";
import type { AccentColorId } from "@/data/catalog";
import { DynamicFolderIcon, FolderBadge, inferFolderBadge } from "@/data/folder-icons";
import { cn } from "@/lib/core/utils";

/**
 * The one way to draw a folder: the icon theme's animated folder, with the
 * badge of a special folder (Documents, Music…) on its front; the drawn folder
 * when the theme has no animated one.
 */
export function ThemeFolderIcon({
  pathOrName,
  accentColor,
  opened = false,
  playNonce,
  className,
}: {
  pathOrName?: string;
  accentColor?: AccentColorId;
  opened?: boolean;
  /** Bumped to play the drop pulse. */
  playNonce?: number;
  className?: string;
}) {
  const getAppIconUrl = useOptionalApps()?.getAppIconUrl;
  const url = [getAppIconUrl?.("folder"), getAppIconUrl?.("folder-open")].find(isLottieIconUrl);
  if (!url) {
    return <DynamicFolderIcon accentColor={accentColor} opened={opened} pathOrName={pathOrName} className={className} />;
  }
  const badge = inferFolderBadge(pathOrName);
  return (
    <span className={cn("relative block", className)}>
      {/* Folders open on drag-over and when opened, not on hover. */}
      <LottieIcon src={url} open={opened} animateOnHover={false} playNonce={playNonce} className="size-full" />
      {badge && <FolderBadge badge={badge} accentColor={accentColor} opened={opened} />}
    </span>
  );
}
