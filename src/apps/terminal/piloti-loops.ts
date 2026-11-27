/**
 * Puts a check inside every loop of piloti-shell code. The shell shares the
 * desktop's thread: a loop that never pauses would freeze it.
 */
import { parser } from "@lezer/javascript";

/** How long a loop runs before it lets the keys and the screen in. */
const SLICE_MS = 50;
/** How long a loop that cannot pause (a plain function's) may run. */
const SYNC_LIMIT_MS = 5000;

export interface LoopGuard {
  due(): boolean;
  pause(): Promise<void>;
  check(): void;
}

export class Interrupted extends Error {
  constructor() {
    super("interrupted");
  }
}

export function createLoopGuard(interrupted: () => boolean, limit = SYNC_LIMIT_MS): LoopGuard {
  let paused = Date.now();
  let since = 0;
  return {
    due() {
      if (interrupted()) throw new Interrupted();
      return Date.now() - paused > SLICE_MS;
    },
    async pause() {
      await new Promise((done) => setTimeout(done, 0));
      paused = Date.now();
      if (interrupted()) throw new Interrupted();
    },
    check() {
      if (!since) {
        since = Date.now();
        // Forgotten as soon as the thread is free again.
        setTimeout(() => (since = 0), 0);
      } else if (Date.now() - since > limit) {
        throw new Error("loop stopped: it ran too long in a function that is not async");
      }
    },
  };
}

const LOOPS = new Set(["ForStatement", "WhileStatement", "DoStatement"]);
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunction", "MethodDeclaration", "Property"]);

type Node = ReturnType<typeof parser.parse>["topNode"];

/** Top-level code may await; a function only if it is `async`. */
function canAwait(loop: Node): boolean {
  for (let node = loop.parent; node; node = node.parent) {
    if (!FUNCTIONS.has(node.name)) continue;
    // An object's `Property` is a function only when it has a body (a method).
    if (node.name === "Property" && !node.getChild("ParamList")) continue;
    return !!node.getChild("async");
  }
  return true;
}

export function guardLoops(code: string, name = "__loop"): string {
  if (!/\b(for|while|do)\b/.test(code)) return code;
  const inserts: { at: number; text: string }[] = [];
  parser.parse(code).iterate({
    enter: (ref) => {
      if (!LOOPS.has(ref.name)) return;
      const loop = ref.node;
      const body = loop.name === "DoStatement" ? loop.firstChild?.nextSibling : loop.lastChild;
      if (!body) return;
      const check = canAwait(loop) ? `if(${name}.due())await ${name}.pause();` : `${name}.check();`;
      if (body.name === "Block") inserts.push({ at: body.from + 1, text: check });
      else inserts.push({ at: body.from, text: `{${check}` }, { at: body.to, text: "}" });
    },
  });
  // From the end, so earlier positions hold; at one place, the first found stays outermost.
  inserts
    .map((insert, order) => ({ ...insert, order }))
    .sort((a, b) => b.at - a.at || b.order - a.order)
    .forEach(({ at, text }) => (code = code.slice(0, at) + text + code.slice(at)));
  return code;
}
