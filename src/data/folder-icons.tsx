import * as React from "react";
import type { AccentColorId } from "./catalog";

export interface FolderShadePair {
  back: string;
  front: string;
}

export const ACCENT_FOLDER_SHADES: Record<AccentColorId, FolderShadePair> = {
  blue: { back: "#438de6", front: "#a4caee" },
  teal: { back: "#129eb0", front: "#9edae6" },
  green: { back: "#3d9e4f", front: "#8ee697" },
  yellow: { back: "#cb931a", front: "#f3d796" },
  orange: { back: "#f17738", front: "#ffc994" },
  red: { back: "#e84053", front: "#f2a1a5" },
  pink: { back: "#e64392", front: "#eea4c8" },
  purple: { back: "#954ab5", front: "#d099d6" },
  graphite: { back: "#637692", front: "#b1cae1" },
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
  | "image"
  | "audio"
  | "video"
  | "archive";

const FOLDER_BACK_PATH =
  "M22 12C16.45 12 12 16.46 12 22v86c0 5.54 4.45 10 10 10h84c5.53 0 10-4.46 10-10V36c0-6.63-5.36-12-12-12H58c-2.45 0-4.7-1.39-5.8-3.58l-1.5-2.99C49.04 14.08 45.68 12 42 12Z";

const FOLDER_FRONT_CLOSED_PATH =
  "M66 32c-2.75 0-5.23 1.1-7.03 2.89C56.68 37.14 53.57 40 50.32 40H22c-5.55 0-10 4.46-10 10v58c0 5.54 4.45 10 10 10h84c5.53 0 10-4.46 10-10V42c0-5.54-4.47-10-10-10Z";

const FOLDER_FRONT_OPENED_PATH =
  "M66 50c-2.75 0-5.23 1.1-7.03 2.89C56.68 55.14 53.57 58 50.32 58H15c-5.55 0-9.6 4.46-8.8 9.95l6 40.05c.8 5.49 4.45 10 10 10h83.6c5.53 0 9.2-4.51 10-10l6.8-48.05C123.4 54.46 119.33 50 113.8 50Z";

const FILE_SHEET_PATH =
  "M28 8h50l30 30v74c0 4.43-3.57 8-8 8H28c-4.43 0-8-3.57-8-8V16c0-4.43 3.57-8 8-8Z";

const FILE_CORNER_PATH = "M78 8v22c0 4.43 3.57 8 8 8h22Z";

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
): FileBadgeKind {
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
        <path d="M58 60c-3.289 0-6 2.711-6 6v20c0 3.289 2.711 6 6 6h12c3.289 0 6-2.711 6-6V69c0-.531-.211-1.039-.586-1.414l-7-7C68.039 60.211 67.531 60 67 60zm0 4h8v3q0 3 3 3h3v16c0 1.141-.859 2-2 2H58c-1.141 0-2-.859-2-2V66c0-1.141.859-2 2-2z" />
      );
    case "downloads":
      return (
        <path d="M64 60c-1.102 0-2 .898-2 2v17.172l-4.586-4.586C57.039 74.211 56.531 74 56 74s-1.039.211-1.414.586c-.781.781-.781 2.047 0 2.828l8 8c.781.781 2.047.781 2.828 0l8-8c.781-.781.781-2.047 0-2.828s-2.047-.781-2.828 0L66 79.172V62c0-1.102-.898-2-2-2M52 88v4h24v-4z" />
      );
    case "music":
      return (
        <path d="M66 64c-3.289 0-6 2.711-6 6v8.68C59.086 78.25 58.07 78 57 78c-3.844 0-7 3.156-7 7s3.156 7 7 7c3.828 0 6.984-3.141 7-6.969V70c0-1.125.875-2 2-2h8c1.125 0 2 .875 2 2v8.68C75.086 78.25 74.07 78 73 78c-3.844 0-7 3.156-7 7s3.156 7 7 7 7-3.156 7-7V70c0-3.289-2.711-6-6-6zm-9 18c1.68 0 3 1.32 3 3v.031C59.984 86.695 58.672 88 57 88c-1.68 0-3-1.32-3-3s1.32-3 3-3m16 0c1.68 0 3 1.32 3 3s-1.32 3-3 3-3-1.32-3-3 1.32-3 3-3z" />
      );
    case "pictures":
      return (
        <>
          <path d="M60 72c-1.102 0-2 .898-2 2s.898 2 2 2 2-.898 2-2-.898-2-2-2m7 6-4 4-3-2-4 4v1c0 1 1 1 1 1h14s.945-.07 1-1v-2z" />
          <path d="M56 64c-3.289 0-6 2.711-6 6v16c0 3.289 2.711 6 6 6h16c3.289 0 6-2.711 6-6V70c0-3.289-2.711-6-6-6zm0 4h16c1.141 0 2 .859 2 2v16c0 1.141-.859 2-2 2H56c-1.141 0-2-.859-2-2V70c0-1.141.859-2 2-2z" />
        </>
      );
    case "videos":
      return (
        <>
          <path d="M49.09 71.961H48v16.062h1.035L59.238 80z" />
          <path d="M62 68c-3.289 0-6 2.711-6 6v12c0 3.289 2.711 6 6 6h12c3.289 0 6-2.711 6-6V74c0-3.289-2.711-6-6-6zm0 4h12c1.141 0 2 .859 2 2v12c0 1.141-.859 2-2 2H62c-1.141 0-2-.859-2-2V74c0-1.141.859-2 2-2z" />
        </>
      );
    case "desktop":
      return (
        <>
          <path d="M50 70v2h16v-2z" />
          <path d="M54 64c-3.289 0-6 2.711-6 6v16c0 3.289 2.711 6 6 6h20c3.289 0 6-2.711 6-6V74c0-3.289-2.711-6-6-6h-7.172l-3.414-3.414C63.039 64.211 62.531 64 62 64zm0 4h7.172l3.414 3.414C64.961 71.789 65.469 72 66 72h8c1.125 0 2 .875 2 2v12c0 1.133-.875 2-2 2H54c-1.125 0-2-.867-2-2V70c0-1.125.875-2 2-2z" />
        </>
      );
    case "public":
      return (
        <path d="M74 60c-3.312 0-6 2.68-6 6 0 .242.023.492.055.734l-9.891 4.946C57.047 70.602 55.555 70 54 70c-3.312 0-6 2.68-6 6 0 3.312 2.688 6 6 6 1.547-.008 3.039-.617 4.148-1.688l9.906 4.946c-.031.242-.054.492-.054.742 0 3.312 2.688 6 6 6s6-2.688 6-6c0-3.32-2.688-6-6-6-1.547 0-3.039.609-4.148 1.688l-9.906-4.954c.031-.242.054-.492.054-.742 0-.25-.016-.5-.047-.742l9.891-4.945C70.961 71.383 72.453 71.992 74 72c3.312 0 6-2.688 6-6 0-3.32-2.688-6-6-6z" />
      );
    case "templates":
      return (
        <path d="M58 60c-3.289 0-6 2.711-6 6v16h4V66c0-1.141.859-2 2-2h8v3q0 3 3 3h3v16h4V69c0-.531-.211-1.039-.586-1.414l-7-7C68.039 60.211 67.531 60 67 60zm-6 26v4h24v-4z" />
      );
    case "code":
      return (
        <path d="M56 66 46 76l10 10 2.83-2.83L51.66 76l7.17-7.17zm16 0-2.83 2.83L76.34 76l-7.17 7.17L72 86l10-10z" />
      );
    default:
      return null;
  }
}

function renderFileBadgeGlyph(badge: FileBadgeKind, shades: FolderShadePair) {
  switch (badge) {
    case "html":
      return (
        <g>
          <circle cx="64" cy="73" r="24" fill={shades.front} />
          <path
            d="M64 49c-13.25 0-24 10.75-24 24s10.75 24 24 24 24-10.75 24-24-10.75-24-24-24zm0 4c3.5 0 6.8 3.9 8.4 10H55.6c1.6-6.1 4.9-10 8.4-10zm-12.6 2.3c-1.8 2.9-3.1 6.6-3.7 10.7h-6.8c2-5 5.8-8.9 10.5-10.7zM40.9 77h6.8c.6 4.1 1.9 7.8 3.7 10.7-4.7-1.8-8.5-5.7-10.5-10.7zm14.7 0h16.8c-1.6 6.1-4.9 10-8.4 10s-6.8-3.9-8.4-10zm0-6c.3-3.5 1-6.9 2-10h12.8c1 3.1 1.7 6.5 2 10H55.6zm21-15.7c4.7 1.8 8.5 5.7 10.5 10.7h-6.8c-.6-4.1-1.9-7.8-3.7-10.7zM76.6 87.7c1.8-2.9 3.1-6.6 3.7-10.7h6.8c-2 5-5.8 8.9-10.5 10.7z"
            fill={shades.back}
          />
        </g>
      );
    case "code":
      return (
        <path
          d="M54 60 40 74l14 14 3.5-3.5L47 74l10.5-10.5zm20 0-3.5 3.5L81 74 70.5 84.5 74 88l14-14z"
          fill={shades.back}
        />
      );
    case "markdown":
      return (
        <path
          d="M40 58c-2.2 0-4 1.8-4 4v24c0 2.2 1.8 4 4 4h48c2.2 0 4-1.8 4-4V62c0-2.2-1.8-4-4-4zm2 6h6l6 8 6-8h6v20h-6V72l-6 8-6-8v12h-6zm32 0h6v10h5l-8 10-8-10h5z"
          fill={shades.back}
        />
      );
    case "image":
      return (
        <g fill={shades.back}>
          <circle cx="54" cy="64" r="4" />
          <path d="M44 52c-3.3 0-6 2.7-6 6v30c0 3.3 2.7 6 6 6h40c3.3 0 6-2.7 6-6V58c0-3.3-2.7-6-6-6zm0 4h40c1.1 0 2 .9 2 2v20l-10-10-12 12-8-6-14 12V58c0-1.1.9-2 2-2z" />
        </g>
      );
    case "audio":
      return (
        <path
          d="M66 52c-3.3 0-6 2.7-6 6v14.7c-1-.4-2-.7-3-.7-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8V60h12v12.7c-1-.4-2-.7-3-.7-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8V58c0-3.3-2.7-6-6-6z"
          fill={shades.back}
        />
      );
    case "video":
      return (
        <path
          d="M44 56c-3.3 0-6 2.7-6 6v24c0 3.3 2.7 6 6 6h28c3.3 0 6-2.7 6-6v-6l12 8V60l-12 8v-6c0-3.3-2.7-6-6-6z"
          fill={shades.back}
        />
      );
    case "archive":
      return (
        <path
          d="M58 48v6h6v-6zm6 6v6h6v-6zm-6 6v6h6v-6zm6 6v6h6v-6zm-6 8c-2.2 0-4 1.8-4 4v14c0 2.2 1.8 4 4 4h12c2.2 0 4-1.8 4-4V78c0-2.2-1.8-4-4-4zm2 6h8v10h-8z"
          fill={shades.back}
        />
      );
    case "text":
    default:
      return (
        <g fill="#9a9996">
          <rect x="40" y="54" width="48" height="4" rx="2" />
          <rect x="40" y="66" width="48" height="4" rx="2" />
          <rect x="40" y="78" width="48" height="4" rx="2" />
          <rect x="40" y="90" width="30" height="4" rx="2" />
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
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d={FOLDER_BACK_PATH} fill={shades.back} />
      <path
        d={opened ? FOLDER_FRONT_OPENED_PATH : FOLDER_FRONT_CLOSED_PATH}
        fill={shades.front}
        className="transition-[d] duration-150"
      />
      {resolvedBadge && (
        <g
          fill={shades.back}
          transform={opened ? "translate(0, 10)" : undefined}
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
  className?: string;
}

export const DynamicFileIcon: React.FC<DynamicFileIconProps> = ({
  accentColor,
  badge,
  name,
  iconCandidates,
  className,
}) => {
  const shades = getFolderShades(accentColor);
  const resolvedBadge = badge ?? inferFileBadge(name, iconCandidates);

  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d={FILE_SHEET_PATH} fill="#f6f5f4" />
      <path d={FILE_CORNER_PATH} fill="#deddda" />
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
  const frontPath = options?.opened
    ? FOLDER_FRONT_OPENED_PATH
    : FOLDER_FRONT_CLOSED_PATH;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="${FOLDER_BACK_PATH}" fill="${shades.back}"/><path d="${frontPath}" fill="${shades.front}"/></svg>`;
  return toSvgDataUrl(svg);
}

export function getAccentHtmlIconUrl(accentColor?: AccentColorId): string {
  const shades = getFolderShades(accentColor);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="${FILE_SHEET_PATH}" fill="#f6f5f4"/><path d="${FILE_CORNER_PATH}" fill="#deddda"/><circle cx="64" cy="73" r="24" fill="${shades.front}"/><circle cx="64" cy="73" r="12" fill="${shades.back}"/></svg>`;
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

