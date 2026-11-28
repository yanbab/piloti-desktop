/**
 * CSP-safe JavaScript expression & async statement evaluator for environments
 * with `script-src 'self'` (no `unsafe-eval`).
 */

type TokenKind = "num" | "str" | "tpl" | "id" | "op" | "punc" | "eof";

interface Token {
  kind: TokenKind;
  value: string;
}

const MULTI_OPS = [
  "===",
  "!==",
  "**",
  "=>",
  "?.",
  "??",
  "&&",
  "||",
  "==",
  "!=",
  "<=",
  ">=",
  "...",
];

const BUILTIN_GLOBALS: Record<string, unknown> = {
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Date,
  Promise,
  RegExp,
  Map,
  Set,
  console,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  NaN,
  Infinity,
  undefined,
  null: null,
  true: true,
  false: false,
};

function isPromiseLike(val: unknown): val is PromiseLike<unknown> {
  return (
    (typeof val === "object" || typeof val === "function") &&
    val !== null &&
    typeof (val as PromiseLike<unknown>).then === "function"
  );
}

function chain<T, U>(val: T | PromiseLike<T>, fn: (resolved: T) => U | PromiseLike<U>): U | PromiseLike<U> {
  return isPromiseLike(val) ? val.then(fn) : fn(val);
}

function chainAll<T>(items: (T | PromiseLike<T>)[]): T[] | Promise<T[]> {
  if (items.some(isPromiseLike)) {
    return Promise.all(items);
  }
  return items as T[];
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      i++;
      let val = "";
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < source.length) {
          const esc = source[++i];
          val += esc === "n" ? "\n" : esc === "t" ? "\t" : esc === "r" ? "\r" : esc;
          i++;
        } else {
          val += source[i++];
        }
      }
      if (source[i] !== quote) throw new SyntaxError("Unterminated string literal");
      i++;
      tokens.push({ kind: quote === "`" ? "tpl" : "str", value: val });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      const start = i;
      if (ch === "0" && (source[i + 1] === "x" || source[i + 1] === "X")) {
        i += 2;
        while (i < source.length && /[0-9a-fA-F_]/.test(source[i])) i++;
      } else {
        while (i < source.length && /[0-9_]/.test(source[i])) i++;
        if (source[i] === ".") {
          i++;
          while (i < source.length && /[0-9_]/.test(source[i])) i++;
        }
        if (source[i] === "e" || source[i] === "E") {
          i++;
          if (source[i] === "+" || source[i] === "-") i++;
          while (i < source.length && /[0-9_]/.test(source[i])) i++;
        }
      }
      tokens.push({ kind: "num", value: source.slice(start, i).replace(/_/g, "") });
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) i++;
      tokens.push({ kind: "id", value: source.slice(start, i) });
      continue;
    }

    const multi = MULTI_OPS.find((op) => source.startsWith(op, i));
    if (multi) {
      tokens.push({ kind: multi === "..." ? "punc" : "op", value: multi });
      i += multi.length;
      continue;
    }

    if ("+-*/%<>=!&|?".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }

    if ("()[]{},.:;".includes(ch)) {
      tokens.push({ kind: "punc", value: ch });
      i++;
      continue;
    }

    throw new SyntaxError(`Unexpected character: ${ch}`);
  }

  tokens.push({ kind: "eof", value: "" });
  return tokens;
}

type EvalFn = (env: Record<string, unknown>) => unknown;

interface RefEval {
  set: (env: Record<string, unknown>, val: unknown) => unknown;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] ?? { kind: "eof", value: "" };
  }

  private consume(): Token {
    return this.tokens[this.pos++] ?? { kind: "eof", value: "" };
  }

  private match(kind: TokenKind, value?: string): boolean {
    const tok = this.peek();
    if (tok.kind !== kind) return false;
    if (value !== undefined && tok.value !== value) return false;
    this.pos++;
    return true;
  }

  private expect(kind: TokenKind, value?: string): Token {
    const tok = this.peek();
    if (tok.kind !== kind || (value !== undefined && tok.value !== value)) {
      throw new SyntaxError(`Expected '${value ?? kind}', got '${tok.value || tok.kind}'`);
    }
    this.pos++;
    return tok;
  }

  parseProgram(): EvalFn {
    const stmts: EvalFn[] = [];
    while (this.peek().kind !== "eof") {
      while (this.match("punc", ";")) {
        // skip empty statements
      }
      if (this.peek().kind === "eof") break;
      stmts.push(this.parseStatement());
      this.match("punc", ";");
    }
    return (env) => {
      let acc: unknown = undefined;
      for (const stmt of stmts) {
        acc = chain(acc, () => stmt(env));
      }
      return acc;
    };
  }

  private parseStatement(): EvalFn {
    if (
      this.peek().kind === "id" &&
      (this.peek().value === "const" ||
        this.peek().value === "let" ||
        this.peek().value === "var")
    ) {
      this.consume();
      const name = this.expect("id").value;
      const init: EvalFn = this.match("op", "=")
        ? this.parseExpression()
        : () => undefined;
      return (env) =>
        chain(init(env), (val) => {
          env[name] = val;
          return val;
        });
    }
    if (this.match("id", "return")) {
      if (this.peek().kind === "eof" || this.peek().value === ";") {
        return () => undefined;
      }
      return this.parseExpression();
    }
    return this.parseExpression();
  }

  private parseExpression(): EvalFn {
    return this.parseAssignment();
  }

  private parseAssignment(): EvalFn {
    const arrow = this.tryParseArrow();
    if (arrow) return arrow;

    const left = this.parseConditional();
    if (this.match("op", "=")) {
      const right = this.parseAssignment();
      const ref = (left as EvalFn & { ref?: RefEval }).ref;
      if (!ref) throw new SyntaxError("Invalid assignment target");
      return (env) => chain(right(env), (val) => ref.set(env, val));
    }
    return left;
  }

  private tryParseArrow(): EvalFn | null {
    const saved = this.pos;
    if (this.peek().kind === "id" && this.peek(1).value === "=>") {
      const param = this.consume().value;
      this.consume();
      const body = this.parseAssignment();
      return (env) => (...args: unknown[]) => {
        const child = Object.create(env) as Record<string, unknown>;
        child[param] = args[0];
        return body(child);
      };
    }
    if (this.peek().value === "(") {
      this.consume();
      const params: string[] = [];
      let valid = true;
      if (this.peek().value !== ")") {
        while (true) {
          if (this.peek().kind !== "id") {
            valid = false;
            break;
          }
          params.push(this.consume().value);
          if (!this.match("punc", ",")) break;
        }
      }
      if (valid && this.match("punc", ")") && this.match("op", "=>")) {
        const body = this.parseAssignment();
        return (env) => (...args: unknown[]) => {
          const child = Object.create(env) as Record<string, unknown>;
          params.forEach((p, idx) => {
            child[p] = args[idx];
          });
          return body(child);
        };
      }
      this.pos = saved;
    }
    return null;
  }

  private parseConditional(): EvalFn {
    const cond = this.parseNullish();
    if (!this.match("op", "?")) return cond;
    const whenTrue = this.parseExpression();
    this.expect("punc", ":");
    const whenFalse = this.parseConditional();
    return (env) =>
      chain(cond(env), (c) => (c ? whenTrue(env) : whenFalse(env)));
  }

  private parseNullish(): EvalFn {
    let left = this.parseOr();
    while (this.match("op", "??")) {
      const right = this.parseOr();
      const prev = left;
      left = (env) => chain(prev(env), (v) => v ?? right(env));
    }
    return left;
  }

  private parseOr(): EvalFn {
    let left = this.parseAnd();
    while (this.match("op", "||")) {
      const right = this.parseAnd();
      const prev = left;
      left = (env) => chain(prev(env), (v) => v || right(env));
    }
    return left;
  }

  private parseAnd(): EvalFn {
    let left = this.parseEquality();
    while (this.match("op", "&&")) {
      const right = this.parseEquality();
      const prev = left;
      left = (env) => chain(prev(env), (v) => v && right(env));
    }
    return left;
  }

  private parseEquality(): EvalFn {
    let left = this.parseRelational();
    while (
      this.peek().kind === "op" &&
      ["===", "!==", "==", "!="].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseRelational();
      const prev = left;
      left = (env) =>
        chain(prev(env), (a) =>
          chain(right(env), (b) => {
            if (op === "===") return a === b;
            if (op === "!==") return a !== b;
            if (op === "==") return a == b;
            return a != b;
          })
        );
    }
    return left;
  }

  private parseRelational(): EvalFn {
    let left = this.parseAdditive();
    while (
      this.peek().kind === "op" &&
      ["<", "<=", ">", ">="].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseAdditive();
      const prev = left;
      left = (env) =>
        chain(prev(env), (a) =>
          chain(right(env), (b) => {
            const x = a as number | string;
            const y = b as number | string;
            if (op === "<") return x < y;
            if (op === "<=") return x <= y;
            if (op === ">") return x > y;
            return x >= y;
          })
        );
    }
    return left;
  }

  private parseAdditive(): EvalFn {
    let left = this.parseMultiplicative();
    while (
      this.peek().kind === "op" &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      const prev = left;
      left = (env) =>
        chain(prev(env), (a) =>
          chain(right(env), (b) =>
            op === "+"
              ? (a as number) + (b as number)
              : (a as number) - (b as number)
          )
        );
    }
    return left;
  }

  private parseMultiplicative(): EvalFn {
    let left = this.parseUnary();
    while (
      this.peek().kind === "op" &&
      ["*", "/", "%", "**"].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseUnary();
      const prev = left;
      left = (env) =>
        chain(prev(env), (a) =>
          chain(right(env), (b) => {
            const x = Number(a);
            const y = Number(b);
            if (op === "*") return x * y;
            if (op === "/") return x / y;
            if (op === "%") return x % y;
            return x ** y;
          })
        );
    }
    return left;
  }

  private parseUnary(): EvalFn {
    if (this.match("id", "await")) {
      const inner = this.parseUnary();
      return (env) => Promise.resolve(inner(env));
    }
    if (this.match("id", "typeof")) {
      const inner = this.parseUnary();
      return (env) => chain(inner(env), (v) => typeof v);
    }
    if (this.match("id", "void")) {
      const inner = this.parseUnary();
      return (env) => chain(inner(env), () => undefined);
    }
    if (this.match("op", "!")) {
      const inner = this.parseUnary();
      return (env) => chain(inner(env), (v) => !v);
    }
    if (this.match("op", "-")) {
      const inner = this.parseUnary();
      return (env) => chain(inner(env), (v) => -Number(v));
    }
    if (this.match("op", "+")) {
      const inner = this.parseUnary();
      return (env) => chain(inner(env), (v) => +Number(v));
    }
    return this.parsePostfix();
  }

  private parsePostfix(): EvalFn {
    let expr = this.parsePrimary();
    let receiverExpr: EvalFn | null = null;

    while (true) {
      const optional = this.match("op", "?.");
      if (optional && this.peek().value !== "(" && this.peek().value !== "[") {
        const prop = this.expect("id").value;
        const prev = expr;
        receiverExpr = prev;
        const nextFn: EvalFn & { ref?: RefEval } = (env) =>
          chain(prev(env), (obj) =>
            obj == null ? undefined : (obj as Record<string, unknown>)[prop]
          );
        nextFn.ref = {
          set: (env, val) =>
            chain(prev(env), (obj) => {
              (obj as Record<string, unknown>)[prop] = val;
              return val;
            }),
        };
        expr = nextFn;
        continue;
      }

      if (!optional && this.match("punc", ".")) {
        const prop = this.expect("id").value;
        const prev = expr;
        receiverExpr = prev;
        const nextFn: EvalFn & { ref?: RefEval } = (env) =>
          chain(prev(env), (obj) => {
            if (obj == null) {
              throw new TypeError(
                `Cannot read properties of ${String(obj)} (reading '${prop}')`
              );
            }
            return (obj as Record<string, unknown>)[prop];
          });
        nextFn.ref = {
          set: (env, val) =>
            chain(prev(env), (obj) => {
              (obj as Record<string, unknown>)[prop] = val;
              return val;
            }),
        };
        expr = nextFn;
        continue;
      }

      if (this.match("punc", "[")) {
        const keyExpr = this.parseExpression();
        this.expect("punc", "]");
        const prev = expr;
        receiverExpr = prev;
        const nextFn: EvalFn & { ref?: RefEval } = (env) =>
          chain(prev(env), (obj) =>
            chain(keyExpr(env), (key) => {
              if (obj == null) {
                if (optional) return undefined;
                throw new TypeError(`Cannot read properties of ${String(obj)}`);
              }
              return (obj as Record<string, unknown>)[key as string];
            })
          );
        nextFn.ref = {
          set: (env, val) =>
            chain(prev(env), (obj) =>
              chain(keyExpr(env), (key) => {
                (obj as Record<string, unknown>)[key as string] = val;
                return val;
              })
            ),
        };
        expr = nextFn;
        continue;
      }

      if (this.match("punc", "(")) {
        const args: { spread: boolean; fn: EvalFn }[] = [];
        if (this.peek().value !== ")") {
          while (true) {
            const spread = this.match("punc", "...");
            args.push({ spread, fn: this.parseExpression() });
            if (!this.match("punc", ",")) break;
          }
        }
        this.expect("punc", ")");
        const calleeExpr = expr;
        const boundReceiver = receiverExpr;
        receiverExpr = null;

        expr = (env) =>
          chain(boundReceiver ? boundReceiver(env) : undefined, (thisArg) =>
            chain(calleeExpr(env), (fn) => {
              if (fn == null && optional) return undefined;
              if (typeof fn !== "function") {
                throw new TypeError(`${String(fn)} is not a function`);
              }
              return chainAll(args.map((a) => a.fn(env))).valueOf() instanceof Promise
                ? Promise.resolve(chainAll(args.map((a) => a.fn(env)))).then(
                    (vals) => {
                      const resolved: unknown[] = [];
                      vals.forEach((v, idx) => {
                        if (args[idx].spread && Array.isArray(v)) resolved.push(...v);
                        else resolved.push(v);
                      });
                      return (fn as (...a: unknown[]) => unknown).apply(
                        thisArg,
                        resolved
                      );
                    }
                  )
                : (() => {
                    const vals = chainAll(args.map((a) => a.fn(env))) as unknown[];
                    const resolved: unknown[] = [];
                    vals.forEach((v, idx) => {
                      if (args[idx].spread && Array.isArray(v)) resolved.push(...v);
                      else resolved.push(v);
                    });
                    return (fn as (...a: unknown[]) => unknown).apply(
                      thisArg,
                      resolved
                    );
                  })();
            })
          );
        continue;
      }

      if (optional) throw new SyntaxError("Unexpected '?.'");
      break;
    }

    return expr;
  }

  private parsePrimary(): EvalFn {
    const tok = this.peek();

    if (tok.kind === "num") {
      this.consume();
      const val = Number(tok.value);
      return () => val;
    }

    if (tok.kind === "str") {
      this.consume();
      return () => tok.value;
    }

    if (tok.kind === "tpl") {
      this.consume();
      return async (env) => {
        let out = "";
        let i = 0;
        const raw = tok.value;
        while (i < raw.length) {
          if (raw[i] === "$" && raw[i + 1] === "{") {
            i += 2;
            let depth = 1;
            const start = i;
            while (i < raw.length && depth > 0) {
              if (raw[i] === "{") depth++;
              else if (raw[i] === "}") depth--;
              if (depth > 0) i++;
            }
            const sub = raw.slice(start, i);
            i++;
            out += String(await evaluateCspSafe(sub, env));
          } else {
            out += raw[i++];
          }
        }
        return out;
      };
    }

    if (tok.kind === "id") {
      this.consume();
      const name = tok.value;
      const fn: EvalFn & { ref?: RefEval } = (env) => {
        if (name in env) return env[name];
        if (name in BUILTIN_GLOBALS) return BUILTIN_GLOBALS[name];
        if (typeof globalThis !== "undefined" && name in globalThis) {
          return (globalThis as Record<string, unknown>)[name];
        }
        throw new ReferenceError(`${name} is not defined`);
      };
      fn.ref = {
        set: (env, val) => {
          env[name] = val;
          return val;
        },
      };
      return fn;
    }

    if (this.match("punc", "(")) {
      const inner = this.parseExpression();
      this.expect("punc", ")");
      return inner;
    }

    if (this.match("punc", "[")) {
      const items: { spread: boolean; fn: EvalFn }[] = [];
      if (this.peek().value !== "]") {
        while (true) {
          if (this.peek().value === "]") break;
          const spread = this.match("punc", "...");
          items.push({ spread, fn: this.parseExpression() });
          if (!this.match("punc", ",")) break;
        }
      }
      this.expect("punc", "]");
      return (env) =>
        chain(chainAll(items.map((item) => item.fn(env))), (vals) => {
          const arr: unknown[] = [];
          vals.forEach((v, idx) => {
            if (items[idx].spread && Array.isArray(v)) arr.push(...v);
            else arr.push(v);
          });
          return arr;
        });
    }

    if (this.match("punc", "{")) {
      const props: (
        | { spread: true; fn: EvalFn }
        | { spread: false; key: string; fn: EvalFn }
      )[] = [];
      if (this.peek().value !== "}") {
        while (true) {
          if (this.peek().value === "}") break;
          if (this.match("punc", "...")) {
            props.push({ spread: true, fn: this.parseExpression() });
          } else {
            const keyTok = this.consume();
            if (keyTok.kind !== "id" && keyTok.kind !== "str" && keyTok.kind !== "num") {
              throw new SyntaxError(`Invalid object key '${keyTok.value}'`);
            }
            if (this.match("punc", ":")) {
              props.push({
                spread: false,
                key: keyTok.value,
                fn: this.parseExpression(),
              });
            } else if (keyTok.kind === "id") {
              const name = keyTok.value;
              props.push({
                spread: false,
                key: name,
                fn: (env) => {
                  if (name in env) return env[name];
                  throw new ReferenceError(`${name} is not defined`);
                },
              });
            } else {
              throw new SyntaxError("Expected ':' after property key");
            }
          }
          if (!this.match("punc", ",")) break;
        }
      }
      this.expect("punc", "}");
      return (env) =>
        chain(chainAll(props.map((p) => p.fn(env))), (vals) => {
          const obj: Record<string, unknown> = {};
          vals.forEach((v, idx) => {
            const prop = props[idx];
            if (prop.spread) Object.assign(obj, v);
            else obj[prop.key] = v;
          });
          return obj;
        });
    }

    throw new SyntaxError(`Unexpected token '${tok.value || tok.kind}'`);
  }
}

async function evaluateCspSafe(
  source: string,
  scope: Record<string, unknown>
): Promise<unknown> {
  const tokens = tokenize(source);
  const program = new Parser(tokens).parseProgram();
  const env = Object.assign(Object.create(null) as Record<string, unknown>, scope);
  return await program(env);
}

export { evaluateCspSafe };
