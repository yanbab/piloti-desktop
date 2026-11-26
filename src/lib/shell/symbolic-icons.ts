/**
 * The theme's symbolic icons for the shell's own UI (`<SymbolicIcon>`). The
 * answers live here, so an icon draws at once when it mounts again, and every
 * name is loaded together when the theme changes.
 */
import { SYMBOLIC_ICONS, type SymbolicIconName } from "./shell-icon-names";

/** The data URL of the first candidate the icon theme has a symbolic icon for. */
export type SymbolicIconResolver = (candidates: readonly string[]) => Promise<string | undefined>;

let mode: "off" | "themed" = "off";
let generation = 0;
/** A name absent here is still loading; null means the theme has none. */
const answers = new Map<SymbolicIconName, string | null>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * `null`: the interface theme draws its own glyphs. `"loading"`: themed, the
 * icon index isn't there yet. After a theme change the previous icons stay
 * until the new ones are in.
 */
export async function setSymbolicIconResolver(next: SymbolicIconResolver | "loading" | null): Promise<void> {
  const current = ++generation;
  mode = next === null ? "off" : "themed";
  if (typeof next !== "function") {
    notify();
    return;
  }
  const loaded = await Promise.all(
    (Object.keys(SYMBOLIC_ICONS) as SymbolicIconName[]).map(async (name) => {
      const url = await next([name, ...SYMBOLIC_ICONS[name]]).catch(() => undefined);
      return [name, url ?? null] as const;
    })
  );
  if (current !== generation) return;
  for (const [name, url] of loaded) answers.set(name, url);
  notify();
}

/** A data URL; null to draw the fallback glyph; undefined while loading. */
export function getSymbolicIcon(name: SymbolicIconName): string | null | undefined {
  return mode === "off" ? null : answers.get(name);
}

export function subscribeSymbolicIcons(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
