/** What a file is, from its name or text. No storage: shared by both engines. */

/**
 * Parses a FreeDesktop / GNOME Nautilus `.hidden` file (newline-separated
 * basenames in the same directory that should be treated as hidden).
 */
export function parseDotHiddenFile(content: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!content) return out;
  for (const rawLine of content.split(/\r?\n/)) {
    const name = rawLine.trim();
    if (name && !name.includes("/")) {
      out.add(name);
    }
  }
  return out;
}

const TEXT_EDITABLE_EXT_RE =
  /\.(txt|md|markdown|json|css|scss|less|js|mjs|cjs|ts|tsx|jsx|xml|csv|tsv|ya?ml|toml|ini|conf|cfg|log|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|sql)$/i;

/**
 * Returns true for plain-text / markdown / code files that should open in
 * `TextsApp` by default instead of a standalone web view.
 */
export function isTextEditableVfsFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (/\.(html?|svg|png|jpe?g|gif|webp|bmp|ico|avif|mp4|webm|mkv|mov|avi|m4v|mp3|wav|flac|m4a|ogg|aac|pdf|zip|tar|gz|bz2|xz|7z|rar)$/i.test(lower)) {
    return false;
  }
  return TEXT_EDITABLE_EXT_RE.test(lower) || !/\.[a-z0-9]+$/i.test(lower);
}
