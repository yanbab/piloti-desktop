import { webSearchHome } from "@/core/util/web-search";

/** Start page of a new Web Browser window or tab: the web search home. */
export const BROWSER_HOME_URL = webSearchHome();
/** Web demo start page: pages are shown in an iframe, which most search
 *  engines refuse; the demo searches Wikipedia, which allows it. */
export const BROWSER_DEMO_HOME_URL = webSearchHome(true);

/**
 * Normalizes a user-typed URL or host into a navigable URL string.
 */
export function normalizeWebUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // A scheme, but not a host with a port (`localhost:5173`, `example.com:8080`).
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:(?!\d)/.test(trimmed)) {
    return trimmed;
  }
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}
