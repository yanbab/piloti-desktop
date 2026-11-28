/**
 * Changes to a layout tree. Every change returns a normalised tree: no empty
 * stack, no split with fewer than two children, no split directly inside one
 * of the same direction, ratios summing to 1. `null` is an empty tree (its
 * frame goes away).
 */
import { addTab, removeTab, stackOf } from "./stack";
import type { DropZone, LayoutNode, NodePath, Side, SplitNode, StackNode, SurfaceId } from "./types";

export const isHorizontal = (side: Side): boolean => side === "left" || side === "right";
const dirOf = (side: Side): SplitNode["dir"] => (isHorizontal(side) ? "row" : "column");
const leads = (side: Side): boolean => side === "left" || side === "top";

export function surfacesOf(node: LayoutNode | null): SurfaceId[] {
  if (!node) return [];
  return node.kind === "stack" ? [...node.tabs] : node.children.flatMap(surfacesOf);
}

/** The views that show: the active tab of every stack. */
export function visibleSurfaces(node: LayoutNode | null): SurfaceId[] {
  if (!node) return [];
  return node.kind === "stack" ? [node.active] : node.children.flatMap(visibleSurfaces);
}

export function nodeAt(root: LayoutNode, path: NodePath): LayoutNode | undefined {
  let node: LayoutNode | undefined = root;
  for (const i of path) node = node?.kind === "split" ? node.children[i] : undefined;
  return node;
}

/** The path of the stack holding `surface`. */
export function findStack(root: LayoutNode | null, surface: SurfaceId): NodePath | null {
  if (!root) return null;
  if (root.kind === "stack") return root.tabs.includes(surface) ? [] : null;
  for (const [i, child] of root.children.entries()) {
    const sub = findStack(child, surface);
    if (sub) return [i, ...sub];
  }
  return null;
}

/** `fn` applied to the node at `path`, then the whole tree normalised. */
export function updateAt(
  root: LayoutNode,
  path: NodePath,
  fn: (node: LayoutNode) => LayoutNode | null,
): LayoutNode | null {
  const go = (node: LayoutNode, depth: number): LayoutNode | null => {
    if (depth === path.length) return fn(node);
    if (node.kind !== "split") return node;
    const i = path[depth]!;
    const children = node.children.map((child, j) => (j === i ? go(child, depth + 1) : child));
    return { ...node, children: children as LayoutNode[] };
  };
  return normalize(go(root, 0));
}

export function normalize(node: LayoutNode | null): LayoutNode | null {
  if (!node) return null;
  if (node.kind === "stack") {
    if (!node.tabs.length) return null;
    return node.tabs.includes(node.active) ? node : { ...node, active: node.tabs[0]! };
  }
  const children: LayoutNode[] = [];
  const weights: number[] = [];
  for (const [i, raw] of node.children.entries()) {
    const child = normalize(raw);
    const weight = Math.max(0, node.ratios[i] ?? 0) || 1 / node.children.length;
    if (!child) continue;
    if (child.kind === "split" && child.dir === node.dir) {
      for (const [j, grand] of child.children.entries()) {
        children.push(grand);
        weights.push(weight * child.ratios[j]!);
      }
    } else {
      children.push(child);
      weights.push(weight);
    }
  }
  if (!children.length) return null;
  if (children.length === 1) return children[0]!;
  const total = weights.reduce((a, b) => a + b, 0);
  return { kind: "split", dir: node.dir, children, ratios: weights.map((w) => w / total) };
}

/** `surface` taken out of the tree, wherever it is. */
export function removeSurface(root: LayoutNode | null, surface: SurfaceId): LayoutNode | null {
  const path = findStack(root, surface);
  if (!root || !path) return root;
  return updateAt(root, path, (stack) => removeTab(stack as StackNode, surface));
}

/**
 * `surface` dropped on `target`: as a tab of its stack (`center`, at `index`),
 * or in a new stack beside it. A surface already in the tree moves. `null`
 * when the drop makes no sense (no target, or onto itself alone).
 */
export function insertSurface(
  root: LayoutNode,
  target: SurfaceId,
  surface: SurfaceId,
  zone: DropZone,
  index?: number,
): LayoutNode | null {
  const targetPath = findStack(root, target);
  if (!targetPath) return null;
  const targetStack = nodeAt(root, targetPath) as StackNode;
  if (target === surface) {
    if (zone === "center" || targetStack.tabs.length < 2) return null;
  }
  // Out of its old place first; the target may have moved with it.
  const without = removeSurface(root, surface);
  const anchor = target === surface ? targetStack.tabs.find((id) => id !== surface)! : target;
  if (!without) return null;
  const path = findStack(without, anchor)!;

  if (zone === "center") {
    return updateAt(without, path, (stack) => addTab(stack as StackNode, surface, index));
  }
  const fresh = stackOf(surface);
  const dir = dirOf(zone);
  const parentPath = path.slice(0, -1);
  const parent = path.length ? nodeAt(without, parentPath) : undefined;
  if (parent?.kind === "split" && parent.dir === dir) {
    const at = path[path.length - 1]!;
    const slot = leads(zone) ? at : at + 1;
    const half = parent.ratios[at]! / 2;
    const ratios = parent.ratios.map((r, i) => (i === at ? half : r));
    ratios.splice(slot, 0, half);
    const children = [...parent.children];
    children.splice(slot, 0, fresh);
    return updateAt(without, parentPath, () => ({ ...parent, children, ratios }));
  }
  return updateAt(without, path, (stack) => ({
    kind: "split",
    dir,
    children: leads(zone) ? [fresh, stack] : [stack, fresh],
    ratios: [0.5, 0.5],
  }));
}

/**
 * `surface` added along one side of the whole tree (a window dropped on a
 * screen edge goes into the mosaic). It takes half of an unsplit tree, an
 * equal share of a split one along that side.
 */
export function insertAtEdge(root: LayoutNode | null, surface: SurfaceId, side: Side): LayoutNode {
  const tree = removeSurface(root, surface);
  const fresh = stackOf(surface);
  if (!tree) return fresh;
  const dir = dirOf(side);
  if (tree.kind === "split" && tree.dir === dir) {
    const share = 1 / (tree.children.length + 1);
    const ratios = tree.ratios.map((r) => r * (1 - share));
    const children = leads(side) ? [fresh, ...tree.children] : [...tree.children, fresh];
    return normalize({ ...tree, children, ratios: leads(side) ? [share, ...ratios] : [...ratios, share] })!;
  }
  return { kind: "split", dir, children: leads(side) ? [fresh, tree] : [tree, fresh], ratios: [0.5, 0.5] };
}

/** Same shares for every child of the split at `path`. */
export function equalize(root: LayoutNode, path: NodePath): LayoutNode {
  const node = nodeAt(root, path);
  if (node?.kind !== "split") return root;
  const ratios = node.children.map(() => 1 / node.children.length);
  return updateAt(root, path, () => ({ ...node, ratios }))!;
}

/** Every surface renamed by `fn`; those it maps to `null` leave (restoring a saved layout). */
export function mapSurfaces(
  node: LayoutNode | null,
  fn: (surface: SurfaceId) => SurfaceId | null,
): LayoutNode | null {
  const go = (n: LayoutNode): LayoutNode => {
    if (n.kind === "split") return { ...n, children: n.children.map(go) };
    const rename = (id: SurfaceId) => fn(id);
    const tabs = n.tabs.map(rename).filter((id): id is SurfaceId => id !== null);
    const pinned = n.pinned?.map(rename).filter((id): id is SurfaceId => id !== null);
    const active = rename(n.active);
    const stack: StackNode = { kind: "stack", tabs, active: active ?? tabs[0] ?? "" };
    return pinned?.length ? { ...stack, pinned } : stack;
  };
  return normalize(node ? go(node) : null);
}
