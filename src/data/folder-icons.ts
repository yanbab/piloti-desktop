import type { AccentColorId } from "./catalog";
import folderBlueSvg from "./icons/folder-blue.svg?raw";
import folderBrownSvg from "./icons/folder-brown.svg?raw";
import folderGreenSvg from "./icons/folder-green.svg?raw";
import folderOrangeSvg from "./icons/folder-orange.svg?raw";
import folderPinkSvg from "./icons/folder-pink.svg?raw";
import folderPurpleSvg from "./icons/folder-purple.svg?raw";
import folderRedSvg from "./icons/folder-red.svg?raw";
import folderSlateSvg from "./icons/folder-slate.svg?raw";
import folderTealSvg from "./icons/folder-teal.svg?raw";
import folderYellowSvg from "./icons/folder-yellow.svg?raw";
import htmlBlueSvg from "./icons/text-html-blue.svg?raw";
import htmlGreenSvg from "./icons/text-html-green.svg?raw";
import htmlOrangeSvg from "./icons/text-html-orange.svg?raw";
import htmlPinkSvg from "./icons/text-html-pink.svg?raw";
import htmlPurpleSvg from "./icons/text-html-purple.svg?raw";
import htmlRedSvg from "./icons/text-html-red.svg?raw";
import htmlSlateSvg from "./icons/text-html-slate.svg?raw";
import htmlTealSvg from "./icons/text-html-teal.svg?raw";
import htmlYellowSvg from "./icons/text-html-yellow.svg?raw";

function toSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const ACCENT_FOLDER_ICON_URLS: Record<AccentColorId, string> = {
  blue: toSvgDataUrl(folderBlueSvg),
  teal: toSvgDataUrl(folderTealSvg),
  green: toSvgDataUrl(folderGreenSvg),
  yellow: toSvgDataUrl(folderYellowSvg),
  orange: toSvgDataUrl(folderOrangeSvg),
  red: toSvgDataUrl(folderRedSvg),
  pink: toSvgDataUrl(folderPinkSvg),
  purple: toSvgDataUrl(folderPurpleSvg),
  graphite: toSvgDataUrl(folderSlateSvg),
};

export const BROWN_FOLDER_ICON_URL = toSvgDataUrl(folderBrownSvg);

export function getAccentFolderIconUrl(accentColor?: AccentColorId): string {
  if (accentColor && accentColor in ACCENT_FOLDER_ICON_URLS) {
    return ACCENT_FOLDER_ICON_URLS[accentColor];
  }
  return ACCENT_FOLDER_ICON_URLS.blue;
}

export const ACCENT_HTML_ICON_URLS: Record<AccentColorId, string> = {
  blue: toSvgDataUrl(htmlBlueSvg),
  teal: toSvgDataUrl(htmlTealSvg),
  green: toSvgDataUrl(htmlGreenSvg),
  yellow: toSvgDataUrl(htmlYellowSvg),
  orange: toSvgDataUrl(htmlOrangeSvg),
  red: toSvgDataUrl(htmlRedSvg),
  pink: toSvgDataUrl(htmlPinkSvg),
  purple: toSvgDataUrl(htmlPurpleSvg),
  graphite: toSvgDataUrl(htmlSlateSvg),
};

export function getAccentHtmlIconUrl(accentColor?: AccentColorId): string {
  if (accentColor && accentColor in ACCENT_HTML_ICON_URLS) {
    return ACCENT_HTML_ICON_URLS[accentColor];
  }
  return ACCENT_HTML_ICON_URLS.blue;
}

