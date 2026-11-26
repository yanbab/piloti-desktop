import { Volume1Icon, Volume2Icon, VolumeIcon, VolumeXIcon } from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import { useDesktopSettings } from "@/context/DesktopStateContext";

const LEVELS = {
  muted: { glyph: VolumeXIcon, name: "audio-volume-muted" },
  low: { glyph: VolumeIcon, name: "audio-volume-low" },
  medium: { glyph: Volume1Icon, name: "audio-volume-medium" },
  high: { glyph: Volume2Icon, name: "audio-volume-high" },
} as const;

/**
 * The speaker by sound level (percent; 0 is muted). Adwaita uses GNOME's
 * volume icons, the other themes Lucide's.
 */
export function SoundVolumeIcon({ volume, muted, className }: { volume: number; muted?: boolean; className?: string }) {
  const { interfaceTheme } = useDesktopSettings(["interfaceTheme"]);
  const level = muted || volume === 0 ? "muted" : volume < 34 ? "low" : volume < 67 ? "medium" : "high";
  const { glyph: Glyph, name } = LEVELS[level];
  if (interfaceTheme !== "adwaita") return <Glyph className={className} data-volume={level} />;
  return <SymbolicIcon name={name} fallback={Glyph} className={className} data-volume={level} />;
}
