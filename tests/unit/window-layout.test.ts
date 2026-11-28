import { describe, expect, test } from "bun:test";
import { addTab, cycleTab, pinTab, removeTab, reorderTabs, selectTab, stackOf } from "@/core/windows/layout/stack";
import {
  equalize,
  findStack,
  insertAtEdge,
  insertSurface,
  mapSurfaces,
  normalize,
  removeSurface,
  surfacesOf,
  visibleSurfaces,
} from "@/core/windows/layout/tree";
import { layoutRects, minSize, moveDivider, neighborOf, tiledEdges } from "@/core/windows/layout/geometry";
import { dropPreviewRect, dropZoneAt, fittingDrop, screenEdgeAt } from "@/core/windows/layout/drop-zones";
import { formatLayoutIni, formatTree, parseLayoutIni, parseTree } from "@/core/windows/layout/serialize";
import type { LayoutNode, SplitNode, StackNode } from "@/core/windows/layout/types";

const metrics = { tabBarHeight: 32, divider: 8 };
const noMins = () => ({ width: 0, height: 0 });
const t = (text: string) => parseTree(text)!;
const f = (node: LayoutNode | null) => (node ? formatTree(node) : null);

describe("stack", () => {
  test("adds after the pinned tabs, shows the new one", () => {
    const s = { ...stackOf("a", "b", "c"), pinned: ["a"] };
    expect(addTab(s, "d", 0)).toMatchObject({ tabs: ["a", "d", "b", "c"], active: "d" });
    expect(addTab(s, "d").tabs).toEqual(["a", "b", "c", "d"]);
  });

  test("a removed active tab hands over to the one taking its place", () => {
    const s = { ...stackOf("a", "b", "c"), active: "b" };
    expect(removeTab(s, "b")).toMatchObject({ tabs: ["a", "c"], active: "c" });
    expect(removeTab({ ...s, active: "c" }, "c")).toMatchObject({ active: "b" });
    expect(removeTab(stackOf("a"), "a")).toBeNull();
  });

  test("pins, reorders and cycles", () => {
    const s = stackOf("a", "b", "c");
    expect(pinTab(s, "c", true)).toMatchObject({ tabs: ["c", "a", "b"], pinned: ["c"] });
    expect(pinTab(pinTab(s, "c", true)!, "c", false)).toEqual({ kind: "stack", tabs: ["c", "a", "b"], active: "c" });
    expect(reorderTabs({ ...s, pinned: ["a"] }, ["b", "a", "c"])!.tabs).toEqual(["a", "b", "c"]);
    expect(reorderTabs(s, ["a", "b", "c"])).toBeNull();
    expect(cycleTab(s, 1)!.active).toBe("a");
    expect(cycleTab(s, -1)!.active).toBe("b");
    expect(selectTab(s, "c")).toBeNull();
  });
});

describe("tree", () => {
  test("normalising drops empty stacks, lone children and nested splits of one direction", () => {
    const raw: SplitNode = {
      kind: "split",
      dir: "row",
      ratios: [0.5, 0.5],
      children: [
        stackOf("a"),
        { kind: "split", dir: "row", ratios: [0.5, 0.5], children: [stackOf("b"), { kind: "stack", tabs: [], active: "" }] },
      ],
    };
    expect(f(normalize(raw))).toBe("h(50 stack(a) 50 stack(b))");
    const nested: SplitNode = { ...raw, children: [stackOf("a"), { ...raw, children: [stackOf("b"), stackOf("c")] }] };
    expect(f(normalize(nested))).toBe("h(50 stack(a) 25 stack(b) 25 stack(c))");
  });

  test("drops as a tab or beside the target", () => {
    const root = t("stack(a)");
    expect(f(insertSurface(root, "a", "b", "center"))).toBe("stack(a, *b)");
    expect(f(insertSurface(root, "a", "b", "left"))).toBe("h(50 stack(b) 50 stack(a))");
    expect(f(insertSurface(root, "a", "b", "bottom"))).toBe("v(50 stack(a) 50 stack(b))");
  });

  test("a split along the same direction shares the target's room", () => {
    const root = t("h(50 stack(a) 50 stack(b))");
    expect(f(insertSurface(root, "b", "c", "right"))).toBe("h(50 stack(a) 25 stack(b) 25 stack(c))");
    expect(f(insertSurface(root, "b", "c", "top"))).toBe("h(50 stack(a) 50 v(50 stack(c) 50 stack(b)))");
  });

  test("moving a view within the tree takes it out of its old place", () => {
    const root = t("h(50 stack(a) 50 stack(b, *c))");
    expect(f(insertSurface(root, "a", "c", "center"))).toBe("h(50 stack(a, *c) 50 stack(b))");
    expect(f(insertSurface(root, "c", "c", "bottom"))).toBe("h(50 stack(a) 50 v(50 stack(b) 50 stack(c)))");
    expect(f(insertSurface(root, "a", "b", "center"))).toBe("h(50 stack(a, *b) 50 stack(c))");
    // Its stack emptied, the split folds away.
    expect(f(insertSurface(t("h(50 stack(a) 50 stack(b))"), "a", "b", "center"))).toBe("stack(a, *b)");
    expect(insertSurface(root, "a", "a", "left")).toBeNull();
    expect(insertSurface(root, "x", "a", "left")).toBeNull();
  });

  test("removing and finding views", () => {
    const root = t("h(50 stack(a) 50 v(50 stack(b, *c) 50 stack(d)))");
    expect(findStack(root, "c")).toEqual([1, 0]);
    expect(surfacesOf(root)).toEqual(["a", "b", "c", "d"]);
    expect(visibleSurfaces(root)).toEqual(["a", "c", "d"]);
    expect(f(removeSurface(root, "d"))).toBe("h(50 stack(a) 50 stack(b, *c))");
    expect(removeSurface(t("stack(a)"), "a")).toBeNull();
  });

  test("screen edges feed the mosaic", () => {
    expect(f(insertAtEdge(null, "a", "left"))).toBe("stack(a)");
    expect(f(insertAtEdge(t("stack(a)"), "b", "left"))).toBe("h(50 stack(b) 50 stack(a))");
    expect(f(insertAtEdge(t("h(50 stack(a) 50 stack(b))"), "c", "right"))).toBe(
      "h(33.33 stack(a) 33.33 stack(b) 33.33 stack(c))",
    );
    expect(f(insertAtEdge(t("h(50 stack(a) 50 stack(b))"), "c", "top"))).toBe(
      "v(50 stack(c) 50 h(50 stack(a) 50 stack(b)))",
    );
  });

  test("equalizes and renames", () => {
    expect(f(equalize(t("h(80 stack(a) 20 stack(b))"), []))).toBe("h(50 stack(a) 50 stack(b))");
    const restored = mapSurfaces(t("h(50 stack(^x, *y) 50 stack(z))"), (k) => (k === "z" ? null : `s-${k}`));
    expect(restored).toEqual({ kind: "stack", tabs: ["s-x", "s-y"], active: "s-y", pinned: ["s-x"] });
  });
});

describe("geometry", () => {
  const frame = { x: 0, y: 0, width: 1008, height: 600 };

  test("lays out views, tab bars and dividers in whole pixels", () => {
    const out = layoutRects(t("h(50 stack(a) 50 stack(b, *c))"), frame, metrics);
    expect(out.views).toEqual([
      { surface: "a", rect: { x: 0, y: 0, width: 500, height: 600 }, visible: true, stack: [0] },
      { surface: "b", rect: { x: 508, y: 32, width: 500, height: 568 }, visible: false, stack: [1] },
      { surface: "c", rect: { x: 508, y: 32, width: 500, height: 568 }, visible: true, stack: [1] },
    ]);
    expect(out.stacks[1]!.tabBar).toEqual({ x: 508, y: 0, width: 500, height: 32 });
    expect(out.dividers).toEqual([{ split: [], index: 0, dir: "row", rect: { x: 500, y: 0, width: 8, height: 600 } }]);
  });

  test("smallest sizes add up along a split", () => {
    const mins = (s: string) => (s === "a" ? { width: 300, height: 200 } : undefined);
    expect(minSize(t("h(50 stack(a) 50 stack(b, *c))"), mins, metrics)).toEqual({ width: 548, height: 200 });
    expect(minSize(t("v(50 stack(a) 50 stack(b))"), mins, metrics)).toEqual({ width: 300, height: 368 });
  });

  test("a divider stops at its neighbours' smallest sizes", () => {
    const root = t("h(50 stack(a) 50 stack(b))");
    const mins = () => ({ width: 400, height: 100 });
    expect(f(moveDivider(root, [], 0, -50, frame, noMins, metrics))).toBe("h(45 stack(a) 55 stack(b))");
    expect(f(moveDivider(root, [], 0, 300, frame, mins, metrics))).toBe("h(60 stack(a) 40 stack(b))");
    expect(moveDivider(root, [], 1, 10, frame, noMins, metrics)).toBe(root);
  });

  test("finds the neighbour a direction points to", () => {
    const { views } = layoutRects(t("h(50 stack(a) 50 v(50 stack(b) 50 stack(c)))"), frame, metrics);
    expect(neighborOf(views, "a", "right")).toBe("b");
    expect(neighborOf(views, "c", "left")).toBe("a");
    expect(neighborOf(views, "b", "bottom")).toBe("c");
    expect(neighborOf(views, "a", "left")).toBeNull();
  });

  test("tiled edges: inner ones in a floating frame, all of them otherwise", () => {
    const left = { x: 0, y: 0, width: 500, height: 600 };
    expect(tiledEdges(left, frame, "floating")).toEqual(["right"]);
    expect(tiledEdges(left, frame, "mosaic")).toEqual(["left", "right", "top", "bottom"]);
  });
});

describe("drop zones", () => {
  const rect = { x: 100, y: 100, width: 400, height: 200 };

  test("edges split, the middle adds a tab", () => {
    expect(dropZoneAt(rect, { x: 300, y: 200 })).toBe("center");
    expect(dropZoneAt(rect, { x: 110, y: 200 })).toBe("left");
    expect(dropZoneAt(rect, { x: 300, y: 295 })).toBe("bottom");
    expect(dropZoneAt(rect, { x: 50, y: 200 })).toBeNull();
    expect(dropPreviewRect(rect, "right")).toEqual({ x: 300, y: 100, width: 200, height: 200 });
  });

  test("screen edges, except the Dock's", () => {
    const area = { x: 0, y: 30, width: 1000, height: 700 };
    expect(screenEdgeAt(area, { x: 5, y: 300 })).toBe("left");
    expect(screenEdgeAt(area, { x: 990, y: 300 })).toBe("right");
    expect(screenEdgeAt(area, { x: 500, y: 40 })).toBe("top");
    expect(screenEdgeAt(area, { x: 500, y: 725 })).toBeNull();
  });

  test("a drop that would squeeze a view under its smallest size is refused", () => {
    const mins = () => ({ width: 300, height: 100 });
    const root = t("stack(a)");
    expect(fittingDrop(root, { width: 700, height: 400 }, "a", "b", "left", mins, metrics)).not.toBeNull();
    expect(fittingDrop(root, { width: 500, height: 400 }, "a", "b", "left", mins, metrics)).toBeNull();
    expect(fittingDrop(root, { width: 500, height: 400 }, "a", "b", "center", mins, metrics)).not.toBeNull();
  });
});

describe("layout.ini", () => {
  test("trees survive keys with reserved characters", () => {
    const tree = t("h(60 stack(app:files) 40 stack(^web:https://a.org, *web:https://b.org))");
    const odd: StackNode = { kind: "stack", tabs: ["web:https://x.org/a (b), c*^%"], active: "web:https://x.org/a (b), c*^%" };
    expect(parseTree(formatTree(odd))).toEqual(odd);
    expect(parseTree(formatTree(tree))).toEqual(tree);
    expect(parseTree("h(50 stack(a)")).toBeNull();
    expect(parseTree("nope(a)")).toBeNull();
  });

  test("frames round-trip, lowest first; bad sections are skipped", () => {
    const frames = [
      { id: "w2", workspace: 1, mode: "floating" as const, rect: { x: 10, y: 20, width: 800, height: 600 }, zIndex: 9, root: t("stack(a, *b)") },
      { id: "m", workspace: 2, mode: "mosaic" as const, rect: { x: 0, y: 0, width: 0, height: 0 }, zIndex: 3, root: t("v(50 stack(c) 50 stack(d))") },
    ];
    const text = formatLayoutIni(frames);
    expect(text).toContain("[frame 1]\nworkspace=2\nmode=mosaic");
    const back = parseLayoutIni(`${text}\n[frame 3]\ntree=h(\n`);
    expect(back.map((fr) => [fr.id, fr.mode, fr.workspace, formatTree(fr.root)])).toEqual([
      ["frame-1", "mosaic", 2, "v(50 stack(c) 50 stack(d))"],
      ["frame-2", "floating", 1, "stack(a, *b)"],
    ]);
    expect(back[1]!.rect).toEqual({ x: 10, y: 20, width: 800, height: 600 });
  });
});
