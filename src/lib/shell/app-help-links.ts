export const PILOTI_SITE_URL = "https://yanbab.github.io/piloti-desktop/";
export const PILOTI_ISSUES_URL = "https://github.com/yanbab/piloti-desktop/issues/new";

/** Lowercase, dash-separated slug used as the website anchor for an app. */
export function slugifyAppName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds the per-app Help menu links:
 * - website: `https://yanbab.github.io/piloti-desktop/#%app`
 * - issue:   `https://github.com/yanbab/piloti-desktop/issues/new?title=%app%20issue`
 * where `%app` is the app slug (website) or its name (issue title).
 */
export function buildAppHelpLinks(appName: string): {
  websiteUrl: string;
  issueUrl: string;
} {
  const name = appName.trim() || "Piloti Desktop";
  return {
    websiteUrl: `${PILOTI_SITE_URL}#${slugifyAppName(name)}`,
    issueUrl: `${PILOTI_ISSUES_URL}?title=${encodeURIComponent(`${name} issue`)}`,
  };
}
