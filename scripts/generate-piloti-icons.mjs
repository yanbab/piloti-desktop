#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ICONS_PAPIRUS_DIR = path.join(ROOT, "icons", "Papirus");
const ICONS_PILOTI_DIR = path.join(ROOT, "icons", "Piloti");

function hexRgb(hex) {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [
    Number((((n >> 16) & 255) / 255).toFixed(4)),
    Number((((n >> 8) & 255) / 255).toFixed(4)),
    Number(((n & 255) / 255).toFixed(4)),
    1,
  ];
}

const EASE = {
  i: { x: [0.35, 0.35], y: [1, 1] },
  o: { x: [0.35, 0.35], y: [0, 0] },
};

const EASE1 = {
  i: { x: [0.35], y: [1] },
  o: { x: [0.35], y: [0] },
};

function kStatic(v) {
  return { a: 0, k: v };
}

function kFrames(frames) {
  return {
    a: 1,
    k: frames.map(([t, s], idx) =>
      idx === frames.length - 1
        ? { t, s }
        : { t, s, ...(Array.isArray(s) && s.length === 1 ? EASE1 : EASE) }
    ),
  };
}

function kShapeFrames(frames) {
  return {
    a: 1,
    k: frames.map(([t, s], idx) =>
      idx === frames.length - 1
        ? { t, s: [s] }
        : { t, s: [s], i: { x: [0.35], y: [1] }, o: { x: [0.35], y: [0] } }
    ),
  };
}

/**
 * Parses an SVG path containing M/m, L/l, H/h, V/v, C/c, Z/z commands
 * into a Lottie `{ c, v, i, o }` path object (exact Papirus coordinates).
 */
function svgPathToLottieShape(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  let idx = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let closed = false;

  const verts = [];
  const inPts = [];
  const outPts = [];

  const isCmd = (t) => /^[a-zA-Z]$/.test(t);
  const nextNum = () => Number(tokens[idx++]);

  const pushVertex = (x, y) => {
    verts.push([Number(x.toFixed(3)), Number(y.toFixed(3))]);
    inPts.push([0, 0]);
    outPts.push([0, 0]);
  };

  while (idx < tokens.length) {
    if (isCmd(tokens[idx])) {
      cmd = tokens[idx++];
      if (cmd === "Z" || cmd === "z") {
        closed = true;
        cx = sx;
        cy = sy;
        continue;
      }
    }
    switch (cmd) {
      case "M":
      case "m": {
        const rel = cmd === "m";
        const x = (rel ? cx : 0) + nextNum();
        const y = (rel ? cy : 0) + nextNum();
        cx = x;
        cy = y;
        sx = x;
        sy = y;
        pushVertex(x, y);
        cmd = rel ? "l" : "L";
        break;
      }
      case "L":
      case "l": {
        const rel = cmd === "l";
        const x = (rel ? cx : 0) + nextNum();
        const y = (rel ? cy : 0) + nextNum();
        cx = x;
        cy = y;
        pushVertex(x, y);
        break;
      }
      case "H":
      case "h": {
        const rel = cmd === "h";
        cx = (rel ? cx : 0) + nextNum();
        pushVertex(cx, cy);
        break;
      }
      case "V":
      case "v": {
        const rel = cmd === "v";
        cy = (rel ? cy : 0) + nextNum();
        pushVertex(cx, cy);
        break;
      }
      case "C":
      case "c": {
        const rel = cmd === "c";
        const bx = rel ? cx : 0;
        const by = rel ? cy : 0;
        const x1 = bx + nextNum();
        const y1 = by + nextNum();
        const x2 = bx + nextNum();
        const y2 = by + nextNum();
        const x = bx + nextNum();
        const y = by + nextNum();
        if (verts.length === 0) {
          pushVertex(cx, cy);
        }
        const prevIdx = verts.length - 1;
        outPts[prevIdx] = [
          Number((x1 - cx).toFixed(3)),
          Number((y1 - cy).toFixed(3)),
        ];
        verts.push([Number(x.toFixed(3)), Number(y.toFixed(3))]);
        inPts.push([
          Number((x2 - x).toFixed(3)),
          Number((y2 - y).toFixed(3)),
        ]);
        outPts.push([0, 0]);
        cx = x;
        cy = y;
        break;
      }
      default:
        idx++;
        break;
    }
  }

  // Merge closing duplicate vertex if last equals first
  if (
    closed &&
    verts.length > 1 &&
    Math.hypot(
      verts[verts.length - 1][0] - verts[0][0],
      verts[verts.length - 1][1] - verts[0][1]
    ) < 0.01
  ) {
    const lastIn = inPts.pop();
    verts.pop();
    outPts.pop();
    if (lastIn && (lastIn[0] !== 0 || lastIn[1] !== 0)) {
      inPts[0] = lastIn;
    }
  }

  return { c: closed, v: verts, i: inPts, o: outPts };
}

function shapeTr({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return {
    ty: "tr",
    p: p.a !== undefined ? p : kStatic(p),
    a: kStatic(a),
    s: s.a !== undefined ? s : kStatic(s),
    r: r.a !== undefined ? r : kStatic(r),
    o: o.a !== undefined ? o : kStatic(o),
  };
}

function rectGroup(nm, { x, y, w, h, r = 0, fill, opacity = 100, tr }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    ty: "gr",
    nm,
    it: [
      {
        ty: "rc",
        d: 1,
        s: kStatic([w, h]),
        p: kStatic([0, 0]),
        r: kStatic(r),
        nm: "Rect",
      },
      {
        ty: "fl",
        c: kStatic(hexRgb(fill)),
        o: opacity.a !== undefined ? opacity : kStatic(opacity),
        r: 1,
        nm: "Fill",
      },
      tr ?? shapeTr({ p: [cx, cy] }),
    ],
  };
}

function morphRectGroup(nm, { sizes, positions, r = 0, fill, opacity = 100 }) {
  return {
    ty: "gr",
    nm,
    it: [
      {
        ty: "rc",
        d: 1,
        s: sizes,
        p: kStatic([0, 0]),
        r: kStatic(r),
        nm: "Rect",
      },
      {
        ty: "fl",
        c: kStatic(hexRgb(fill)),
        o: opacity.a !== undefined ? opacity : kStatic(opacity),
        r: 1,
        nm: "Fill",
      },
      shapeTr({ p: positions }),
    ],
  };
}

function circleGroup(nm, { cx, cy, r, fill, stroke, strokeWidth = 4, opacity = 100, tr }) {
  const items = [
    {
      ty: "el",
      d: 1,
      s: kStatic([r * 2, r * 2]),
      p: kStatic([0, 0]),
      nm: "Ellipse",
    },
  ];
  if (fill) {
    items.push({
      ty: "fl",
      c: kStatic(hexRgb(fill)),
      o: opacity.a !== undefined ? opacity : kStatic(opacity),
      r: 1,
      nm: "Fill",
    });
  }
  if (stroke) {
    items.push({
      ty: "st",
      c: kStatic(hexRgb(stroke)),
      o: opacity.a !== undefined ? opacity : kStatic(opacity),
      w: kStatic(strokeWidth),
      lc: 2,
      lj: 2,
      nm: "Stroke",
    });
  }
  items.push(tr ?? shapeTr({ p: [cx, cy] }));
  return { ty: "gr", nm, it: items };
}

function pathGroup(nm, { d, shape, fill, stroke, strokeWidth = 3, lineCap = 2, opacity = 100, tr }) {
  const ks = shape ? (shape.a !== undefined ? shape : kStatic(shape)) : kStatic(svgPathToLottieShape(d));
  const items = [{ ty: "sh", d: 1, ks, nm: "Path" }];
  if (fill) {
    items.push({
      ty: "fl",
      c: kStatic(hexRgb(fill)),
      o: opacity.a !== undefined ? opacity : kStatic(opacity),
      r: 1,
      nm: "Fill",
    });
  }
  if (stroke) {
    items.push({
      ty: "st",
      c: kStatic(hexRgb(stroke)),
      o: opacity.a !== undefined ? opacity : kStatic(opacity),
      w: kStatic(strokeWidth),
      lc: lineCap,
      lj: 2,
      nm: "Stroke",
    });
  }
  items.push(tr ?? shapeTr());
  return { ty: "gr", nm, it: items };
}

function layer(ind, nm, shapes, ks = {}, op = 48) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: ks.o ?? kStatic(100),
      r: ks.r ?? kStatic(0),
      p: ks.p ?? kStatic([32, 32]),
      a: ks.a ?? kStatic([32, 32]),
      s: ks.s ?? kStatic([100, 100]),
    },
    ao: 0,
    shapes,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  };
}

function lottieDoc(nm, layers, op = 48) {
  return {
    v: "5.12.2",
    fr: 60,
    ip: 0,
    op,
    w: 64,
    h: 64,
    nm,
    ddd: 0,
    assets: [],
    layers,
  };
}

// Exact Papirus 64x64 folder geometry
const PAPIRUS_FOLDER_BACK_D =
  "M 4,46.2 C 4,47.751 5.2488,49 6.8,49 H 57.2 C 58.751,49 60,47.751 60,46.2 V 15.8 C 60,14.249 58.751,13 57.2,13 H 32 C 27.8,13 26.4,7 22.2,7 H 6.8 C 5.2488,7 4,8.2488 4,9.8 Z";
const PAPIRUS_FOLDER_HIGHLIGHT_D =
  "M 6.8008,7 C 5.2496,7 4,8.2496 4,9.8008 V 10.801 C 4,9.2496 5.2496,8 6.8008,8 H 22.199 C 26.399,8 27.8,14 32,14 H 57.199 C 58.75,14 60,15.25 60,16.801 V 15.801 C 60,14.25 58.75,13 57.199,13 H 32 C 27.8,13 26.399,7 22.199,7 Z";

const PAPIRUS_FILE_SHADOW_D =
  "M 12.75,5 C 11.2265,5 10,6.2488 10,7.8 v 50.4 c 0,1.55008 1.2265,2.8 2.75,2.8 h 38.5 C 52.7724,61 54,59.75008 54,58.2 V 23 L 40,19 36,5 Z";
const PAPIRUS_FILE_SHEET_D =
  "M 12.75,4 C 11.2265,4 10,5.2488 10,6.8 v 50.4 c 0,1.55008 1.2265,2.8 2.75,2.8 h 38.5 C 52.7724,60 54,58.75008 54,57.2 V 22 L 40,18 36,4 Z";
const PAPIRUS_FILE_FLAP_SHADOW_D =
  "M 54,23 36,5 V 20.1875 C 36,21.74675 37.2555,23 38.8125,23 Z";
const PAPIRUS_FILE_FLAP_D =
  "M 54,22 36,4 V 19.1875 C 36,20.74675 37.2555,22 38.8125,22 Z";
const PAPIRUS_FILE_HIGHLIGHT_D =
  "M 12.75 4 C 11.2265 4 10 5.2495812 10 6.8007812 L 10 7.8007812 C 10 6.2495813 11.2265 5 12.75 5 L 36 5 L 36 4 L 12.75 4 z";

const ICONS = {
  // 1. Papirus Folder: closed folder.svg -> opens cleanly into folder-open.svg + rising inner sheet!
  "places/folder": lottieDoc("papirus-folder", [
    layer(1, "FrontFlap", [
      morphRectGroup("FrontShadow", {
        sizes: kFrames([[0, [56, 36]], [18, [56, 30]], [28, [56, 30]], [48, [56, 36]]]),
        positions: kFrames([[0, [32, 38]], [18, [32, 41]], [28, [32, 41]], [48, [32, 38]]]),
        r: 2.8,
        fill: "#000000",
        opacity: 20,
      }),
      morphRectGroup("FrontBody", {
        sizes: kFrames([[0, [56, 36]], [18, [56, 30]], [28, [56, 30]], [48, [56, 36]]]),
        positions: kFrames([[0, [32, 39]], [18, [32, 42]], [28, [32, 42]], [48, [32, 39]]]),
        r: 2.8,
        fill: "#5294e2",
      }),
    ]),
    layer(
      2,
      "InnerPaper",
      [
        rectGroup("Sheet", {
          x: 8,
          y: 16,
          w: 48,
          h: 22,
          r: 2.8,
          fill: "#e4e4e4",
        }),
        rectGroup("AccentLine", {
          x: 13,
          y: 19.5,
          w: 20,
          h: 2.5,
          r: 1.25,
          fill: "#5294e2",
          opacity: 55,
        }),
      ],
      {
        p: kFrames([[0, [32, 27]], [18, [32, 21]], [28, [32, 21]], [48, [32, 27]]]),
        a: kStatic([32, 27]),
        r: kFrames([[0, [0]], [18, [-2]], [28, [-2]], [48, [0]]]),
      }
    ),
    layer(3, "BackTab", [
      rectGroup("OuterShadow", { x: 4, y: 22, w: 56, h: 36, r: 2.8, fill: "#000000", opacity: 20 }),
      pathGroup("BackBody", { d: PAPIRUS_FOLDER_BACK_D, fill: "#4877b1" }),
      pathGroup("TopHighlight", { d: PAPIRUS_FOLDER_HIGHLIGHT_D, fill: "#ffffff", opacity: 10 }),
    ]),
  ]),

  // 2. Papirus Folder Open: starts open (exact folder-open.svg silhouette), paper pops softly on hover
  "places/folder-open": lottieDoc("papirus-folder-open", [
    layer(1, "FrontFlapOpen", [
      rectGroup("FrontShadow", { x: 4, y: 26, w: 56, h: 30, r: 2.8, fill: "#000000", opacity: 20 }),
      rectGroup("FrontBody", { x: 4, y: 27, w: 56, h: 30, r: 2.8, fill: "#5294e2" }),
    ]),
    layer(
      2,
      "InnerPaper",
      [
        rectGroup("Sheet", { x: 8, y: 16, w: 48, h: 22, r: 2.8, fill: "#e4e4e4" }),
        rectGroup("AccentLine", { x: 13, y: 19.5, w: 20, h: 2.5, r: 1.25, fill: "#5294e2", opacity: 55 }),
      ],
      {
        p: kFrames([[0, [32, 24]], [16, [32, 19]], [48, [32, 24]]]),
        a: kStatic([32, 27]),
        r: kFrames([[0, [0]], [16, [2]], [48, [0]]]),
      }
    ),
    layer(3, "BackTab", [
      rectGroup("OuterShadow", { x: 4, y: 22, w: 56, h: 36, r: 2.8, fill: "#000000", opacity: 20 }),
      pathGroup("BackBody", { d: PAPIRUS_FOLDER_BACK_D, fill: "#4877b1" }),
      pathGroup("TopHighlight", { d: PAPIRUS_FOLDER_HIGHLIGHT_D, fill: "#ffffff", opacity: 10 }),
    ]),
  ]),

  // 3. Papirus User Trash (Empty)
  "places/user-trash": lottieDoc("papirus-user-trash", [
    layer(
      1,
      "Lid",
      [
        rectGroup("Handle", { x: 24, y: 2, w: 18, h: 6, r: 1, fill: "#9f9f9f" }),
        rectGroup("LidShadow", { x: 6, y: 5, w: 54, h: 12, r: 3, fill: "#000000", opacity: 20 }),
        rectGroup("LidBar", { x: 6, y: 4, w: 54, h: 12, r: 3, fill: "#9f9f9f" }),
        rectGroup("LidHighlight", { x: 7, y: 4, w: 52, h: 1.2, r: 0.6, fill: "#ffffff", opacity: 20 }),
      ],
      {
        p: kFrames([[0, [33, 10]], [16, [33, 5]], [48, [33, 10]]]),
        a: kStatic([33, 10]),
        r: kFrames([[0, [0]], [16, [-10]], [48, [0]]]),
      }
    ),
    layer(2, "Bin", [
      rectGroup("BinShadow", { x: 10, y: 9, w: 46, h: 52, r: 3, fill: "#000000", opacity: 20 }),
      rectGroup("BinBody", { x: 10, y: 8, w: 46, h: 52, r: 3, fill: "#8e8e8e" }),
      pathGroup("Rib1", { d: "M 21,25 V 49", stroke: "#000000", strokeWidth: 6, opacity: 30 }),
      pathGroup("Rib2", { d: "M 33,25 V 49", stroke: "#000000", strokeWidth: 6, opacity: 30 }),
      pathGroup("Rib3", { d: "M 45,25 V 49", stroke: "#000000", strokeWidth: 6, opacity: 30 }),
    ]),
  ]),

  // 4. Papirus User Trash Full
  "status/user-trash-full": lottieDoc("papirus-user-trash-full", [
    layer(
      1,
      "Lid",
      [
        rectGroup("Handle", { x: 24, y: 2, w: 18, h: 6, r: 1, fill: "#9f9f9f" }),
        rectGroup("LidShadow", { x: 6, y: 5, w: 54, h: 12, r: 3, fill: "#000000", opacity: 20 }),
        rectGroup("LidBar", { x: 6, y: 4, w: 54, h: 12, r: 3, fill: "#9f9f9f" }),
        rectGroup("LidHighlight", { x: 7, y: 4, w: 52, h: 1.2, r: 0.6, fill: "#ffffff", opacity: 20 }),
      ],
      {
        p: kFrames([[0, [33, 10]], [16, [33, 5]], [48, [33, 10]]]),
        a: kStatic([33, 10]),
        r: kFrames([[0, [0]], [16, [-12]], [48, [0]]]),
      }
    ),
    layer(
      2,
      "PaperPeek",
      [
        circleGroup("Scrap1", { cx: 26, cy: 14, r: 6, fill: "#e4e4e4" }),
        circleGroup("Scrap2", { cx: 38, cy: 15, r: 5.5, fill: "#fafafa" }),
      ],
      {
        p: kFrames([[0, [32, 18]], [18, [32, 11]], [48, [32, 18]]]),
        a: kStatic([32, 18]),
      }
    ),
    layer(3, "BinFull", [
      pathGroup("BinShadow", {
        d: "M 13,9 H 53 C 56,9 60,27 60,35 60,43 57,61 53,61 H 13 C 9,61 6,43 6,35 6,27 10,9 13,9 Z",
        fill: "#000000",
        opacity: 20,
      }),
      pathGroup("BinBody", {
        d: "M 13,8 H 53 C 56,8 60,26 60,34 60,42 57,60 53,60 H 13 C 9,60 6,42 6,34 6,26 10,8 13,8 Z",
        fill: "#8e8e8e",
      }),
      pathGroup("Rib1", {
        d: "M 21,25 C 21,25 19,31.5 19,37.5 19,43.5 21,49 21,49",
        stroke: "#000000",
        strokeWidth: 6,
        opacity: 30,
      }),
      pathGroup("Rib2", { d: "M 33,25 V 49", stroke: "#000000", strokeWidth: 6, opacity: 30 }),
      pathGroup("Rib3", {
        d: "M 45,25 C 45,25 47,31.5 47,37.5 47,43.5 45,49 45,49",
        stroke: "#000000",
        strokeWidth: 6,
        opacity: 30,
      }),
    ]),
  ]),

  // 5. Papirus Text Document (Non-Empty) — typing lines sweep
  "mimetypes/text-x-generic": lottieDoc("papirus-text-x-generic", [
    layer(1, "Lines", [
      rectGroup("HeadingBar", {
        x: 20,
        y: 30.5,
        w: 24,
        h: 3.2,
        r: 1.5,
        fill: "#5294e2",
        tr: shapeTr({
          p: [20, 32.1],
          a: [-12, 0],
          s: kFrames([[0, [100, 100]], [6, [30, 100]], [20, [100, 100]], [48, [100, 100]]]),
        }),
      }),
      rectGroup("Line2", {
        x: 20,
        y: 37,
        w: 24,
        h: 3,
        r: 1.4,
        fill: "#000000",
        opacity: 50,
        tr: shapeTr({
          p: [20, 38.5],
          a: [-12, 0],
          s: kFrames([[0, [100, 100]], [10, [40, 100]], [26, [100, 100]], [48, [100, 100]]]),
        }),
      }),
      rectGroup("Line3", {
        x: 20,
        y: 43,
        w: 24,
        h: 3,
        r: 1.4,
        fill: "#000000",
        opacity: 50,
        tr: shapeTr({
          p: [20, 44.5],
          a: [-12, 0],
          s: kFrames([[0, [100, 100]], [14, [45, 100]], [32, [100, 100]], [48, [100, 100]]]),
        }),
      }),
      rectGroup("Line4", {
        x: 20,
        y: 49,
        w: 15,
        h: 3,
        r: 1.4,
        fill: "#000000",
        opacity: 50,
        tr: shapeTr({
          p: [20, 50.5],
          a: [-7.5, 0],
          s: kFrames([[0, [100, 100]], [18, [35, 100]], [38, [100, 100]], [48, [100, 100]]]),
        }),
      }),
    ]),
    layer(2, "Page", [
      pathGroup("Shadow", { d: PAPIRUS_FILE_SHADOW_D, fill: "#000000", opacity: 20 }),
      pathGroup("Sheet", { d: PAPIRUS_FILE_SHEET_D, fill: "#e4e4e4" }),
      pathGroup("FlapShadow", { d: PAPIRUS_FILE_FLAP_SHADOW_D, fill: "#000000", opacity: 20 }),
      pathGroup("Flap", { d: PAPIRUS_FILE_FLAP_D, fill: "#fafafa" }),
      pathGroup("TopHighlight", { d: PAPIRUS_FILE_HIGHLIGHT_D, fill: "#ffffff", opacity: 20 }),
    ]),
  ]),

  // 6. Papirus Empty Text Document (`application-x-zerosize`) — blank sheet + pulsing cursor caret & faint guide dots
  "mimetypes/application-x-zerosize": lottieDoc("papirus-text-empty", [
    layer(
      1,
      "Caret",
      [
        rectGroup("CursorBeam", {
          x: 19,
          y: 29,
          w: 2.5,
          h: 9,
          r: 1.25,
          fill: "#5294e2",
        }),
      ],
      {
        p: kStatic([20.25, 33.5]),
        a: kStatic([20.25, 33.5]),
        o: kFrames([[0, [100]], [12, [20]], [24, [100]], [36, [20]], [48, [100]]]),
      }
    ),
    layer(2, "EmptyGuides", [
      rectGroup("Dot1", { x: 25, y: 32.5, w: 4, h: 2, r: 1, fill: "#7a828f", opacity: 35 }),
      rectGroup("Dot2", { x: 32, y: 32.5, w: 4, h: 2, r: 1, fill: "#7a828f", opacity: 30 }),
      rectGroup("Dot3", { x: 39, y: 32.5, w: 4, h: 2, r: 1, fill: "#7a828f", opacity: 25 }),
    ]),
    layer(3, "Page", [
      pathGroup("Shadow", { d: PAPIRUS_FILE_SHADOW_D, fill: "#000000", opacity: 20 }),
      pathGroup("Sheet", { d: PAPIRUS_FILE_SHEET_D, fill: "#e4e4e4" }),
      pathGroup("FlapShadow", { d: PAPIRUS_FILE_FLAP_SHADOW_D, fill: "#000000", opacity: 20 }),
      pathGroup("Flap", { d: PAPIRUS_FILE_FLAP_D, fill: "#fafafa" }),
      pathGroup("TopHighlight", { d: PAPIRUS_FILE_HIGHLIGHT_D, fill: "#ffffff", opacity: 20 }),
    ]),
  ]),

  // 7. Papirus Loupe (`org.gnome.Loupe` / Image Viewer) — magnifying glass pans smoothly across sunset hills
  "apps/org.gnome.Loupe": lottieDoc("papirus-loupe", [
    layer(
      1,
      "Magnifier",
      [
        circleGroup("GlassTint", { cx: 30, cy: 32, r: 15, fill: "#ffffff", opacity: 18 }),
        circleGroup("RingShadow", { cx: 30, cy: 33, r: 16, stroke: "#000000", strokeWidth: 4, opacity: 12 }),
        circleGroup("Ring", { cx: 30, cy: 32, r: 16, stroke: "#4f4f4f", strokeWidth: 4 }),
        pathGroup("InnerConnector", { d: "M 13,49 L 19,43", stroke: "#6e6e6e", strokeWidth: 3 }),
        pathGroup("HandleShadow", { d: "M 3,60 L 12,51", stroke: "#000000", strokeWidth: 6, opacity: 10 }),
        pathGroup("Handle", { d: "M 3,59 L 12,50", stroke: "#8e8e8e", strokeWidth: 6 }),
      ],
      {
        p: kFrames([[0, [30, 32]], [16, [34, 29]], [32, [27, 33]], [48, [30, 32]]]),
        a: kStatic([30, 32]),
        s: kFrames([[0, [100, 100]], [16, [105, 105]], [32, [103, 103]], [48, [100, 100]]]),
      }
    ),
    layer(2, "PhotoCard", [
      rectGroup("CardShadow", { x: 4, y: 5, w: 56, h: 56, r: 2, fill: "#000000", opacity: 20 }),
      rectGroup("CardFrame", { x: 4, y: 4, w: 56, h: 56, r: 2, fill: "#e4e4e4" }),
      // Sunset sky gradient simulated cleanly in Papirus colors
      rectGroup("SkyTop", { x: 8, y: 8, w: 48, h: 12, r: 0, fill: "#1c71d8" }),
      rectGroup("SkyMid", { x: 8, y: 19, w: 48, h: 12, r: 0, fill: "#aa63cd" }),
      rectGroup("SkyLow", { x: 8, y: 30, w: 48, h: 12, r: 0, fill: "#ffa348" }),
      circleGroup("Sun", { cx: 49, cy: 15, r: 5, fill: "#ffffff", opacity: 55 }),
      pathGroup("HillLeft", {
        d: "M 16,38 L 20,30 C 20,30 22,26 25,26 C 28,26 30,30 30,30 L 38,42 L 12,42 Z",
        fill: "#ffffff",
        opacity: 48,
      }),
      pathGroup("HillRight", {
        d: "M 30,42 L 36,34 C 36,34 38,30 41,30 C 44,30 46,34 46,34 L 50,42 Z",
        fill: "#ffffff",
        opacity: 38,
      }),
      rectGroup("MatteEdge", { x: 8, y: 42, w: 48, h: 1, r: 0, fill: "#000000", opacity: 10 }),
      rectGroup("CardHighlight", { x: 5, y: 4, w: 54, h: 1, r: 0, fill: "#ffffff", opacity: 20 }),
    ]),
  ]),

  // 8. Papirus File Manager (`system-file-manager`)
  "apps/system-file-manager": lottieDoc("papirus-system-file-manager", [
    layer(1, "DrawerFront", [
      rectGroup("DrawerShadow", { x: 4, y: 22, w: 56, h: 39, r: 2.8, fill: "#000000", opacity: 20 }),
      rectGroup("Drawer", { x: 4, y: 21, w: 56, h: 39, r: 2.8, fill: "#8e8e8e" }),
      rectGroup("HandleShadow", { x: 22, y: 38, w: 20, h: 5, r: 1.4, fill: "#000000", opacity: 20 }),
      rectGroup("Handle", { x: 22, y: 37, w: 20, h: 5, r: 1.4, fill: "#ececec" }),
    ]),
    layer(
      2,
      "YellowFolderTab",
      [rectGroup("Tab3", { x: 7, y: 15, w: 50, h: 34, r: 2.1, fill: "#ffcd54" })],
      { p: kFrames([[0, [32, 32]], [16, [32, 29]], [48, [32, 32]]]) }
    ),
    layer(
      3,
      "GreenFolderTab",
      [rectGroup("Tab2", { x: 10, y: 9, w: 44, h: 34, r: 2.1, fill: "#89e058" })],
      { p: kFrames([[0, [32, 32]], [16, [32, 26]], [48, [32, 32]]]) }
    ),
    layer(
      4,
      "BlueFolderTab",
      [rectGroup("Tab1", { x: 13, y: 3, w: 38, h: 34, r: 2.1, fill: "#5294e2" })],
      { p: kFrames([[0, [32, 32]], [16, [32, 24]], [48, [32, 32]]]) }
    ),
  ]),

  // 9. Papirus Utilities Terminal
  "apps/utilities-terminal": lottieDoc("papirus-utilities-terminal", [
    layer(
      1,
      "CursorBar",
      [rectGroup("Bar", { x: 26, y: 29, w: 17, h: 6, r: 1.5, fill: "#ffffff" })],
      {
        p: kStatic([34.5, 32]),
        a: kStatic([34.5, 32]),
        o: kFrames([[0, [100]], [12, [15]], [24, [100]], [36, [15]], [48, [100]]]),
      }
    ),
    layer(
      2,
      "Chevron",
      [
        pathGroup("PromptArrow", {
          d: "M 13,18 L 22,25.5 L 13,33",
          stroke: "#62c9ea",
          strokeWidth: 5.2,
          lineCap: 2,
        }),
      ],
      {
        p: kFrames([[0, [18, 25.5]], [16, [21, 25.5]], [48, [18, 25.5]]]),
        a: kStatic([18, 25.5]),
      }
    ),
    layer(3, "TerminalBody", [
      rectGroup("Shadow", { x: 4, y: 8, w: 56, h: 50, r: 4.2, fill: "#000000", opacity: 20 }),
      rectGroup("Box", { x: 4, y: 7, w: 56, h: 50, r: 4.2, fill: "#4f4f4f" }),
      rectGroup("TopHighlight", { x: 5, y: 7, w: 54, h: 1, r: 0.5, fill: "#ffffff", opacity: 12 }),
    ]),
  ]),

  // 10. Papirus Accessories Text Editor
  "apps/accessories-text-editor": lottieDoc("papirus-accessories-text-editor", [
    layer(
      1,
      "PencilBadge",
      [
        circleGroup("BadgeShadow", { cx: 48, cy: 47, r: 16, fill: "#000000", opacity: 20 }),
        circleGroup("RedCircle", { cx: 48, cy: 46, r: 16, fill: "#f34235" }),
        pathGroup("Pencil", {
          d: "M 40,50.436 V 54 H 43.5638 L 52.5646,44.9992 L 49.0008,41.4354 Z M 55.7172,41.8578 C 56.09416,41.48086 56.09416,40.8869 55.7172,40.50994 L 53.4898,38.28254 C 53.11284,37.90558 52.51888,37.90558 52.14194,38.28254 L 50.27994,40.15654 L 53.84394,43.72054 Z",
          fill: "#ffffff",
          tr: shapeTr({
            p: [48, 46],
            a: [48, 46],
            r: kFrames([[0, [0]], [14, [-10]], [28, [8]], [48, [0]]]),
          }),
        }),
      ],
      {
        p: kStatic([48, 46]),
        a: kStatic([48, 46]),
      }
    ),
    layer(2, "Pad", [
      rectGroup("PadShadow", { x: 10, y: 6, w: 44, h: 55, r: 3, fill: "#000000", opacity: 20 }),
      rectGroup("PadBody", { x: 10, y: 4, w: 44, h: 56, r: 3, fill: "#e4e4e4" }),
      rectGroup("Line1", { x: 15, y: 9, w: 34, h: 4, r: 1, fill: "#000000", opacity: 20 }),
      rectGroup("Line2", { x: 15, y: 18, w: 34, h: 4, r: 1, fill: "#000000", opacity: 20 }),
      rectGroup("Line3", { x: 15, y: 27, w: 20, h: 4, r: 1, fill: "#000000", opacity: 20 }),
    ]),
  ]),

  // 11. Papirus Calculator
  "apps/accessories-calculator": lottieDoc("papirus-accessories-calculator", [
    layer(
      1,
      "EqualsBadge",
      [
        circleGroup("BadgeShadow", { cx: 46, cy: 47, r: 16, fill: "#000000", opacity: 20 }),
        circleGroup("GreenBadge", { cx: 46, cy: 46, r: 16, fill: "#07ce8e" }),
        rectGroup("Eq1", { x: 40, y: 42, w: 12, h: 2, r: 0.5, fill: "#ffffff" }),
        rectGroup("Eq2", { x: 40, y: 48, w: 12, h: 2, r: 0.5, fill: "#ffffff" }),
      ],
      {
        p: kStatic([46, 46]),
        a: kStatic([46, 46]),
        s: kFrames([[0, [100, 100]], [16, [114, 114]], [32, [100, 100]], [48, [100, 100]]]),
      }
    ),
    layer(2, "Quads", [
      rectGroup("CalcShadow", { x: 4, y: 4, w: 56, h: 56, r: 3, fill: "#000000", opacity: 20 }),
      rectGroup("TL", { x: 4, y: 3, w: 28, h: 28, r: 3, fill: "#a6a6a6" }),
      rectGroup("TR", { x: 32, y: 3, w: 28, h: 28, r: 3, fill: "#595959" }),
      rectGroup("BL", { x: 4, y: 31, w: 28, h: 28, r: 3, fill: "#8c8c8c" }),
      rectGroup("BR", { x: 32, y: 31, w: 28, h: 28, r: 3, fill: "#666666" }),
      // Plus, Minus, Multiply crisp white symbols
      rectGroup("PlusV", { x: 18, y: 12, w: 2, h: 14, r: 0, fill: "#ffffff" }),
      rectGroup("PlusH", { x: 12, y: 18, w: 14, h: 2, r: 0, fill: "#ffffff" }),
      rectGroup("Minus", { x: 40, y: 18, w: 12, h: 2, r: 0, fill: "#ffffff" }),
      rectGroup("Mul1", {
        x: 17,
        y: 38,
        w: 2.2,
        h: 16,
        r: 0,
        fill: "#ffffff",
        tr: shapeTr({ p: [18, 46], r: 45 }),
      }),
      rectGroup("Mul2", {
        x: 17,
        y: 38,
        w: 2.2,
        h: 16,
        r: 0,
        fill: "#ffffff",
        tr: shapeTr({ p: [18, 46], r: -45 }),
      }),
    ]),
  ]),

  // 12. Papirus Settings (`preferences-system`)
  "apps/preferences-system": lottieDoc("papirus-preferences-system", [
    layer(1, "WrenchFront", [
      rectGroup("HandleShadow", { x: 25, y: 38.6, w: 14, h: 22.4, r: 5.6, fill: "#000000", opacity: 20 }),
      rectGroup("Handle", { x: 25, y: 37.6, w: 14, h: 22.4, r: 5.6, fill: "#e4e4e4" }),
      rectGroup("Slot", { x: 29, y: 40.2, w: 6, h: 16.8, r: 2.8, fill: "#000000", opacity: 40 }),
      pathGroup("WrenchJaw", {
        d: "M 38,19.367 V 29 L 32,33 L 26,29 V 19.38 C 21.136,21.69 18.007,26.589 18,32 C 18,39.732 24.268,46 32,46 C 39.732,46 46,39.732 46,32 C 45.997,26.585 42.869,21.678 38,19.367 Z",
        fill: "#ffffff",
      }),
    ]),
    layer(
      2,
      "TealGear",
      [
        rectGroup("Tooth1", {
          x: 26.4,
          y: 4,
          w: 11.2,
          h: 56,
          r: 4.5,
          fill: "#008374",
          tr: shapeTr({ p: [32, 32], r: 0 }),
        }),
        rectGroup("Tooth2", {
          x: 26.4,
          y: 4,
          w: 11.2,
          h: 56,
          r: 4.5,
          fill: "#008374",
          tr: shapeTr({ p: [32, 32], r: 60 }),
        }),
        rectGroup("Tooth3", {
          x: 26.4,
          y: 4,
          w: 11.2,
          h: 56,
          r: 4.5,
          fill: "#008374",
          tr: shapeTr({ p: [32, 32], r: 120 }),
        }),
        circleGroup("GearBody", { cx: 32, cy: 32, r: 21, fill: "#008374" }),
      ],
      {
        p: kStatic([32, 32]),
        a: kStatic([32, 32]),
        r: kFrames([[0, [0]], [24, [60]], [48, [120]]]),
      }
    ),
  ]),

  // 13. Papirus Preferences Desktop (`preferences-desktop`)
  "apps/preferences-desktop": lottieDoc("papirus-preferences-desktop", [
    layer(1, "Sliders", [
      // Tracks
      rectGroup("Track1", { x: 15, y: 15, w: 6, h: 34, r: 3, fill: "#3584e4" }),
      rectGroup("Track2", { x: 29, y: 15, w: 6, h: 34, r: 3, fill: "#3584e4" }),
      rectGroup("Track3", { x: 43, y: 15, w: 6, h: 34, r: 3, fill: "#3584e4" }),
      // Sliding Knobs
      circleGroup("Knob1", {
        cx: 18,
        cy: 21,
        r: 6,
        fill: "#ffffff",
        tr: shapeTr({ p: kFrames([[0, [18, 21]], [20, [18, 39]], [48, [18, 21]]]) }),
      }),
      circleGroup("Knob2", {
        cx: 32,
        cy: 37,
        r: 6,
        fill: "#ffffff",
        tr: shapeTr({ p: kFrames([[0, [32, 37]], [20, [32, 22]], [48, [32, 37]]]) }),
      }),
      circleGroup("Knob3", {
        cx: 46,
        cy: 32,
        r: 6,
        fill: "#ffffff",
        tr: shapeTr({ p: kFrames([[0, [46, 32]], [20, [46, 40]], [48, [46, 32]]]) }),
      }),
    ]),
    layer(2, "Card", [
      rectGroup("Shadow", { x: 4, y: 5, w: 56, h: 56, r: 16.8, fill: "#000000", opacity: 20 }),
      rectGroup("Squircle", { x: 4, y: 4, w: 56, h: 56, r: 16.8, fill: "#e4e4e4" }),
    ]),
  ]),

  // 14. Papirus Internet Web Browser (`internet-web-browser`)
  "apps/internet-web-browser": lottieDoc("papirus-internet-web-browser", [
    layer(
      1,
      "RingOrbit",
      [
        pathGroup("Swoosh", {
          d: "M 42.47,20 C 38.43,20 33.51,21.05 28.61,22.93 C 23.70,24.82 19.34,27.35 16.32,30.08 C 11.42,34.50 11.72,37.93 12.34,39.58 C 12.96,41.23 14.97,44 21.53,44 C 22.48,44 23.48,43.94 24.51,43.83 C 22.13,42.32 20.24,40.12 19.12,37.50 C 18.87,37.37 18.72,37.23 18.68,37.14 C 18.56,36.83 18.99,35.54 21.02,33.71 C 23.28,31.68 26.76,29.65 30.57,28.19 C 34.39,26.72 38.32,25.88 41.34,25.88 C 44.04,25.88 45.20,26.56 45.32,26.86 C 45.36,26.96 45.33,27.16 45.23,27.43 C 45.73,28.86 46,30.40 46,32 C 46,33.27 45.83,34.50 45.51,35.67 C 46.29,35.10 47.02,34.52 47.68,33.92 C 52.58,29.50 52.28,26.07 51.66,24.42 C 51.05,22.77 49.04,20 42.47,20 Z",
          fill: "#3ea0f4",
        }),
      ],
      {
        p: kStatic([32, 32]),
        a: kStatic([32, 32]),
        r: kFrames([[0, [0]], [24, [-12]], [48, [0]]]),
      }
    ),
    layer(2, "Globe", [
      circleGroup("GlobeShadow", { cx: 32, cy: 33, r: 28, fill: "#000000", opacity: 20 }),
      circleGroup("BlueOrb", { cx: 32, cy: 32, r: 28, fill: "#4354cb" }),
      circleGroup("WhiteCore", { cx: 32, cy: 32, r: 14, fill: "#ffffff" }),
    ]),
  ]),

  // 15. Papirus App Store (`system-software-install`)
  "apps/system-software-install": lottieDoc("papirus-system-software-install", [
    layer(
      1,
      "GreenArrow",
      [
        rectGroup("Shaft", { x: 41, y: 35, w: 5, h: 14, r: 2.5, fill: "#4caf50" }),
        pathGroup("Head", {
          d: "M 36.21,43 L 43.5,51.67 L 50.79,43 Z",
          fill: "#4caf50",
        }),
      ],
      {
        p: kFrames([[0, [43.5, 43]], [16, [43.5, 47]], [32, [43.5, 42]], [48, [43.5, 43]]]),
        a: kStatic([43.5, 43]),
      }
    ),
    layer(2, "Tiles", [
      rectGroup("Shadow", { x: 4, y: 5, w: 56, h: 56, r: 4.2, fill: "#000000", opacity: 20 }),
      rectGroup("Card", { x: 4, y: 4, w: 56, h: 56, r: 4.2, fill: "#e4e4e4" }),
      rectGroup("BlueTile", { x: 12, y: 12, w: 17, h: 17, r: 2.83, fill: "#03a9f4" }),
      rectGroup("OrangeTile", { x: 35, y: 12, w: 17, h: 17, r: 2.83, fill: "#ff9107" }),
      rectGroup("RedTile", { x: 12, y: 35, w: 17, h: 17, r: 2.83, fill: "#f44336" }),
    ]),
  ]),

  // 16. Papirus DevTools (`applications-development`)
  "apps/applications-development": lottieDoc("papirus-applications-development", [
    layer(
      1,
      "Hammer",
      [
        pathGroup("Handle", {
          d: "M 27.13,24.35 L 45.22,45.22",
          stroke: "#ffffff",
          strokeWidth: 5.5,
          opacity: 55,
        }),
        pathGroup("HammerHead", {
          d: "M 22.3,30.09 C 21.83,29.78 21.99,28.86 22.86,28.05 C 24.1,26.77 25.42,26.72 26.04,27.39 L 27.12,28.56 L 31.07,24.65 L 30.12,23.48 C 28.94,22.3 30.18,21.12 30.18,21.12 C 33.52,17.86 37.97,17.39 37.97,17.39 L 38.03,16.74 C 28.6,14.35 25.28,18.42 24,19.7 C 22.81,20.87 21.58,22.09 21.27,22.39 C 20.6,23.06 21.27,24.94 20.29,26.01 C 19.83,26.47 19.21,26.67 18.74,26.67 Z",
          fill: "#ffffff",
        }),
      ],
      {
        p: kStatic([32, 32]),
        a: kStatic([32, 32]),
        r: kFrames([[0, [0]], [14, [-16]], [26, [8]], [48, [0]]]),
      }
    ),
    layer(2, "Badge", [
      circleGroup("Shadow", { cx: 32, cy: 33, r: 28, fill: "#000000", opacity: 20 }),
      circleGroup("BrownBadge", { cx: 32, cy: 32, r: 28, fill: "#795548" }),
    ]),
  ]),
};

// Also keep multimedia-photo-viewer in animated/apps synced with Loupe so legacy lookups match too
ICONS["apps/multimedia-photo-viewer"] = ICONS["apps/org.gnome.Loupe"];

for (const [rel, doc] of Object.entries(ICONS)) {
  const outPath = path.join(ICONS_PILOTI_DIR, "animated", `${rel}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(doc), "utf8");
}

function collectFiles(dir, prefix, exts) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  const walk = (cur) => {
    for (const ent of fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (exts.some((ext) => ent.name.endsWith(ext))) {
        const rel = path.relative(dir, full).split(path.sep).join("/");
        out[`${prefix}/${rel}`] = fs.readFileSync(full, "utf8");
      }
    }
  };
  walk(dir);
  return out;
}

const papirusEntries = collectFiles(ICONS_PAPIRUS_DIR, "/usr/share/icons/Papirus", [".svg", ".theme"]);
const papirusTs = `// Auto-generated from icons/Papirus mini-theme.\nexport const PAPIRUS_VIRTUAL_ICONS: Record<string, string> = ${JSON.stringify(
  papirusEntries,
  null,
  2
)};\n`;
fs.writeFileSync(path.join(ROOT, "src", "lib", "papirus-virtual-icons.ts"), papirusTs, "utf8");

const pilotiEntries = collectFiles(ICONS_PILOTI_DIR, "/usr/share/icons/Piloti", [".json", ".svg", ".theme"]);
const pilotiTs = `// Auto-generated from icons/Piloti animated Papirus-derived theme.\nexport const PILOTI_VIRTUAL_ICONS: Record<string, string> = ${JSON.stringify(
  pilotiEntries,
  null,
  2
)};\n`;
fs.writeFileSync(path.join(ROOT, "src", "lib", "piloti-virtual-icons.ts"), pilotiTs, "utf8");

console.log(
  `Generated ${Object.keys(ICONS).length} animated icons, ${Object.keys(pilotiEntries).length} Piloti virtual entries, ${Object.keys(papirusEntries).length} Papirus virtual entries.`
);

