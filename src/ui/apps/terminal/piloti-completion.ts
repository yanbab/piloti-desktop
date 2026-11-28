/** Tab completion for piloti-shell: command names, object members and file paths. */
import type { Vfs } from "@/core/ports/vfs";

export interface Completion {
  /** Where the completed word starts in the line. */
  start: number;
  /** Replacements for the word, ready to insert. */
  matches: { insert: string; label: string; end: string }[];
}

export interface CompletionSources {
  scope: Record<string, unknown>;
  programs: () => Promise<Iterable<string>>;
  vfs: Vfs;
  /** An absolute path for what was typed (relative, `~`...). */
  resolve: (path: string) => string;
}

/** The word being typed at the end of `text`, unquoted. */
function lastWord(text: string) {
  let start = 0;
  let word = "";
  let quote = "";
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === "\\" && quote !== "'" && i + 1 < text.length) word += text[++i];
    else if (quote) {
      if (c === quote) quote = "";
      else word += c;
    } else if (c === "'" || c === '"') quote = c;
    else if (/[\s(,]/.test(c)) {
      start = i + 1;
      word = "";
    } else word += c;
  }
  const opened = /^['"]/.test(text.slice(start)) ? text[start]! : "";
  return { start, word, quote: opened };
}

export async function complete(text: string, sources: CompletionSources): Promise<Completion> {
  const { start, word, quote } = lastWord(text);
  const first = !text.slice(0, start).trim() && !quote;

  const member = /^((?:[A-Za-z_]\w*\.)+)(\w*)$/.exec(word);
  if (member && !quote) {
    let target: unknown = sources.scope;
    // Own data only: completing must not call anything.
    for (const name of member[1]!.split(".").filter(Boolean)) {
      const found = target ? Object.getOwnPropertyDescriptor(target, name) : undefined;
      target = found && "value" in found ? found.value : undefined;
    }
    if (target && typeof target === "object") {
      const matches = Object.keys(target)
        .filter((key) => key.startsWith(member[2]!))
        .sort()
        .map((key) => ({ insert: member[1] + key, label: key, end: "" }));
      return { start, matches };
    }
  }

  if (first && !/^[.~]?\.?\//.test(word) && !word.startsWith("~")) {
    const names = new Set([...Object.keys(sources.scope), ...(await sources.programs())]);
    const matches = [...names]
      .filter((name) => name.startsWith(word))
      .sort()
      .map((name) => ({ insert: name, label: name, end: " " }));
    return { start, matches };
  }

  const slash = word.lastIndexOf("/");
  const dir = word.slice(0, slash + 1);
  const prefix = word.slice(slash + 1);
  const entries = (await sources.vfs.list(sources.resolve(dir || ".")).catch(() => null)) ?? [];
  const escape = (path: string) => {
    if (quote) return quote + path;
    return path.replace(/[\s'"\\()$*?{}[\],;|&<>]/g, "\\$&");
  };
  const matches = entries
    .filter((e) => e.name.startsWith(prefix) && (prefix.startsWith(".") || !e.name.startsWith(".")))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const folder = e.kind === "directory";
      return {
        insert: escape(dir + e.name) + (folder ? "/" : ""),
        label: folder ? `${e.name}/` : e.name,
        end: folder ? "" : `${quote} `,
      };
    });
  return { start, matches };
}
