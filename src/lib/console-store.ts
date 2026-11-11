import * as React from "react";

export type ConsoleLogLevel = "log" | "info" | "warn" | "error";

export interface ConsoleLogEntry {
  id: number;
  level: ConsoleLogLevel;
  timestamp: number;
  message: string;
  count: number;
}

const MAX_LOG_ENTRIES = 300;
let nextEntryId = 1;
let installed = false;
let entries: ConsoleLogEntry[] = [];
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Formats any runtime value into a readable DevTools-like string with cycle
 * and depth protection.
 */
export function formatInspectValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return depth === 0 ? value : JSON.stringify(value);
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (typeof Element !== "undefined" && value instanceof Element) {
    const id = value.id ? `#${value.id}` : "";
    return `<${value.tagName.toLowerCase()}${id}>`;
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    if (depth >= 3) {
      return Array.isArray(value)
        ? `Array(${value.length})`
        : value.constructor?.name || "Object";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      const items = value
        .slice(0, 20)
        .map((item) => formatInspectValue(item, depth + 1, seen));
      if (value.length > 20) {
        items.push(`… +${value.length - 20} more`);
      }
      return `[${items.join(", ")}]`;
    }

    if (value instanceof Map) {
      return `Map(${value.size})`;
    }
    if (value instanceof Set) {
      return `Set(${value.size})`;
    }

    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const indent = "  ".repeat(depth + 1);
    const closingIndent = "  ".repeat(depth);
    const previewKeys = keys.slice(0, 24);
    const lines = previewKeys.map((k) => {
      const prop = (value as Record<string, unknown>)[k];
      return `${indent}${k}: ${formatInspectValue(prop, depth + 1, seen)}`;
    });
    if (keys.length > 24) {
      lines.push(`${indent}… +${keys.length - 24} keys`);
    }
    return `{\n${lines.join(",\n")}\n${closingIndent}}`;
  }

  return String(value);
}

function appendLog(level: ConsoleLogLevel, args: unknown[]) {
  const message = args.map((arg) => formatInspectValue(arg)).join(" ");
  const last = entries[entries.length - 1];
  if (last && last.level === level && last.message === message) {
    entries = [
      ...entries.slice(0, -1),
      { ...last, count: last.count + 1, timestamp: Date.now() },
    ];
  } else {
    entries = [
      ...entries.slice(-(MAX_LOG_ENTRIES - 1)),
      {
        id: nextEntryId++,
        level,
        timestamp: Date.now(),
        message,
        count: 1,
      },
    ];
  }
  queueMicrotask(notifyListeners);
}

/**
 * Hooks `console.{log,info,warn,error}` and global uncaught error events once
 * so the Piloti Console window displays shell logs even without browser DevTools.
 */
export function installConsoleCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const levels: ConsoleLogLevel[] = ["log", "info", "warn", "error"];
  for (const level of levels) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      appendLog(level, args);
      original(...args);
    };
  }

  window.addEventListener("error", (event) => {
    appendLog("error", [
      event.error ?? event.message ?? "Uncaught runtime error",
    ]);
  });

  window.addEventListener("unhandledrejection", (event) => {
    appendLog("error", ["Unhandled rejection:", event.reason]);
  });
}

export function clearConsoleEntries(): void {
  entries = [];
  notifyListeners();
}

export function useConsoleEntries(): readonly ConsoleLogEntry[] {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => entries,
    () => entries
  );
}

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (...args: string[]) => (
  ...vals: unknown[]
) => Promise<unknown>;

/**
 * Evaluates a JavaScript / async REPL snippet against the provided scope object.
 */
export async function evaluateReplCode(
  source: string,
  scope: Record<string, unknown>
): Promise<unknown> {
  const trimmed = source.trim();
  if (!trimmed) return undefined;

  const keys = Object.keys(scope);
  const values = keys.map((k) => scope[k]);

  let fn: ((...args: unknown[]) => Promise<unknown>) | null = null;
  try {
    fn = new AsyncFunction(...keys, `"use strict";\nreturn (${trimmed});`);
  } catch {
    fn = new AsyncFunction(...keys, `"use strict";\n${trimmed}`);
  }

  return fn(...values);
}

