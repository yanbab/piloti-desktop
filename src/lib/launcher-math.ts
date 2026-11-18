export interface LauncherMathResult {
  expression: string;
  result: string;
  rawValue: number;
}

type Token =
  | { kind: "num"; value: number }
  | { kind: "id"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "%" | "^" }
  | { kind: "paren"; value: "(" | ")" };

function tokenizeMath(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ kind: "paren", value: ch });
      i += 1;
      continue;
    }
    if (ch === "*" && input[i + 1] === "*") {
      tokens.push({ kind: "op", value: "^" });
      i += 2;
      continue;
    }
    if (
      ch === "+" ||
      ch === "-" ||
      ch === "*" ||
      ch === "/" ||
      ch === "%" ||
      ch === "^"
    ) {
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }
    if (ch === "×") {
      tokens.push({ kind: "op", value: "*" });
      i += 1;
      continue;
    }
    if (ch === "÷") {
      tokens.push({ kind: "op", value: "/" });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const rest = input.slice(i);
      const match =
        /^(?:0x[0-9a-fA-F]+|0b[01]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i.exec(
          rest,
        );
      if (!match) return null;
      const raw = match[0];
      const num = raw.toLowerCase().startsWith("0x")
        ? Number.parseInt(raw.slice(2), 16)
        : raw.toLowerCase().startsWith("0b")
          ? Number.parseInt(raw.slice(2), 2)
          : Number.parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      tokens.push({ kind: "num", value: num });
      i += raw.length;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const rest = input.slice(i);
      const match = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(rest);
      if (!match) return null;
      tokens.push({ kind: "id", value: match[0].toLowerCase() });
      i += match[0].length;
      continue;
    }
    return null;
  }
  return tokens;
}

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

export function evaluateLauncherMath(rawQuery: string): LauncherMathResult | null {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;
  const hasLeadingEq = trimmed.startsWith("=");
  const expr = (hasLeadingEq ? trimmed.slice(1) : trimmed).trim();
  if (!expr) return null;

  const tokens = tokenizeMath(expr);
  if (!tokens || tokens.length === 0) return null;

  // Require at least one operator, function call, hex/binary literal, or leading '='
  const hasOperatorOrFn =
    hasLeadingEq ||
    /^0[xb]/i.test(expr) ||
    tokens.some(
      (t) =>
        t.kind === "op" ||
        (t.kind === "id" && (t.value in FUNCTIONS || t.value in CONSTANTS)),
    );
  if (!hasOperatorOrFn || (tokens.length === 1 && tokens[0].kind === "num" && !hasLeadingEq && !/^0[xb]/i.test(expr))) {
    return null;
  }

  let pos = 0;

  function parseExpression(): number {
    let left = parseTerm();
    while (pos < tokens!.length) {
      const t = tokens![pos];
      if (t.kind === "op" && (t.value === "+" || t.value === "-")) {
        pos += 1;
        const right = parseTerm();
        left = t.value === "+" ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (pos < tokens!.length) {
      const t = tokens![pos];
      if (
        t.kind === "op" &&
        (t.value === "*" || t.value === "/" || t.value === "%")
      ) {
        pos += 1;
        const right = parsePower();
        if ((t.value === "/" || t.value === "%") && right === 0) {
          return Number.NaN;
        }
        left =
          t.value === "*"
            ? left * right
            : t.value === "/"
              ? left / right
              : left % right;
      } else {
        break;
      }
    }
    return left;
  }

  function parsePower(): number {
    const base = parseUnary();
    const t = tokens![pos];
    if (t && t.kind === "op" && t.value === "^") {
      pos += 1;
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    const t = tokens![pos];
    if (t && t.kind === "op" && (t.value === "+" || t.value === "-")) {
      pos += 1;
      const val = parseUnary();
      return t.value === "-" ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = tokens![pos];
    if (!t) return Number.NaN;
    if (t.kind === "num") {
      pos += 1;
      return t.value;
    }
    if (t.kind === "id") {
      pos += 1;
      if (t.value in CONSTANTS) {
        return CONSTANTS[t.value];
      }
      const fn = FUNCTIONS[t.value];
      const open = tokens![pos];
      if (!fn || !open || open.kind !== "paren" || open.value !== "(") {
        return Number.NaN;
      }
      pos += 1;
      const arg = parseExpression();
      const close = tokens![pos];
      if (!close || close.kind !== "paren" || close.value !== ")") {
        return Number.NaN;
      }
      pos += 1;
      return fn(arg);
    }
    if (t.kind === "paren" && t.value === "(") {
      pos += 1;
      const val = parseExpression();
      const close = tokens![pos];
      if (!close || close.kind !== "paren" || close.value !== ")") {
        return Number.NaN;
      }
      pos += 1;
      return val;
    }
    return Number.NaN;
  }

  const value = parseExpression();
  if (pos !== tokens.length || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Number(value.toPrecision(12));
  const formatted = rounded.toLocaleString("en-US", {
    maximumFractionDigits: 10,
  });

  return {
    expression: expr,
    result: formatted,
    rawValue: rounded,
  };
}

