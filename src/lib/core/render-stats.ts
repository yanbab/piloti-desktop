/**
 * Cheap per-component render counters (a Map increment per render), shown in
 * Console ▸ Infos ▸ Performance. Used to check that shell chrome (MenuBar,
 * Dock, Launcher…) doesn't re-render on unrelated window changes.
 */
const renderCounts = new Map<string, number>();

export function countRender(name: string): void {
  renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);
}

export function getRenderCounts(): Record<string, number> {
  return Object.fromEntries([...renderCounts.entries()].sort((a, b) => b[1] - a[1]));
}

export function resetRenderCounts(): void {
  renderCounts.clear();
}

if (typeof window !== "undefined") {
  (window as unknown as { __PILOTI_RENDER_COUNTS__?: () => Record<string, number> }).__PILOTI_RENDER_COUNTS__ =
    getRenderCounts;
}
