/**
 * The layout trees of all frames, keyed by frame. For now only web windows
 * have them (their tabs, each a Domicile browser window): a frame is keyed by
 * its first view, and a frame holding only that view has no record. Each
 * change returns `null` for "no change".
 */
import { addTab, stackOf } from "./stack";
import { findStack, normalize, nodeAt, removeSurface, surfacesOf, updateAt, visibleSurfaces } from "./tree";
import type { LayoutNode, NodePath, StackNode, SurfaceId } from "./types";

export type FrameRoots = Readonly<Record<string, LayoutNode>>;

/** A frame's tree; one with no record holds only the view it is named after. */
export const rootOf = (roots: FrameRoots, frame: string): LayoutNode => roots[frame] ?? stackOf(frame);

/** Which frame each view is in (views of frames with no record are left out). */
export function frameIndex(roots: FrameRoots): Map<SurfaceId, string> {
  const index = new Map<SurfaceId, string>();
  for (const [frame, root] of Object.entries(roots)) {
    for (const surface of surfacesOf(root)) index.set(surface, frame);
  }
  return index;
}

/** The stack new tabs join: the root, or the stack of the first view that shows. */
function mainStackPath(root: LayoutNode): NodePath {
  if (root.kind === "stack") return [];
  return findStack(root, visibleSurfaces(root)[0]!)!;
}

const isSolo = (frame: string, root: LayoutNode) =>
  root.kind === "stack" && root.tabs.length === 1 && root.tabs[0] === frame;

/** Drops the record of a frame left with only its own view. */
function settle(roots: Record<string, LayoutNode>, frame: string, root: LayoutNode | null) {
  if (!root || isSolo(frame, root)) delete roots[frame];
  else roots[frame] = root;
}

/**
 * `fn` applied to the stack holding `surface` in `frame` (its main stack when
 * `surface` is left out).
 */
export function updateFrameStack(
  roots: FrameRoots,
  frame: string,
  surface: SurfaceId | undefined,
  fn: (stack: StackNode) => StackNode | null,
): FrameRoots | null {
  const root = roots[frame];
  if (!root) return null;
  const path = surface === undefined ? mainStackPath(root) : findStack(root, surface);
  if (!path) return null;
  const stack = nodeAt(root, path) as StackNode;
  const changed = fn(stack);
  if (!changed) return null;
  const next = { ...roots };
  settle(next, frame, updateAt(root, path, () => changed));
  return next;
}

/**
 * View `surface` leaves frame `from` for frame `to`, at `index` among the tabs
 * of its main stack (never before the pinned ones), and shows. Says whether
 * `from` is left empty (its window goes away).
 */
export function moveToFrame(
  roots: FrameRoots,
  from: string,
  to: string,
  surface: SurfaceId,
  index: number,
): { roots: Record<string, LayoutNode>; fromEmptied: boolean } | null {
  if (from === to) return null;
  const source = rootOf(roots, from);
  const target = rootOf(roots, to);
  if (!surfacesOf(source).includes(surface) || surfacesOf(target).includes(surface)) return null;
  const next: Record<string, LayoutNode> = { ...roots };
  const remaining = removeSurface(source, surface);
  if (remaining) next[from] = remaining;
  else delete next[from];
  const path = mainStackPath(target);
  next[to] = updateAt(target, path, (stack) => addTab(stack as StackNode, surface, index))!;
  return { roots: next, fromEmptied: !remaining };
}

/** View `surface` taken out of `from` into a new frame `newFrame` of its own. */
export function detachToFrame(
  roots: FrameRoots,
  from: string,
  surface: SurfaceId,
  newFrame: string,
): Record<string, LayoutNode> | null {
  const source = roots[from];
  if (!source || surfacesOf(source).length < 2 || !surfacesOf(source).includes(surface)) return null;
  return { ...roots, [from]: removeSurface(source, surface)!, [newFrame]: stackOf(surface) };
}

/** A stack without its closed views; a closed active tab hands over to the one before it. */
function pruneTree(node: LayoutNode, alive: (surface: SurfaceId) => boolean): LayoutNode | null {
  if (node.kind === "split") {
    return normalize({ ...node, children: node.children.map((c) => pruneTree(c, alive) ?? { kind: "stack", tabs: [], active: "" }) });
  }
  const tabs = node.tabs.filter(alive);
  if (tabs.length === node.tabs.length) return node;
  if (!tabs.length) return null;
  const active = tabs.includes(node.active)
    ? node.active
    : tabs[Math.min(Math.max(0, node.tabs.indexOf(node.active) - 1), tabs.length - 1)]!;
  const { pinned: _old, ...rest } = node;
  const pinned = node.pinned?.filter(alive);
  return { ...rest, tabs, active, ...(pinned?.length ? { pinned } : {}) };
}

/**
 * Frames brought up to date with the views that exist: closed ones leave,
 * `adds` join the main stack of their frame and show.
 */
export function syncFrames(
  roots: FrameRoots,
  alive: (surface: SurfaceId) => boolean,
  adds: ReadonlyArray<readonly [frame: string, surface: SurfaceId]> = [],
): { roots: Record<string, LayoutNode>; changed: boolean } {
  let changed = adds.length > 0;
  const next: Record<string, LayoutNode> = {};
  for (const [frame, root] of Object.entries(roots)) {
    const pruned = pruneTree(root, alive);
    if (pruned !== root) changed = true;
    if (pruned) next[frame] = pruned;
  }
  for (const [frame, surface] of adds) {
    const root = rootOf(next, frame);
    next[frame] = updateAt(root, mainStackPath(root), (stack) => addTab(stack as StackNode, surface))!;
  }
  for (const [frame, root] of Object.entries(next)) {
    if (isSolo(frame, root)) {
      delete next[frame];
      changed = true;
    }
  }
  return { roots: changed ? next : (roots as Record<string, LayoutNode>), changed };
}
