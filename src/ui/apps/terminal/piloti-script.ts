/**
 * Translates a piloti-shell script (JavaScript plus command lines) into the
 * body of one async function, so variables, blocks and loops work across lines.
 * A command line becomes `await __sh(line, values, number)`.
 */

export interface ScriptSyntax {
  /** Whether the line, taken alone, is a command and not JavaScript. */
  isCommand: (line: string, declared: ReadonlySet<string>) => Promise<boolean>;
  /** The JavaScript expressions among a command's words. */
  jsWords: (line: string) => string[];
}

const DECLARATION = /\b(?:let|const|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
/** After these, a `{` opens a block and not an object. */
const OPENS_BLOCK = /(^|[){};]|=>|\b(else|try|finally|do))$/;
/** After these, the next line goes on with the same expression. */
const UNFINISHED = /([=*/%&|^!<>?:,.([]|(^|[^+])\+|(^|[^-])-)$/;

/** Tracks brackets, strings and comments through the JavaScript lines. */
function createScanner() {
  const open: { bracket: string; block: boolean }[] = [];
  let quote = "";
  let comment = false;
  let last = "";
  return {
    /** Whether a new statement may start on the next line. */
    atStatement: () =>
      !quote &&
      !comment &&
      open.every((o) => o.block) &&
      (!UNFINISHED.test(last) || /^(case\b|default\b)/.test(last)),
    /** A command ends its statement. */
    reset: () => {
      last = "";
    },
    read(line: string) {
      let code = "";
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i]!;
        if (comment) {
          if (c === "*" && line[i + 1] === "/") {
            comment = false;
            i += 1;
          }
        } else if (quote) {
          if (c === "\\") i += 1;
          else if (c === quote) {
            quote = "";
            code += c;
          }
        } else if (c === "/" && line[i + 1] === "/") break;
        else if (c === "/" && line[i + 1] === "*") {
          comment = true;
          i += 1;
        } else {
          if (c === "'" || c === '"' || c === "`") quote = c;
          else if ("([{".includes(c)) {
            const before = (code.trim() || last).trimEnd();
            open.push({ bracket: c, block: c === "{" && OPENS_BLOCK.test(before) });
          } else if (")]}".includes(c)) open.pop();
          code += c;
        }
      }
      // A `'` or `"` string does not cross lines.
      if (quote !== "`") quote = "";
      if (code.trim()) last = code.trim();
    },
  };
}

const compiles = (expression: string) => {
  try {
    new Function(`return async () => (${expression}\n)`);
    return true;
  } catch {
    return false;
  }
};

export async function compileScript(source: string, syntax: ScriptSyntax): Promise<string> {
  const lines = source.split("\n");
  const declared = new Set([...source.matchAll(DECLARATION)].map((m) => m[1]!));
  const scanner = createScanner();
  const out: string[] = [];
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (scanner.atStatement()) {
      if (line.startsWith("#")) {
        out.push("");
        continue;
      }
      if (line && !line.startsWith("//") && !line.startsWith(".") && (await syntax.isCommand(line, declared))) {
        let words: string[];
        try {
          words = syntax.jsWords(line).filter(compiles);
        } catch (error) {
          throw new Error(`${index + 1}: ${(error as Error).message}`);
        }
        const values = words.map((w) => `${JSON.stringify(w)}: async () => (${w})`).join(", ");
        out.push(`await __sh(${JSON.stringify(line)}, {${values}}, ${index + 1});`);
        scanner.reset();
        continue;
      }
    }
    scanner.read(raw);
    out.push(raw);
  }
  // A block of its own, so a script may declare names the shell also has.
  return `{\n${out.join("\n")}\n}`;
}
