import * as React from "react";
import { consumeLegacyLocalStorageValue, getVfsEntry, writeVfsTextFile } from "@/lib/engine-web/web-vfs";
import { VFS_STATE_PATHS } from "@/lib/engine/vfs-state";

export type ConsoleLogLevel = "log" | "info" | "warn" | "error";

export interface ConsoleDiskSink {
  files: {
    write: (path: string, content: string) => Promise<unknown>;
  };
  processes: {
    run: (argv: string[]) => Promise<unknown>;
  };
}

export interface ConsoleLogEntry {
  id: number;
  level: ConsoleLogLevel;
  timestamp: number;
  message: string;
  count: number;
}

const MAX_LOG_ENTRIES = 2000;
const CONSOLE_LOG_FILE = ".cache/piloti/piloti.log";
const CONSOLE_LOG_STORAGE_KEY = "piloti.console.log.v1";
let nextEntryId = 1;
let installed = false;
let entries: ConsoleLogEntry[] = [];
const listeners = new Set<() => void>();
let diskSink: ConsoleDiskSink | null = null;
let diskSinkIsBrowser = true;
let diskFlushTimer: ReturnType<typeof setTimeout> | null = null;
let ensuredCacheDir = false;

async function flushConsoleLogToDisk(): Promise<void> {
  if (entries.length === 0) return;
  const payload =
    entries
      .map((entry) => {
        const ts = new Date(entry.timestamp).toISOString();
        const repeat = entry.count > 1 ? ` (×${entry.count})` : "";
        return `[${ts}] [${entry.level.toUpperCase()}] ${entry.message}${repeat}`;
      })
      .join("\n") + "\n";

  try {
    consumeLegacyLocalStorageValue(CONSOLE_LOG_STORAGE_KEY);
    const existing = getVfsEntry(VFS_STATE_PATHS.consoleLog);
    if (!existing || existing.content !== payload) {
      writeVfsTextFile(VFS_STATE_PATHS.consoleLog, payload);
    }
  } catch {
    // ignore storage quota errors
  }

  const domicile = diskSink;
  if (!domicile || diskSinkIsBrowser) return;

  try {
    if (!ensuredCacheDir) {
      ensuredCacheDir = true;
      await domicile.processes.run(["mkdir", "-p", ".cache/piloti"]);
    }
    await domicile.files.write(CONSOLE_LOG_FILE, payload);
  } catch {
    // ignore if filesystem is locked or unavailable
  }
}

function scheduleConsoleDiskFlush(): void {
  if (diskFlushTimer !== null) {
    clearTimeout(diskFlushTimer);
  }
  diskFlushTimer = setTimeout(() => {
    diskFlushTimer = null;
    void flushConsoleLogToDisk();
  }, 350);
}

/**
 * Attaches a disk sink (`.cache/piloti/piloti.log` on Linux, `localStorage`
 * in browser dev mode) that persists every console message shown in DevTools.
 */
export function attachConsoleDiskSink(
  domicile: ConsoleDiskSink,
  isBrowserRuntime: boolean
): void {
  diskSink = domicile;
  diskSinkIsBrowser = isBrowserRuntime;
  scheduleConsoleDiskFlush();
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

const DATA_IMAGE_URI_PREFIX = /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i;

/**
 * Abbreviates long `data:image/...` URIs so console/log output stays readable.
 */
export function abbreviateDataImageUri(value: string, maxLength = 96): string {
  const trimmed = value.trim();
  if (!DATA_IMAGE_URI_PREFIX.test(trimmed) || trimmed.length <= maxLength) {
    return value;
  }
  return `${trimmed.slice(0, 48)}… (${trimmed.length} chars)`;
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
    if (depth === 0) {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          return JSON.stringify(
            parsed,
            (_k, v) =>
              typeof v === "string" ? abbreviateDataImageUri(v) : v,
            2
          );
        } catch {
          // not valid JSON, keep as raw string
        }
      }
      return abbreviateDataImageUri(value);
    }
    return JSON.stringify(abbreviateDataImageUri(value));
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
      const indent = "  ".repeat(depth + 1);
      const closingIndent = "  ".repeat(depth);
      const items = value
        .slice(0, 50)
        .map((item) => `${indent}${formatInspectValue(item, depth + 1, seen)}`);
      if (value.length > 50) {
        items.push(`${indent}… +${value.length - 50} more`);
      }
      return `[\n${items.join(",\n")}\n${closingIndent}]`;
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
    const previewKeys = keys.slice(0, 50);
    const lines = previewKeys.map((k) => {
      const prop = (value as Record<string, unknown>)[k];
      const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${indent}${safeKey}: ${formatInspectValue(prop, depth + 1, seen)}`;
    });
    if (keys.length > 50) {
      lines.push(`${indent}… +${keys.length - 50} keys`);
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
  scheduleConsoleDiskFlush();
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

export function getConsoleEntries(): readonly ConsoleLogEntry[] {
  return entries;
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
  } catch (err) {
    if (err instanceof EvalError) {
      const { evaluateCspSafe } = await import("@/lib/shell/csp-repl-eval");
      return evaluateCspSafe(trimmed, scope);
    }
    try {
      fn = new AsyncFunction(...keys, `"use strict";\n${trimmed}`);
    } catch (innerErr) {
      if (innerErr instanceof EvalError) {
        const { evaluateCspSafe } = await import("@/lib/shell/csp-repl-eval");
        return evaluateCspSafe(trimmed, scope);
      }
      throw innerErr;
    }
  }

  return fn(...values);
}

