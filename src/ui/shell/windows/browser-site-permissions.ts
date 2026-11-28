import {
  WEBVIEW_PERMISSIONS,
  WEBVIEW_PERMISSION_SETTINGS,
  type WebViewPermission,
  type WebViewPermissionSetting,
} from "@domicile-desktop/sdk/webview-element";

/** Always listed in the site panel, even while still "ask", as Chrome does. */
const ALWAYS_SHOWN: readonly WebViewPermission[] = ["camera", "microphone", "location", "notifications"];

export type SitePermissionRow = {
  readonly permission: WebViewPermission;
  readonly setting: WebViewPermissionSetting;
};

function isSetting(value: unknown): value is WebViewPermissionSetting {
  return typeof value === "string" && (WEBVIEW_PERMISSION_SETTINGS as readonly string[]).includes(value);
}

/**
 * The rows of the site panel from `sitePermissions()` (external data): the
 * common ones, then any other the site was given an answer for, in the SDK's
 * order. `[]` when the page has no site (not http, https or an extension).
 */
export function sitePermissionRows(raw: Record<string, unknown> | null | undefined): SitePermissionRow[] {
  if (!raw || Object.keys(raw).length === 0) return [];
  const rows: SitePermissionRow[] = [];
  for (const permission of WEBVIEW_PERMISSIONS) {
    const value = raw[permission];
    const setting = isSetting(value) ? value : "ask";
    if (ALWAYS_SHOWN.includes(permission) || setting !== "ask") rows.push({ permission, setting });
  }
  return rows;
}

/** Whether any permission has a stored answer, so "Reset" has something to do. */
export function hasStoredPermissions(rows: readonly SitePermissionRow[]): boolean {
  return rows.some((r) => r.setting !== "ask");
}

