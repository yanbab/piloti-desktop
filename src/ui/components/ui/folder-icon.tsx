import { isLottieIconUrl, LottieIcon } from "@/ui/components/ui/lottie-icon";
import { useAppIcons } from "@/ui/components/app-icons";
import type { AccentColorId } from "@/core/data/catalog";
import { DynamicFolderIcon, FolderBadge, inferFolderBadge } from "@/ui/components/folder-icons";
import { cn } from "@/core/util/utils";

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
  const getAppIconUrl = useAppIcons()?.getAppIconUrl;
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
