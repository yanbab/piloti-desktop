/**
 * Web search for the Web Browser address bar, the Launcher's "Search the web"
 * and new tabs. One provider for now (DuckDuckGo Lite); a provider setting
 * comes later.
 *
 * The browser demo shows pages in an iframe, which DuckDuckGo refuses
 * (X-Frame-Options), so it searches Wikipedia instead.
 */

interface SearchProvider {
  /** Start page of a new tab. */
  home: string;
  /** Results page; `%s` is the encoded query. */
  search: string;
}

const DUCKDUCKGO_LITE: SearchProvider = {
  home: "https://lite.duckduckgo.com/lite/",
  search: "https://lite.duckduckgo.com/lite/?q=%s",
};

const WIKIPEDIA: SearchProvider = {
  home: "https://www.wikipedia.org/",
  search: "https://en.wikipedia.org/w/index.php?search=%s",
};

function provider(inIframe: boolean): SearchProvider {
  return inIframe ? WIKIPEDIA : DUCKDUCKGO_LITE;
}

/** Start page of a new tab or browser window. */
export function webSearchHome(inIframe = false): string {
  return provider(inIframe).home;
}

/** Results page for `query`. */
export function webSearchUrl(query: string, inIframe = false): string {
  return provider(inIframe).search.replace("%s", encodeURIComponent(query.trim()));
}

/**
 * True for text that is meant as an address: a scheme (`https:`, `about:`),
 * `localhost`, an IP, or a host with a dot and no spaces (`example.com/x`).
 */
export function looksLikeUrl(raw: string): boolean {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text) || /^(about|data|file|chrome):/i.test(text)) return true;
  if (/^(localhost|\[::1\])(:\d+)?(\/|$)/i.test(text)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(text)) return true;
  // host.tld, optional port and path: the last label is letters, 2+ long.
  return /^[^/?#.]+(\.[^/?#.]+)*\.[a-zA-Z]{2,}(:\d+)?([/?#].*)?$/.test(text);
}
