#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_FILES_DIR = path.join(ROOT, "data", "files");
const ICONS_PAPIRUS_DIR = path.join(DATA_FILES_DIR, "usr", "share", "icons", "Papirus");
const ICONS_PILOTI_DIR = path.join(DATA_FILES_DIR, "usr", "share", "icons", "Piloti");

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
  // 1. Papirus Folder:
  //    Frame 0  = closed (`folder.svg`)
  //    Frame 24 = opened (`folder-open.svg` + lifted inner paper) -> reversible on hover / mouseout / drag-over / opened
  //    Frame 24..44 = drop-accept bounce settling cleanly back to frame 24
  "places/folder": {
    ...lottieDoc("papirus-folder", [
      layer(1, "FrontFlap", [
        morphRectGroup("FrontShadow", {
          sizes: kFrames([[0, [56, 36]], [24, [56, 30]], [34, [56, 27]], [44, [56, 30]]]),
          positions: kFrames([[0, [32, 38]], [24, [32, 41]], [34, [32, 42.5]], [44, [32, 41]]]),
          r: 2.8,
          fill: "#000000",
          opacity: 20,
        }),
        morphRectGroup("FrontBody", {
          sizes: kFrames([[0, [56, 36]], [24, [56, 30]], [34, [56, 27]], [44, [56, 30]]]),
          positions: kFrames([[0, [32, 39]], [24, [32, 42]], [34, [32, 43.5]], [44, [32, 42]]]),
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
          p: kFrames([[0, [32, 27]], [24, [32, 21]], [34, [32, 17]], [44, [32, 21]]]),
          a: kStatic([32, 27]),
          r: kFrames([[0, [0]], [24, [-2]], [34, [2.5]], [44, [-2]]]),
        }
      ),
      layer(3, "BackTab", [
        rectGroup("OuterShadow", { x: 4, y: 22, w: 56, h: 36, r: 2.8, fill: "#000000", opacity: 20 }),
        pathGroup("BackBody", { d: PAPIRUS_FOLDER_BACK_D, fill: "#4877b1" }),
        pathGroup("TopHighlight", { d: PAPIRUS_FOLDER_HIGHLIGHT_D, fill: "#ffffff", opacity: 10 }),
      ]),
    ]),
    op: 44,
  },

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
};

// Keep animated/ directory cleanly synced to the generated set only (remove old redrawn app animations)
const animatedDir = path.join(ICONS_PILOTI_DIR, "animated");
if (fs.existsSync(animatedDir)) {
  fs.rmSync(animatedDir, { recursive: true, force: true });
}
for (const [rel, doc] of Object.entries(ICONS)) {
  const outPath = path.join(animatedDir, `${rel}.json`);
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
      } else if (!exts || exts.some((ext) => ent.name.endsWith(ext))) {
        const rel = path.relative(dir, full).split(path.sep).join("/");
        out[`${prefix}/${rel}`] = fs.readFileSync(full, "utf8");
      }
    }
  };
  walk(dir);
  return out;
}

function collectHomeTree(homeDir) {
  const dirs = [];
  const files = {};
  const walk = (cur, vfsPath) => {
    dirs.push(vfsPath);
    for (const ent of fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(cur, ent.name);
      const childVfs = `${vfsPath}/${ent.name}`;
      if (ent.isDirectory()) {
        walk(full, childVfs);
      } else {
        files[childVfs] = fs.readFileSync(full, "utf8");
      }
    }
  };
  if (fs.existsSync(homeDir)) {
    walk(homeDir, "/home/user");
  }
  return { dirs, files };
}

function collectStaticDirIndex(filesRoot) {
  const index = {};
  const walk = (cur, vfsPath) => {
    const list = [];
    for (const ent of fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ent.name === ".DS_Store") continue;
      if (vfsPath === "/" && ent.name === "home") continue;
      if (vfsPath === "/home" && ent.name === "user") continue;
      const full = path.join(cur, ent.name);
      const childVfs = vfsPath === "/" ? `/${ent.name}` : `${vfsPath}/${ent.name}`;
      if (ent.isDirectory()) {
        list.push({ name: ent.name, fileType: 1 });
        walk(full, childVfs);
      } else {
        list.push({ name: ent.name, fileType: 0 });
      }
    }
    index[vfsPath] = list;
  };
  if (fs.existsSync(filesRoot)) {
    walk(filesRoot, "/");
  }
  return index;
}

const papirusEntries = collectFiles(ICONS_PAPIRUS_DIR, "/usr/share/icons/Papirus", [".svg", ".theme"]);
const papirusTs = `// Auto-generated from data/files/usr/share/icons/Papirus.\nexport const PAPIRUS_VIRTUAL_ICONS: Record<string, string> = ${JSON.stringify(
  papirusEntries,
  null,
  2
)};\n`;
fs.writeFileSync(path.join(ROOT, "src", "lib", "papirus-virtual-icons.ts"), papirusTs, "utf8");

const pilotiEntries = collectFiles(ICONS_PILOTI_DIR, "/usr/share/icons/Piloti", [".json", ".svg", ".theme"]);
const pilotiTs = `// Auto-generated from data/files/usr/share/icons/Piloti.\nexport const PILOTI_VIRTUAL_ICONS: Record<string, string> = ${JSON.stringify(
  pilotiEntries,
  null,
  2
)};\n`;
fs.writeFileSync(path.join(ROOT, "src", "lib", "piloti-virtual-icons.ts"), pilotiTs, "utf8");

const homeTree = collectHomeTree(path.join(DATA_FILES_DIR, "home", "user"));
const staticDirIndex = collectStaticDirIndex(DATA_FILES_DIR);
const defaultTreeTs = `// Auto-generated from data/files/.\nexport const DEFAULT_HOME_DIRS: readonly string[] = ${JSON.stringify(
  homeTree.dirs,
  null,
  2
)};\n\nexport const DEFAULT_HOME_FILES: Record<string, string> = ${JSON.stringify(
  homeTree.files,
  null,
  2
)};\n\nexport const DEFAULT_STATIC_DIR_INDEX: Record<string, readonly { name: string; fileType: 0 | 1 }[]> = ${JSON.stringify(
  staticDirIndex,
  null,
  2
)};\n`;
fs.writeFileSync(path.join(ROOT, "src", "lib", "default-vfs-tree.ts"), defaultTreeTs, "utf8");

console.log(
  `Generated ${Object.keys(ICONS).length} animated icons, ${Object.keys(pilotiEntries).length} Piloti entries, ${Object.keys(papirusEntries).length} Papirus entries, ${Object.keys(homeTree.files).length} home starter files, ${Object.keys(staticDirIndex).length} static dirs.`
);

