import * as React from "react";
import type { AccentColorId } from "./catalog";

export interface FolderShadePair {
  back: string;
  front: string;
  emblem: string;
}

export const ACCENT_FOLDER_SHADES: Record<AccentColorId, FolderShadePair> = {
  blue: { back: "#4877b1", front: "#5294e2", emblem: "#1d344f" },
  teal: { back: "#16808c", front: "#1aa3b2", emblem: "#0c3d43" },
  green: { back: "#4d9143", front: "#63b357", emblem: "#22421d" },
  yellow: { back: "#b58b25", front: "#e0ae32", emblem: "#4d390b" },
  orange: { back: "#c4632b", front: "#f27c38", emblem: "#54270d" },
  red: { back: "#b83539", front: "#df4a4f", emblem: "#4e1315" },
  pink: { back: "#b8407a", front: "#e05598", emblem: "#4d1732" },
  purple: { back: "#7b4899", front: "#9b5ec0", emblem: "#331b42" },
  graphite: { back: "#4f5866", front: "#697587", emblem: "#21262e" },
};

export type FolderBadgeKind =
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos"
  | "desktop"
  | "public"
  | "templates"
  | "code";

export type FileBadgeKind =
  | "html"
  | "code"
  | "markdown"
  | "text"
  | "empty-text"
  | "image"
  | "audio"
  | "video"
  | "archive";

const PAPIRUS_FOLDER_BACK_PATH =
  "M 4,46.2 C 4,47.751 5.2488,49 6.8,49 H 57.2 C 58.751,49 60,47.751 60,46.2 V 15.8 C 60,14.249 58.751,13 57.2,13 H 32 C 27.8,13 26.4,7 22.2,7 H 6.8 C 5.2488,7 4,8.2488 4,9.8";

const PAPIRUS_FOLDER_HIGHLIGHT_PATH =
  "M 6.8008,7 C 5.2496,7 4,8.2496 4,9.8008 V 10.801 C 4,9.2496 5.2496,8 6.8008,8 H 22.199 C 26.399,8 27.8,14 32,14 H 57.199 C 58.75,14 60,15.25 60,16.801 V 15.801 C 60,14.25 58.75,13 57.199,13 H 32 C 27.8,13 26.399,7 22.199,7 Z";

const PAPIRUS_FILE_SHADOW_PATH =
  "M 12.75,5 C 11.2265,5 10,6.2488 10,7.8 v 50.4 c 0,1.55008 1.2265,2.8 2.75,2.8 h 38.5 C 52.7724,61 54,59.75008 54,58.2 V 23 L 40,19 36,5 Z";

const PAPIRUS_FILE_SHEET_PATH =
  "M 12.75,4 C 11.2265,4 10,5.2488 10,6.8 v 50.4 c 0,1.55008 1.2265,2.8 2.75,2.8 h 38.5 C 52.7724,60 54,58.75008 54,57.2 V 22 L 40,18 36,4 Z";

const PAPIRUS_FILE_FLAP_SHADOW_PATH =
  "M 54,23 36,5 V 20.1875 C 36,21.74675 37.2555,23 38.8125,23 Z";

const PAPIRUS_FILE_FLAP_PATH =
  "M 54,22 36,4 V 19.1875 C 36,20.74675 37.2555,22 38.8125,22 Z";

const PAPIRUS_FILE_HIGHLIGHT_PATH =
  "M 12.75 4 C 11.2265 4 10 5.2495812 10 6.8007812 L 10 7.8007812 C 10 6.2495813 11.2265 5 12.75 5 L 36 5 L 36 4 L 12.75 4 z";

export function getFolderShades(accentColor?: AccentColorId): FolderShadePair {
  if (accentColor && accentColor in ACCENT_FOLDER_SHADES) {
    return ACCENT_FOLDER_SHADES[accentColor];
  }
  return ACCENT_FOLDER_SHADES.blue;
}

export function inferFolderBadge(
  pathOrName?: string,
): FolderBadgeKind | undefined {
  if (!pathOrName) return undefined;
  const base =
    pathOrName.replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? "";
  if (base === "documents" || base === "docs") return "documents";
  if (base === "downloads" || base === "download") return "downloads";
  if (base === "music" || base === "audio") return "music";
  if (base === "pictures" || base === "photos" || base === "images") {
    return "pictures";
  }
  if (base === "videos" || base === "movies") return "videos";
  if (base === "desktop") return "desktop";
  if (base === "public" || base === "publicshare") return "public";
  if (base === "templates") return "templates";
  if (base === "projects" || base === "code" || base === "src") return "code";
  return undefined;
}

export function inferFileBadge(
  name?: string,
  iconCandidates?: readonly string[],
  isEmpty?: boolean,
): FileBadgeKind {
  if (
    isEmpty ||
    iconCandidates?.includes("application-x-zerosize") ||
    iconCandidates?.includes("text-x-generic-empty")
  ) {
    return "empty-text";
  }
  const ext = name?.split(".").pop()?.toLowerCase() ?? "";
  if (
    ext === "html" ||
    ext === "htm" ||
    iconCandidates?.includes("text-html")
  ) {
    return "html";
  }
  if (ext === "md" || ext === "markdown") return "markdown";
  if (
    /^(ts|tsx|js|jsx|json|py|rs|go|c|cpp|h|css|sh|toml|yaml|yml)$/.test(ext) ||
    iconCandidates?.includes("text-x-script")
  ) {
    return "code";
  }
  if (
    /^(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$/.test(ext) ||
    iconCandidates?.includes("image-x-generic")
  ) {
    return "image";
  }
  if (
    /^(mp3|wav|ogg|flac|m4a)$/.test(ext) ||
    iconCandidates?.includes("audio-x-generic")
  ) {
    return "audio";
  }
  if (
    /^(mp4|webm|mkv|mov)$/.test(ext) ||
    iconCandidates?.includes("video-x-generic")
  ) {
    return "video";
  }
  if (
    /^(zip|tar|gz|xz|zst|7z|deb|rpm|flatpakref)$/.test(ext) ||
    iconCandidates?.includes("package-x-generic")
  ) {
    return "archive";
  }
  return "text";
}

function renderFolderBadgeGlyph(badge?: FolderBadgeKind) {
  switch (badge) {
    case "documents":
      return (
        <path d="M 25.5 29 C 24.669 29 24 29.669 24 30.5 L 24 47.5 C 24 48.331 24.669 49 25.5 49 L 38.5 49 C 39.331 49 40 48.331 40 47.5 L 40 34 L 35 29 L 25.5 29 z" />
      );
    case "downloads":
      return (
        <path d="M 30,29 V 37 H 26 L 32,45 38,37 H 34 V 29 Z M 24,45 V 49 H 40 V 45 Z" />
      );
    case "music":
      return (
        <path d="M 29,40.54 C 28.4,40.18 27.7,40 27,40 24.8,40 23,41.8 23,44 23,46.2 24.8,48 27,48 29.2,48 31,46.2 31,44 V 34 H 39 V 40.54 C 38.4,40.18 37.7,40 37,40 34.8,40 33,41.8 33,44 33,46.2 34.8,48 37,48 39.2,48 41,46.2 41,44 V 30 H 29" />
      );
    case "pictures":
      return (
        <path d="M 23.4 31 C 22.625 31 22 31.625 22 32.4 L 22 45.6 C 22 46.375 22.625 47 23.4 47 L 40.6 47 C 41.375 47 42 46.375 42 45.6 L 42 32.4 C 42 31.625 41.375 31 40.6 31 L 23.4 31 z M 28 37 L 34 43 L 37 39 L 40 43 L 40 45 L 24 45 L 24 41 L 28 37 z" />
      );
    case "videos":
      return (
        <path d="M 22.5 31 C 21.669 31 21 31.669 21 32.5 L 21 45.5 C 21 46.331 21.669 47 22.5 47 L 37.5 47 C 38.331 47 39 46.331 39 45.5 L 39 39 L 39 32.5 C 39 31.669 38.331 31 37.5 31 L 22.5 31 z M 39 39 L 45 45 L 45 33 L 39 39 z" />
      );
    case "desktop":
      return (
        <path d="M 24 31 C 22.892 31 22 31.892 22 33 V 43 C 22 44.108 22.892 45 24 45 H 40 C 41.108 45 42 44.108 42 43 V 33 C 42 31.892 41.108 31 40 31 Z M 24 34 H 40 V 42 H 24 Z M 27 46 H 37 V 48 H 27 Z" />
      );
    case "public":
      return (
        <path d="M 26.82,34.602 C 26.751,34.617 26.682,34.642 26.617,34.672 25.972,34.975 25.805,35.919 26.246,36.793 26.601,37.496 27.232,37.932 27.805,37.918 28.235,40.255 29.952,42 31.992,42 H 32.008 C 34.048,42 35.765,40.255 36.195,37.918 36.767,37.931 37.399,37.496 37.754,36.793 38.195,35.919 38.028,34.975 37.383,34.672 37.318,34.642 37.249,34.617 37.18,34.602 37.097,32.046 34.812,30 32,30 29.188,30 26.903,32.046 26.82,34.602 Z M 35.137,42.433 C 34.889,42.777 34.562,43.087 34.121,43.32 L 34.117,43.324 C 33.494,43.753 32.773,44 32.008,44 H 31.992 C 30.826,44 29.774,43.419 29,42.496 25.737,42.978 22.251,43.676 22.031,44.472 22.027,44.483 22.034,44.497 22.031,44.507 22.021,44.548 22.02,44.584 22.016,44.625 22.014,44.643 22,44.656 22,44.675 V 44.691 47.464 C 22,47.761 22.223,48 22.5,48 H 41.5 C 41.777,48 42,47.761 42,47.464 V 44.691 44.656 C 41.997,44.591 41.971,44.536 41.953,44.472 41.723,43.644 38.341,42.917 35.137,42.433 Z" />
      );
    case "templates":
      return (
        <path d="M 25.5 29 C 24.669 29 24 29.669 24 30.5 L 24 42 L 25 42 L 25 41 L 26 41 L 26 31 L 34 31 L 34 35 L 38 35 L 38 47 L 38 48 L 39 48 L 39 47 L 40 47 L 40 34 L 35 29 L 25.5 29 z M 39 48 L 39 49 L 40 49 L 40 48 L 39 48 z M 38 48 L 37 48 L 37 49 L 38 49 L 38 48 z M 37 48 L 37 47 L 36 47 L 36 48 L 37 48 z M 36 48 L 35 48 L 35 49 L 36 49 L 36 48 z M 35 48 L 35 47 L 34 47 L 34 48 L 35 48 z M 34 48 L 33 48 L 33 49 L 34 49 L 34 48 z M 33 48 L 33 47 L 32 47 L 32 48 L 33 48 z M 32 48 L 31 48 L 31 49 L 32 49 L 32 48 z M 31 48 L 31 47 L 30 47 L 30 48 L 31 48 z M 30 48 L 29 48 L 29 49 L 30 49 L 30 48 z M 29 48 L 29 47 L 28 47 L 28 48 L 29 48 z M 28 48 L 27 48 L 27 49 L 28 49 L 28 48 z M 27 48 L 27 47 L 26 47 L 26 48 L 27 48 z M 26 48 L 25 48 L 25 49 L 26 49 L 26 48 z M 25 48 L 25 47 L 24 47 L 24 48 L 25 48 z M 25 47 L 26 47 L 26 46 L 25 46 L 25 47 z M 25 46 L 25 45 L 24 45 L 24 46 L 25 46 z M 25 45 L 26 45 L 26 44 L 25 44 L 25 45 z M 25 44 L 25 43 L 24 43 L 24 44 L 25 44 z M 25 43 L 26 43 L 26 42 L 25 42 L 25 43 z" />
      );
    case "code":
      return (
        <path d="M 33.176,28 28,47.225716 30.898,48 36.074,28.774283 Z M 37,28.09554 v 3.980892 l 5,4.976114 -5,4.976115 v 3.980892 l 10,-8.957007 z m -10,1.990446 -10,8.957006 10,8.957007 v -3.980891 l -5,-4.976115 5,-4.976114 z" />
      );
    default:
      return null;
  }
}

function renderFileBadgeGlyph(badge: FileBadgeKind, shades: FolderShadePair) {
  switch (badge) {
    case "html":
      return (
        <g fill={shades.front}>
          <circle cx="32" cy="40" r="11" fill={shades.front} opacity="0.22" />
          <path
            fill={shades.back}
            d="M 32,29 A 11,11 0 0 0 21,40 11,11 0 0 0 32,51 11,11 0 0 0 43,40 11,11 0 0 0 32,29 Z m 0,2 c 1.5,0 3,1.8 3.7,4.5 H 28.3 C 29,32.8 30.5,31 32,31 Z m -5.6,1.1 C 25.5,33.5 24.9,35.2 24.6,37 h -3 c 0.9,-2.2 2.6,-4 4.8,-4.9 z M 21.6,43 h 3 c 0.3,1.8 0.9,3.5 1.8,4.9 -2.2,-0.9 -3.9,-2.7 -4.8,-4.9 z m 6.7,0 h 7.4 c -0.7,2.7 -2.2,4.5 -3.7,4.5 -1.5,0 -3,-1.8 -3.7,-4.5 z m 0,-2 c 0.1,-1.5 0.4,-3 0.9,-4.5 h 5.6 c 0.5,1.5 0.8,3 0.9,4.5 z m 9.3,-8.9 C 39.8,33 41.5,34.8 42.4,37 h -3 c -0.3,-1.8 -0.9,-3.5 -1.8,-4.9 z M 37.6,47.9 C 38.5,46.5 39.1,44.8 39.4,43 h 3 c -0.9,2.2 -2.6,4 -4.8,4.9 z"
          />
        </g>
      );
    case "code":
      return (
        <path
          d="M 27,32 19,40 l 8,8 2,-2 -6,-6 6,-6 z m 10,0 -2,2 6,6 -6,6 2,2 8,-8 z"
          fill={shades.back}
        />
      );
    case "markdown":
      return (
        <g fill={shades.back}>
          <path d="m 22,46 h 3 v -5.7 l 2.5,2.85 2.5,-2.85 V 46 h 3 V 36 H 30 l -2.5,2.85 L 25,36 h -3 z" />
          <path d="m 37,36 v 6 h -2.5 l 3.5,4 h 1 l 3.5,-4 H 40 v -6 z" />
          <path d="M 19.04,32 C 17.94,32 17,32.95 17,34.08 v 13.84 C 17,49.05 17.94,50 19.04,50 H 44.96 C 46.06,50 47,49.05 47,47.92 V 34.08 C 47,32.95 46.06,32 44.96,32 Z M 20,35 H 44 V 47 H 20 Z" />
        </g>
      );
    case "image":
      return (
        <g fill={shades.back}>
          <circle cx="25" cy="34" r="2.2" />
          <path d="M 21.4,30 C 20.625,30 20,30.625 20,31.4 V 46.6 C 20,47.375 20.625,48 21.4,48 H 42.6 C 43.375,48 44,47.375 44,46.6 V 31.4 C 44,30.625 43.375,30 42.6,30 Z M 27,37 33,43 37,39 42,44 V 46 H 22 V 42 Z" />
        </g>
      );
    case "audio":
      return (
        <path
          d="m 26,29 v 14 c -0.3,0 -0.5,0 -1,0 -2.76,0 -5,2.24 -5,5 0,2.76 2.24,5 5,5 2.72,0 4.95,-2.18 5,-4.91 V 35 h 10 v 8 c -0.3,0 -0.5,0 -1,0 -2.76,0 -5,2.24 -5,5 0,2.76 2.24,5 5,5 2.66,0 4.86,-2.09 5,-4.75 V 29 Z"
          fill={shades.back}
        />
      );
    case "video":
      return (
        <path
          d="M 21.5,32 C 20.67,32 20,32.67 20,33.5 v 13 c 0,0.83 0.67,1.5 1.5,1.5 h 15 c 0.83,0 1.5,-0.67 1.5,-1.5 V 40 33.5 C 38,32.67 37.33,32 36.5,32 Z M 38,40 44,46 V 34 Z"
          fill={shades.back}
        />
      );
    case "archive":
      return (
        <path
          d="m 29,26 v 3 h 3 v -3 z m 3,3 v 3 h 3 v -3 z m -3,3 v 3 h 3 v -3 z m 3,3 v 3 h 3 v -3 z m -3,5 c -1.1,0 -2,0.9 -2,2 v 8 c 0,1.1 0.9,2 2,2 h 6 c 1.1,0 2,-0.9 2,-2 v -8 c 0,-1.1 -0.9,-2 -2,-2 z m 1,3 h 4 v 6 h -4 z"
          fill={shades.back}
        />
      );
    case "empty-text":
      return (
        <g>
          <rect
            x="19"
            y="29.5"
            width="2.6"
            height="9"
            rx="1.3"
            fill={shades.front}
          />
          <line
            x1="25"
            y1="34"
            x2="43"
            y2="34"
            stroke="#5a606d"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="3.2 4"
            opacity="0.38"
          />
          <line
            x1="20"
            y1="42"
            x2="39"
            y2="42"
            stroke="#5a606d"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="3.2 4"
            opacity="0.22"
          />
        </g>
      );
    case "text":
    default:
      return (
        <g>
          <rect
            x="20"
            y="30.5"
            width="24"
            height="3.2"
            rx="1.5"
            fill={shades.front}
          />
          <rect x="20" y="37" width="24" height="3" rx="1.4" fill="#222222" opacity="0.5" />
          <rect x="20" y="43" width="24" height="3" rx="1.4" fill="#222222" opacity="0.5" />
          <rect x="20" y="49" width="15" height="3" rx="1.4" fill="#222222" opacity="0.5" />
        </g>
      );
  }
}

export interface DynamicFolderIconProps {
  accentColor?: AccentColorId;
  opened?: boolean;
  badge?: FolderBadgeKind;
  pathOrName?: string;
  className?: string;
}

export const DynamicFolderIcon: React.FC<DynamicFolderIconProps> = ({
  accentColor,
  opened = false,
  badge,
  pathOrName,
  className,
}) => {
  const shades = getFolderShades(accentColor);
  const resolvedBadge = badge ?? inferFolderBadge(pathOrName);

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect opacity="0.2" width="56" height="36" x="4" y="22" rx="2.8" ry="2.8" />
      <path d={PAPIRUS_FOLDER_BACK_PATH} fill={shades.back} />
      <rect
        opacity="0.2"
        width="56"
        height={opened ? 30 : 36}
        x="4"
        y={opened ? 26 : 20}
        rx="2.8"
        ry="2.8"
      />
      <rect fill="#e4e4e4" width="48" height="22" x="8" y="16" rx="2.8" ry="2.8" />
      <rect
        fill={shades.front}
        width="56"
        height={opened ? 30 : 36}
        x="4"
        y={opened ? 27 : 21}
        rx="2.8"
        ry="2.8"
      />
      <path opacity="0.1" fill="#ffffff" d={PAPIRUS_FOLDER_HIGHLIGHT_PATH} />
      {resolvedBadge && (
        <g
          fill={shades.emblem}
          transform={opened ? "translate(0, 3)" : undefined}
        >
          {renderFolderBadgeGlyph(resolvedBadge)}
        </g>
      )}
    </svg>
  );
};

export interface DynamicFileIconProps {
  accentColor?: AccentColorId;
  badge?: FileBadgeKind;
  name?: string;
  iconCandidates?: readonly string[];
  isEmpty?: boolean;
  className?: string;
}

export const DynamicFileIcon: React.FC<DynamicFileIconProps> = ({
  accentColor,
  badge,
  name,
  iconCandidates,
  isEmpty,
  className,
}) => {
  const shades = getFolderShades(accentColor);
  const resolvedBadge = badge ?? inferFileBadge(name, iconCandidates, isEmpty);

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d={PAPIRUS_FILE_SHADOW_PATH} opacity="0.2" />
      <path d={PAPIRUS_FILE_SHEET_PATH} fill="#e4e4e4" />
      <path d={PAPIRUS_FILE_FLAP_SHADOW_PATH} opacity="0.2" />
      <path d={PAPIRUS_FILE_FLAP_PATH} fill="#fafafa" />
      <path d={PAPIRUS_FILE_HIGHLIGHT_PATH} opacity="0.2" fill="#ffffff" />
      {renderFileBadgeGlyph(resolvedBadge, shades)}
    </svg>
  );
};

function toSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getAccentFolderIconUrl(
  accentColor?: AccentColorId,
  options?: { opened?: boolean; badge?: FolderBadgeKind },
): string {
  const shades = getFolderShades(accentColor);
  const opened = Boolean(options?.opened);
  const frontY = opened ? 27 : 21;
  const frontH = opened ? 30 : 36;
  const frontShadowY = opened ? 26 : 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect opacity="0.2" width="56" height="36" x="4" y="22" rx="2.8" ry="2.8"/><path d="${PAPIRUS_FOLDER_BACK_PATH}" fill="${shades.back}"/><rect opacity="0.2" width="56" height="${frontH}" x="4" y="${frontShadowY}" rx="2.8" ry="2.8"/><rect fill="#e4e4e4" width="48" height="22" x="8" y="16" rx="2.8" ry="2.8"/><rect fill="${shades.front}" width="56" height="${frontH}" x="4" y="${frontY}" rx="2.8" ry="2.8"/><path opacity="0.1" fill="#ffffff" d="${PAPIRUS_FOLDER_HIGHLIGHT_PATH}"/></svg>`;
  return toSvgDataUrl(svg);
}

export function getAccentHtmlIconUrl(accentColor?: AccentColorId): string {
  const shades = getFolderShades(accentColor);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${PAPIRUS_FILE_SHADOW_PATH}" opacity="0.2"/><path d="${PAPIRUS_FILE_SHEET_PATH}" fill="#e4e4e4"/><path d="${PAPIRUS_FILE_FLAP_SHADOW_PATH}" opacity="0.2"/><path d="${PAPIRUS_FILE_FLAP_PATH}" fill="#fafafa"/><path d="${PAPIRUS_FILE_HIGHLIGHT_PATH}" opacity="0.2" fill="#ffffff"/><circle cx="32" cy="40" r="11" fill="${shades.front}" opacity="0.22"/><path fill="${shades.back}" d="M 32,29 A 11,11 0 0 0 21,40 11,11 0 0 0 32,51 11,11 0 0 0 43,40 11,11 0 0 0 32,29 Z m 0,2 c 1.5,0 3,1.8 3.7,4.5 H 28.3 C 29,32.8 30.5,31 32,31 Z m -5.6,1.1 C 25.5,33.5 24.9,35.2 24.6,37 h -3 c 0.9,-2.2 2.6,-4 4.8,-4.9 z M 21.6,43 h 3 c 0.3,1.8 0.9,3.5 1.8,4.9 -2.2,-0.9 -3.9,-2.7 -4.8,-4.9 z m 6.7,0 h 7.4 c -0.7,2.7 -2.2,4.5 -3.7,4.5 -1.5,0 -3,-1.8 -3.7,-4.5 z m 0,-2 c 0.1,-1.5 0.4,-3 0.9,-4.5 h 5.6 c 0.5,1.5 0.8,3 0.9,4.5 z m 9.3,-8.9 C 39.8,33 41.5,34.8 42.4,37 h -3 c -0.3,-1.8 -0.9,-3.5 -1.8,-4.9 z M 37.6,47.9 C 38.5,46.5 39.1,44.8 39.4,43 h 3 c -0.9,2.2 -2.6,4 -4.8,4.9 z"/></svg>`;
  return toSvgDataUrl(svg);
}

// --- Open Folder Path Registry (tracks folders currently open in FilesApp) ---
const openFolderCounts = new Map<string, number>();
const openFolderListeners = new Set<() => void>();

function notifyOpenFolders() {
  for (const fn of openFolderListeners) {
    fn();
  }
}

export function registerOpenFolderPath(path: string): () => void {
  const norm = path.replace(/\/+$/, "") || "/";
  openFolderCounts.set(norm, (openFolderCounts.get(norm) ?? 0) + 1);
  notifyOpenFolders();
  return () => {
    const cur = openFolderCounts.get(norm) ?? 0;
    if (cur <= 1) {
      openFolderCounts.delete(norm);
    } else {
      openFolderCounts.set(norm, cur - 1);
    }
    notifyOpenFolders();
  };
}

export function useOpenFolderPaths(): ReadonlySet<string> {
  const [paths, setPaths] = React.useState<ReadonlySet<string>>(
    () => new Set(openFolderCounts.keys()),
  );
  React.useEffect(() => {
    const sync = () => setPaths(new Set(openFolderCounts.keys()));
    openFolderListeners.add(sync);
    return () => {
      openFolderListeners.delete(sync);
    };
  }, []);
  return paths;
}

