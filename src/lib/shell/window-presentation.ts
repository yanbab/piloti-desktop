/**
 * Window presentations and plugin window-menu items.
 *
 * A presentation shows a window somewhere else, scaled, without touching its
 * real geometry, the way the overview does (Picture-in-Picture, previews…).
 * The window manager reads this store when it renders windows; plugins write
 * to it through `ctx.windows`.
 */

/** Rectangle in work-area (window stage) coordinates. */
export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowPresentation {
  /** Top-left corner of the presented window, in stage coordinates. */
  x: number;
  y: number;
  /** Presented width; the window is scaled uniformly to it. */
  width: number;
  /** Keep it above normal windows. */
  above?: boolean;
  /**
   * When false, the window content gets no pointer events: an overlay takes
   * them and forwards them to the callbacks below. Defaults to true.
   */
  interactive?: boolean;
  /** Animate the change (default true); turn off while dragging. */
  animate?: boolean;
  /**
   * Floating window: the shell moves it (drag anywhere; edges snap and
   * resist) and, when resizable, scales it from its borders, keeping the
   * aspect ratio. Implies a non-interactive window.
   */
  floating?: { resizable?: boolean; minWidth?: number; maxWidth?: number };
  /** Called after the user moved or resized a floating presentation. */
  onChange?: (rect: { x: number; y: number; width: number }) => void;
  onPointerDown?: (event: PointerEvent) => void;
  onDoubleClick?: (event: MouseEvent) => void;
}

export interface WindowMenuItem {
  /** Unique across plugins (the plugin id is prefixed by the shell). */
  id: string;
  label: string;
  /** Shown with a check mark when it returns true. */
  checked?: (windowId: string) => boolean;
  /** Hidden when it returns false. */
  visible?: (windowId: string) => boolean;
  onSelect: (windowId: string) => void;
}

type Listener = () => void;

let presentations: ReadonlyMap<string, WindowPresentation> = new Map();
let menuItems: readonly WindowMenuItem[] = [];
let workArea: WorkArea = { x: 0, y: 0, width: 0, height: 0 };
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeWindowPresentation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Presentations ────────────────────────────────────────────────────────────

export function getWindowPresentations(): ReadonlyMap<string, WindowPresentation> {
  return presentations;
}

export function getWindowPresentation(windowId: string): WindowPresentation | undefined {
  return presentations.get(windowId);
}

export function setWindowPresentation(
  windowId: string,
  presentation: WindowPresentation | null
): void {
  if (!presentation && !presentations.has(windowId)) return;
  const next = new Map(presentations);
  if (presentation) next.set(windowId, presentation);
  else next.delete(windowId);
  presentations = next;
  emit();
}

/** Drops presentations of windows that no longer exist. */
export function pruneWindowPresentations(liveWindowIds: ReadonlySet<string>): void {
  const stale = [...presentations.keys()].filter((id) => !liveWindowIds.has(id));
  if (stale.length === 0) return;
  const next = new Map(presentations);
  for (const id of stale) next.delete(id);
  presentations = next;
  emit();
}

// ── Work area ────────────────────────────────────────────────────────────────

export function getWorkArea(): WorkArea {
  return workArea;
}

export function setWorkArea(next: WorkArea): void {
  if (
    next.x === workArea.x &&
    next.y === workArea.y &&
    next.width === workArea.width &&
    next.height === workArea.height
  ) {
    return;
  }
  workArea = next;
  emit();
}

// ── Window menu items ────────────────────────────────────────────────────────

export function getWindowMenuItems(): readonly WindowMenuItem[] {
  return menuItems;
}

export function addWindowMenuItem(item: WindowMenuItem): () => void {
  menuItems = [...menuItems.filter((i) => i.id !== item.id), item];
  emit();
  return () => {
    const before = menuItems.length;
    menuItems = menuItems.filter((i) => i !== item);
    if (menuItems.length !== before) emit();
  };
}

/**
 * Transform that moves a window from its natural rectangle to its
 * presentation, for a window placed with `transform-origin: top left`.
 */
export function presentationTransform(
  natural: { x: number; y: number; width: number },
  presentation: WindowPresentation
): { scale: number; dx: number; dy: number } {
  const scale = natural.width > 0 ? presentation.width / natural.width : 1;
  return {
    scale,
    dx: presentation.x - natural.x,
    dy: presentation.y - natural.y,
  };
}
