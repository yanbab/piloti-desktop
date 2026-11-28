/**
 * The window layout as data: views (surfaces) arranged in tabs (stacks) and
 * splits, inside frames. Frames float, fill the screen, or form the
 * workspace's mosaic under the floating ones.
 *
 * The tree only places views: they stay one flat list in the DOM (a page or an
 * iframe that changes parent reloads), each at the rectangle computed here.
 */

/** A view: a shell app, a Linux window, a page or an app module (`shell:…`, `wayland:…`, `web:…`). */
export type SurfaceId = string;

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Views as tabs: one shows, pinned ones lead. */
export interface StackNode {
  kind: "stack";
  tabs: SurfaceId[];
  active: SurfaceId;
  /** Always the first of `tabs`, in the same order. */
  pinned?: SurfaceId[];
}

/** Children side by side (`row`) or above one another (`column`). */
export interface SplitNode {
  kind: "split";
  dir: "row" | "column";
  children: LayoutNode[];
  /** One per child, summing to 1. */
  ratios: number[];
}

export type LayoutNode = StackNode | SplitNode;

/** Indexes into `children`, from the root. `[]` is the root. */
export type NodePath = readonly number[];

export type FrameMode = "floating" | "maximized" | "fullscreen" | "mosaic";

/** What the user calls a window. At most one `mosaic` frame per workspace. */
export interface Frame {
  id: string;
  workspace: number;
  mode: FrameMode;
  /** Where it stands when floating; the work area decides the others. */
  rect: Rect;
  zIndex: number;
  root: LayoutNode;
}

export type Side = "left" | "right" | "top" | "bottom";

/** Where a view goes when dropped on another: as a tab, or beside it. */
export type DropZone = "center" | Side;

/** Sizes of what the frame draws around views. */
export interface LayoutMetrics {
  /** Height of a stack's tab bar, when it shows one. */
  tabBarHeight: number;
  /** Width of the gap between split children. */
  divider: number;
}

/** The smallest a view can be; unknown views take `DEFAULT_MIN_SIZE`. */
export type MinSizeOf = (surface: SurfaceId) => Size | undefined;

export const DEFAULT_MIN_SIZE: Size = { width: 240, height: 160 };
