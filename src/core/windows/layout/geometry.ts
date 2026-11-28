/** Rectangles for a layout tree: where each view, tab bar and divider goes. */
import { nodeAt, updateAt } from "./tree";
import {
  DEFAULT_MIN_SIZE,
  type FrameMode,
  type LayoutMetrics,
  type LayoutNode,
  type MinSizeOf,
  type NodePath,
  type Rect,
  type Side,
  type Size,
  type SplitNode,
  type SurfaceId,
} from "./types";

export interface ViewPlacement {
  surface: SurfaceId;
  rect: Rect;
  /** The active tab of its stack; the others are hidden, not unmounted. */
  visible: boolean;
  stack: NodePath;
}

export interface StackPlacement {
  path: NodePath;
  rect: Rect;
  /** From two tabs on. */
  tabBar: Rect | null;
  content: Rect;
}

export interface DividerPlacement {
  /** The split it belongs to; it sits after child `index`. */
  split: NodePath;
  index: number;
  dir: SplitNode["dir"];
  rect: Rect;
}

export interface LayoutPlacement {
  views: ViewPlacement[];
  stacks: StackPlacement[];
  dividers: DividerPlacement[];
}

const along = (dir: SplitNode["dir"]) => (dir === "row" ? "width" : "height");

/** `total` px shared by `ratios`, whole pixels, the last taking what rounding leaves. */
function shares(total: number, ratios: readonly number[]): number[] {
  const out = ratios.map((r) => Math.floor(total * r));
  out[out.length - 1] = total - out.slice(0, -1).reduce((a, b) => a + b, 0);
  return out;
}

const showsTabBar = (node: LayoutNode): boolean => node.kind === "stack" && node.tabs.length > 1;

export function layoutRects(root: LayoutNode, rect: Rect, metrics: LayoutMetrics): LayoutPlacement {
  const out: LayoutPlacement = { views: [], stacks: [], dividers: [] };
  const go = (node: LayoutNode, box: Rect, path: number[]) => {
    if (node.kind === "stack") {
      const bar = showsTabBar(node) ? Math.min(metrics.tabBarHeight, box.height) : 0;
      const content = { x: box.x, y: box.y + bar, width: box.width, height: box.height - bar };
      out.stacks.push({
        path,
        rect: box,
        tabBar: bar ? { x: box.x, y: box.y, width: box.width, height: bar } : null,
        content,
      });
      for (const surface of node.tabs) {
        out.views.push({ surface, rect: content, visible: surface === node.active, stack: path });
      }
      return;
    }
    const key = along(node.dir);
    const gaps = metrics.divider * (node.children.length - 1);
    const sizes = shares(Math.max(0, box[key] - gaps), node.ratios);
    let offset = node.dir === "row" ? box.x : box.y;
    for (const [i, child] of node.children.entries()) {
      const size = sizes[i]!;
      const childBox =
        node.dir === "row"
          ? { x: offset, y: box.y, width: size, height: box.height }
          : { x: box.x, y: offset, width: box.width, height: size };
      go(child, childBox, [...path, i]);
      offset += size;
      if (i < node.children.length - 1) {
        out.dividers.push({
          split: path,
          index: i,
          dir: node.dir,
          rect:
            node.dir === "row"
              ? { x: offset, y: box.y, width: metrics.divider, height: box.height }
              : { x: box.x, y: offset, width: box.width, height: metrics.divider },
        });
        offset += metrics.divider;
      }
    }
  };
  go(root, rect, []);
  return out;
}

/** The smallest a node can be: splits add up their children, stacks take their largest tab. */
export function minSize(node: LayoutNode, minOf: MinSizeOf, metrics: LayoutMetrics): Size {
  if (node.kind === "stack") {
    const bar = showsTabBar(node) ? metrics.tabBarHeight : 0;
    let width = 0;
    let height = 0;
    for (const tab of node.tabs) {
      const min = minOf(tab) ?? DEFAULT_MIN_SIZE;
      width = Math.max(width, min.width);
      height = Math.max(height, min.height);
    }
    return { width, height: height + bar };
  }
  const mins = node.children.map((child) => minSize(child, minOf, metrics));
  const gaps = metrics.divider * (node.children.length - 1);
  return node.dir === "row"
    ? { width: mins.reduce((a, m) => a + m.width, 0) + gaps, height: Math.max(...mins.map((m) => m.height)) }
    : { width: Math.max(...mins.map((m) => m.width)), height: mins.reduce((a, m) => a + m.height, 0) + gaps };
}

export const fitsIn = (min: Size, rect: Pick<Rect, "width" | "height">): boolean =>
  min.width <= rect.width && min.height <= rect.height;

/**
 * Divider `index` of the split at `split` (laid out in `splitRect`) moved by
 * `delta` px. Only its two neighbours change, and neither goes under its
 * smallest size.
 */
export function moveDivider(
  root: LayoutNode,
  split: NodePath,
  index: number,
  delta: number,
  splitRect: Rect,
  minOf: MinSizeOf,
  metrics: LayoutMetrics,
): LayoutNode {
  const node = nodeAt(root, split);
  if (node?.kind !== "split" || index < 0 || index >= node.children.length - 1) return root;
  const key = along(node.dir);
  const total = Math.max(1, splitRect[key] - metrics.divider * (node.children.length - 1));
  const sizes = shares(total, node.ratios);
  const pair = sizes[index]! + sizes[index + 1]!;
  const minA = minSize(node.children[index]!, minOf, metrics)[key];
  const minB = minSize(node.children[index + 1]!, minOf, metrics)[key];
  if (minA + minB > pair) return root;
  const a = Math.min(Math.max(sizes[index]! + delta, minA), pair - minB);
  if (a === sizes[index]) return root;
  const ratios = [...node.ratios];
  const pairRatio = ratios[index]! + ratios[index + 1]!;
  ratios[index] = (pairRatio * a) / pair;
  ratios[index + 1] = pairRatio - ratios[index]!;
  return updateAt(root, split, () => ({ ...node, ratios })) ?? root;
}

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** The visible view next to `from` towards `side`: it must face it, the closest wins. */
export function neighborOf(views: readonly ViewPlacement[], from: SurfaceId, side: Side): SurfaceId | null {
  const shown = views.filter((v) => v.visible);
  const origin = shown.find((v) => v.surface === from)?.rect;
  if (!origin) return null;
  const horizontal = side === "left" || side === "right";
  let best: { surface: SurfaceId; distance: number; offset: number } | null = null;
  for (const view of shown) {
    if (view.surface === from) continue;
    const r = view.rect;
    const distance =
      side === "left" ? origin.x - (r.x + r.width)
      : side === "right" ? r.x - (origin.x + origin.width)
      : side === "top" ? origin.y - (r.y + r.height)
      : r.y - (origin.y + origin.height);
    if (distance < -1) continue;
    const overlaps = horizontal
      ? r.y < origin.y + origin.height && r.y + r.height > origin.y
      : r.x < origin.x + origin.width && r.x + r.width > origin.x;
    if (!overlaps) continue;
    const offset = horizontal
      ? Math.abs(center(r).y - center(origin).y)
      : Math.abs(center(r).x - center(origin).x);
    if (!best || distance < best.distance || (distance === best.distance && offset < best.offset)) {
      best = { surface: view.surface, distance, offset };
    }
  }
  return best?.surface ?? null;
}

/**
 * The edges of a view that touch a neighbour or the screen, for the xdg
 * `Tiled*` states (GTK then drops its shadows and rounded corners there).
 * `view` is its stack's rectangle, tab bar included.
 */
export function tiledEdges(view: Rect, frame: Rect, mode: FrameMode): Side[] {
  if (mode !== "floating") return ["left", "right", "top", "bottom"];
  const edges: Side[] = [];
  if (view.x > frame.x) edges.push("left");
  if (view.x + view.width < frame.x + frame.width) edges.push("right");
  if (view.y > frame.y) edges.push("top");
  if (view.y + view.height < frame.y + frame.height) edges.push("bottom");
  return edges;
}
