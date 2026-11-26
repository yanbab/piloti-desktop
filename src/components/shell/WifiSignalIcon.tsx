import { WifiHighIcon, WifiIcon, WifiLowIcon } from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import { useDesktopSettings } from "@/context/DesktopStateContext";

/**
 * Wi-Fi by signal strength (percent; unknown draws full). Adwaita uses GNOME's
 * signal icons, the other themes Lucide's arcs.
 */
export function WifiSignalIcon({ signal = 100, className }: { signal?: number; className?: string }) {
  const { interfaceTheme } = useDesktopSettings(["interfaceTheme"]);
  const level = signal < 40 ? "low" : signal < 70 ? "medium" : "full";
  const Glyph = { low: WifiLowIcon, medium: WifiHighIcon, full: WifiIcon }[level];
  if (interfaceTheme !== "adwaita") return <Glyph className={className} data-wifi={level} />;
  const name = ({ low: "weak", medium: "ok", full: "excellent" } as const)[level];
  return <SymbolicIcon name={`network-wireless-signal-${name}`} fallback={Glyph} className={className} data-wifi={level} />;
}
