/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import {
  WEBVIEW_FIND_CHANGE_EVENT,
  WEBVIEW_HISTORY_CHANGE_EVENT,
  WEBVIEW_LOAD_PROGRESS_CHANGE_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
  WEBVIEW_RENDER_PROCESS_CHANGE_EVENT,
  WEBVIEW_TARGET_URL_CHANGE_EVENT,
  WEBVIEW_TOOLTIP_CHANGE_EVENT,
  WEBVIEW_ZOOM_CHANGE_EVENT,
  WEBVIEW_SECURITY_LEVELS,
  type WebViewSecurity,
} from "@domicile-desktop/sdk/webview-element";

/** What the Web Browser's toolbar and overlays show of a `<webview>`. */
export interface WebViewStatus {
  canGoForward: boolean;
  /** 0.1 to 1 while loading. */
  loadProgress: number;
  /** `""` before the first navigation commits. */
  security: WebViewSecurity | "";
  zoom: number;
  /** The link under the pointer. */
  targetUrl: string;
  tooltip: string;
  tooltipX: number;
  tooltipY: number;
  findMatches: number;
  findActiveMatch: number;
  /** Why the page's renderer went away, or `""`. */
  renderProcessGone: string;
}

export const EMPTY_WEBVIEW_STATUS: WebViewStatus = {
  canGoForward: false,
  loadProgress: 0,
  security: "",
  zoom: 1,
  targetUrl: "",
  tooltip: "",
  tooltipX: 0,
  tooltipY: 0,
  findMatches: 0,
  findActiveMatch: 0,
  renderProcessGone: "",
};

const EVENTS = [
  WEBVIEW_FIND_CHANGE_EVENT,
  WEBVIEW_HISTORY_CHANGE_EVENT,
  WEBVIEW_LOAD_PROGRESS_CHANGE_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
  WEBVIEW_RENDER_PROCESS_CHANGE_EVENT,
  WEBVIEW_TARGET_URL_CHANGE_EVENT,
  WEBVIEW_TOOLTIP_CHANGE_EVENT,
  WEBVIEW_ZOOM_CHANGE_EVENT,
];

function parseSecurity(raw: string): WebViewSecurity | "" {
  return (WEBVIEW_SECURITY_LEVELS as readonly string[]).includes(raw)
    ? (raw as WebViewSecurity)
    : "";
}

function read(view: HTMLWebViewElement): WebViewStatus {
  return {
    canGoForward: Boolean(view.canGoForward),
    // Tenths are enough for a progress bar, and spare re-renders.
    loadProgress: Math.round((view.loadProgress || 0) * 10) / 10,
    security: parseSecurity(view.security || ""),
    zoom: view.zoom || 1,
    targetUrl: view.targetUrl || "",
    tooltip: view.tooltip || "",
    tooltipX: view.tooltipX || 0,
    tooltipY: view.tooltipY || 0,
    findMatches: view.findMatches || 0,
    findActiveMatch: view.findActiveMatch || 0,
    renderProcessGone: view.renderProcessGone || "",
  };
}

function same(a: WebViewStatus, b: WebViewStatus): boolean {
  return (Object.keys(a) as (keyof WebViewStatus)[]).every((k) => a[k] === b[k]);
}

/** Follows a native `<webview>`; stays empty when `enabled` is false (web demo). */
export function useWebViewStatus(
  ref: React.RefObject<HTMLWebViewElement | null>,
  enabled: boolean
): WebViewStatus {
  const [status, setStatus] = React.useState(EMPTY_WEBVIEW_STATUS);
  React.useEffect(() => {
    const view = ref.current;
    if (!view || !enabled) return;
    const sync = () => {
      const next = read(view);
      setStatus((prev) => (same(prev, next) ? prev : next));
    };
    for (const name of EVENTS) view.addEventListener(name, sync);
    sync();
    return () => {
      for (const name of EVENTS) view.removeEventListener(name, sync);
    };
  }, [ref, enabled]);
  return status;
}
