import { PilotiSymbolicIcon } from "@/components/shell/PilotiLogo";
import { MonitorIcon } from "@/components/ui/symbols";
import type { GreeterSessionOption } from "@/lib/engine-native";

/** A session's `Icon`; a monitor when it has none or the theme lacks it. */
export function SessionIcon({ session }: { session: GreeterSessionOption }) {
  const { icon, iconUrl } = session;
  // Piloti's own symbol is drawn here, so it needs no theme lookup.
  if (icon === "piloti-desktop-symbolic") return <PilotiSymbolicIcon className="size-4" />;
  if (!iconUrl) return <MonitorIcon className="size-4 shrink-0 opacity-85" />;
  if (!icon?.endsWith("-symbolic")) {
    return <img src={iconUrl} alt="" className="size-4 shrink-0 object-contain" />;
  }
  // Symbolic icons take the text colour.
  const mask = `url("${iconUrl}") center / contain no-repeat`;
  return <span aria-hidden="true" className="size-4 shrink-0 bg-current" style={{ mask, WebkitMask: mask }} />;
}
