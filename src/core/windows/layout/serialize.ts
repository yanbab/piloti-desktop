/**
 * The layout as text, for `~/.local/state/piloti/layout.ini`, readable and
 * editable by hand:
 *
 *     [frame 1]
 *     workspace=1
 *     mode=mosaic
 *     tree=h(60 stack(app:files) 40 v(50 stack(app:terminal) 50 stack(^web:https://a.org, *web:https://b.org)))
 *
 * A stack lists its views by key (`*` active, `^` pinned); `h` and `v` are
 * row and column splits, each child after its share. Keys are what finds a
 * view again after a restart (URL, desktop id…): the caller maps them.
 */
import { parseIniText, serializeIniText, type IniRecord } from "@/core/config/ini";
import { normalize } from "./tree";
import type { Frame, FrameMode, LayoutNode, Rect, StackNode, SurfaceId } from "./types";

const RESERVED = /[%(),*^ \t\r\n]/g;
const escapeKey = (key: string) => key.replace(RESERVED, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
const unescapeKey = (key: string) => key.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

const share = (ratio: number) => String(Math.round(ratio * 10000) / 100);

export function formatTree(node: LayoutNode, keyOf: (surface: SurfaceId) => string = (s) => s): string {
  if (node.kind === "stack") {
    const tabs = node.tabs.map(
      (id) => `${node.pinned?.includes(id) ? "^" : ""}${id === node.active && node.tabs.length > 1 ? "*" : ""}${escapeKey(keyOf(id))}`,
    );
    return `stack(${tabs.join(", ")})`;
  }
  const parts = node.children.map((child, i) => `${share(node.ratios[i]!)} ${formatTree(child, keyOf)}`);
  return `${node.dir === "row" ? "h" : "v"}(${parts.join(" ")})`;
}

/** The tree written by `formatTree`, its views named by key; `null` if the text is not one. */
export function parseTree(text: string): LayoutNode | null {
  let at = 0;
  const skip = () => {
    while (at < text.length && /[ \t\r\n]/.test(text[at]!)) at++;
  };
  const expect = (c: string) => {
    skip();
    if (text[at] !== c) throw new SyntaxError(`expected ${c} at ${at}`);
    at++;
  };
  const word = (): string => {
    skip();
    const start = at;
    while (at < text.length && !/[ \t\r\n(),]/.test(text[at]!)) at++;
    return text.slice(start, at);
  };
  const node = (): LayoutNode => {
    const name = word();
    expect("(");
    if (name === "stack") {
      const stack: StackNode = { kind: "stack", tabs: [], active: "" };
      const pinned: SurfaceId[] = [];
      for (;;) {
        let raw = word();
        let isPinned = false;
        let isActive = false;
        while (raw.startsWith("^") || raw.startsWith("*")) {
          if (raw[0] === "^") isPinned = true;
          else isActive = true;
          raw = raw.slice(1);
        }
        if (!raw) throw new SyntaxError(`empty view at ${at}`);
        const key = unescapeKey(raw);
        stack.tabs.push(key);
        if (isPinned) pinned.push(key);
        if (isActive) stack.active = key;
        skip();
        if (text[at] === ",") {
          at++;
          continue;
        }
        expect(")");
        break;
      }
      if (!stack.active) stack.active = stack.tabs[0]!;
      return pinned.length ? { ...stack, pinned } : stack;
    }
    if (name !== "h" && name !== "v") throw new SyntaxError(`unknown node ${name}`);
    const children: LayoutNode[] = [];
    const ratios: number[] = [];
    for (;;) {
      skip();
      if (text[at] === ")") {
        at++;
        break;
      }
      const weight = Number(word());
      if (!Number.isFinite(weight) || weight < 0) throw new SyntaxError(`bad share at ${at}`);
      ratios.push(weight);
      children.push(node());
    }
    return { kind: "split", dir: name === "h" ? "row" : "column", children, ratios };
  };
  try {
    const tree = node();
    skip();
    return at === text.length ? normalize(tree) : null;
  } catch {
    return null;
  }
}

const MODES: readonly FrameMode[] = ["floating", "maximized", "fullscreen", "mosaic"];

/** Frames as `layout.ini` text, lowest first. */
export function formatLayoutIni(frames: readonly Frame[], keyOf?: (surface: SurfaceId) => string): string {
  const data: IniRecord = {};
  const sorted = [...frames].sort((a, b) => a.zIndex - b.zIndex);
  for (const [i, frame] of sorted.entries()) {
    const { x, y, width, height } = frame.rect;
    data[`frame ${i + 1}`] = {
      workspace: String(frame.workspace),
      mode: frame.mode,
      rect: [x, y, width, height].map(Math.round).join(","),
      tree: formatTree(frame.root, keyOf),
    };
  }
  return serializeIniText(data);
}

/** Frames read back, views named by key, ids `frame-N` and stacking order kept. Bad sections are skipped. */
export function parseLayoutIni(text: string): Frame[] {
  const frames: Frame[] = [];
  for (const [section, entries] of Object.entries(parseIniText(text))) {
    const match = /^frame (\d+)$/.exec(section);
    const root = entries.tree ? parseTree(entries.tree) : null;
    if (!match || !root) continue;
    const [x = 0, y = 0, width = 0, height = 0] = (entries.rect ?? "").split(",").map(Number);
    const rect: Rect = { x, y, width, height };
    if (Object.values(rect).some((n) => !Number.isFinite(n))) continue;
    const mode = MODES.includes(entries.mode as FrameMode) ? (entries.mode as FrameMode) : "floating";
    const workspace = Math.max(1, Math.floor(Number(entries.workspace)) || 1);
    frames.push({ id: `frame-${match[1]}`, workspace, mode, rect, zIndex: Number(match[1]), root });
  }
  return frames.sort((a, b) => a.zIndex - b.zIndex);
}
