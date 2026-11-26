import { useAppChrome } from "@/components/elements/app-chrome";
import * as React from "react";
import { emitShellEvent, onShellEvent } from "@/lib/shell/shell-events";
import { ChevronDownIcon, XIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useWindowActions,
  useChromeSettings,
} from "@/context/DesktopStateContext";
import { isCloseOnLeft } from "@/components/ui/window";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { publishWindowMenuState } from "@/lib/engine/app-bridge";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";
import { defineSettings } from "@/lib/engine/settings";
import { useSetting } from "@/hooks/use-setting";

type Operator = "+" | "-" | "*" | "/";

const OP_SYMBOL: Record<Operator, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

function formatDisplayNumber(raw: string): string {
  if (raw === "Error" || raw === "Infinity" || raw === "-Infinity" || raw === "NaN") {
    return "Error";
  }
  if (raw.includes("e") || raw.includes("E")) return raw;
  const neg = raw.startsWith("-");
  const unsigned = neg ? raw.slice(1) : raw;
  const [intPart = "0", decPart] = unsigned.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const withSign = neg ? `-${formattedInt}` : formattedInt;
  return decPart !== undefined ? `${withSign}.${decPart}` : withSign;
}

function evaluateBinary(a: number, op: Operator, b: number): string {
  let res: number;
  if (op === "+") res = a + b;
  else if (op === "-") res = a - b;
  else if (op === "*") res = a * b;
  else {
    if (b === 0) return "Error";
    res = a / b;
  }
  if (!Number.isFinite(res)) return "Error";
  return Number(res.toPrecision(12)).toString();
}

export interface CalculatorAppProps {
  windowId?: string;
  onCloseWindow?: () => void;
}

const CALCULATOR_STATE_KEY = "piloti.calculator.state.v1";

/** Preferences; the display and pending operation are state (`calculator.json`). */
const calculatorSettings = defineSettings("org.piloti.calculator", {
  scientific: false,
});

interface SavedCalculatorState {
  display?: string;
  storedValue?: number | null;
  pendingOp?: Operator | null;
  waitingForOperand?: boolean;
  expressionLine?: string;
  /** Moved to `calculatorSettings`; read once to carry it over. */
  scientific?: boolean;
}

function loadSavedCalculatorState(): SavedCalculatorState {
  try {
    const parsed = readVfsStateJson<SavedCalculatorState>(
      VFS_STATE_PATHS.calculator,
      CALCULATOR_STATE_KEY,
    );
    if (!parsed || typeof parsed !== "object") return {};
    if (typeof parsed.scientific === "boolean") {
      calculatorSettings.set("scientific", parsed.scientific);
    }
    return parsed;
  } catch {
    return {};
  }
}

export const CalculatorApp: React.FC<CalculatorAppProps> = ({
  windowId = "",
  onCloseWindow,
}) => {
  const isCsd = useAppChrome().decorations === "client";
  const { updateWindowGeometry } = useWindowActions();

  const initialStateRef = React.useRef<SavedCalculatorState | null>(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = loadSavedCalculatorState();
  }
  const initialSaved = initialStateRef.current;

  const [display, setDisplay] = React.useState(
    typeof initialSaved.display === "string" ? initialSaved.display : "0"
  );
  const [storedValue, setStoredValue] = React.useState<number | null>(
    typeof initialSaved.storedValue === "number" ? initialSaved.storedValue : null
  );
  const [pendingOp, setPendingOp] = React.useState<Operator | null>(
    initialSaved.pendingOp === "+" ||
      initialSaved.pendingOp === "-" ||
      initialSaved.pendingOp === "*" ||
      initialSaved.pendingOp === "/"
      ? initialSaved.pendingOp
      : null
  );
  const [waitingForOperand, setWaitingForOperand] = React.useState(
    Boolean(initialSaved.waitingForOperand)
  );
  const [expressionLine, setExpressionLine] = React.useState(
    typeof initialSaved.expressionLine === "string"
      ? initialSaved.expressionLine
      : ""
  );
  const [scientific, setScientific] = useSetting(calculatorSettings, "scientific");
  // `#scientific` / `#basic` in the URL pick the mode when the window opens.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#scientific") setScientific(true);
    else if (window.location.hash === "#basic") setScientific(false);
  }, [setScientific]);
  const [copied, setCopied] = React.useState(false);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const topBarRef = React.useRef<HTMLDivElement | null>(null);
  const keypadContentRef = React.useRef<HTMLDivElement | null>(null);
  const lastMeasuredSizeRef = React.useRef<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    try {
      writeVfsStateJson(VFS_STATE_PATHS.calculator, {
        display,
        storedValue,
        pendingOp,
        waitingForOperand,
        expressionLine,
      } satisfies SavedCalculatorState);
    } catch {
      // ignore storage errors
    }
  }, [display, expressionLine, pendingOp, storedValue, waitingForOperand]);

  const syncWindowToDom = React.useCallback(() => {
    if (!windowId) return;
    const headerEl = headerRef.current;
    const keypadEl = keypadContentRef.current;
    if (!headerEl || !keypadEl) return;

    const winEl = headerEl.closest<HTMLElement>('[data-slot="window"]');
    const ssdTitlebar = !isCsd
      ? winEl?.querySelector<HTMLElement>('[data-slot="window-titlebar"]')
      : null;
    const chromeHeight = ssdTitlebar ? ssdTitlebar.offsetHeight : 0;

    const headerHeight = headerEl.offsetHeight;
    const idealKeypadWidth = scientific ? 92 + 6 + 184 : 184;
    const idealKeypadHeight = 5 * 34 + 4 * 4;
    // The top bar stretches to the window (min-w-full), so measure what it
    // holds, not its width: otherwise the window never shrinks back to basic.
    const topBar = topBarRef.current;
    const topBarItems = topBar ? Array.from(topBar.children) as HTMLElement[] : [];
    const topBarMinW = topBar
      ? topBarItems.reduce((sum, el) => sum + el.offsetWidth, 0) +
        8 * Math.max(0, topBarItems.length - 1) +
        20
      : 0;
    const nextWidth = Math.max(topBarMinW, idealKeypadWidth + 12);
    const nextHeight = chromeHeight + headerHeight + idealKeypadHeight + 12;
    if (nextWidth <= 0 || nextHeight <= 0) return;

    const last = lastMeasuredSizeRef.current;
    if (last && last.width === nextWidth && last.height === nextHeight) {
      return;
    }
    lastMeasuredSizeRef.current = { width: nextWidth, height: nextHeight };
    updateWindowGeometry(windowId, {
      size: { width: nextWidth, height: nextHeight },
    });
  }, [isCsd, scientific, updateWindowGeometry, windowId]);

  React.useLayoutEffect(() => {
    syncWindowToDom();
    const raf = requestAnimationFrame(syncWindowToDom);
    return () => cancelAnimationFrame(raf);
  }, [isCsd, scientific, syncWindowToDom]);

  const setMode = React.useCallback((nextScientific: boolean) => {
    if (typeof window !== "undefined") {
      const nextHash = nextScientific ? "#scientific" : "#basic";
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
      }
    }
    setScientific(nextScientific);
  }, [setScientific]);

  React.useEffect(() => {
    if (!windowId) return;
    publishWindowMenuState(windowId, {
      "calculator:basic": { checked: !scientific },
      "calculator:scientific": { checked: scientific },
    });
  }, [scientific, windowId]);

  React.useEffect(() => {
    if (!windowId) return;
    const onAppAction = (e: Event) => {
      const detail = (
        e as CustomEvent<{ windowId?: string; actionId?: string }>
      ).detail;
      if (!detail?.actionId) return;
      if (detail.windowId && detail.windowId !== windowId) return;
      if (detail.actionId === "calculator:basic") {
        setMode(false);
      } else if (detail.actionId === "calculator:scientific") {
        setMode(true);
      }
    };
    window.addEventListener("piloti:app-action", onAppAction);
    return () => window.removeEventListener("piloti:app-action", onAppAction);
  }, [setMode, windowId]);

  React.useEffect(() => {
    const onHashChange = () => {
      const next = window.location.hash === "#scientific";
      setScientific(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [setScientific]);

  const closeOnLeft = isCloseOnLeft(useChromeSettings().settings.windowButtonLayout);

  const handleClose = () => {
    if (onCloseWindow) {
      onCloseWindow();
    } else if (windowId) {
      emitShellEvent("piloti:request-animated-close", { windowId: windowId });
    }
  };

  const inputDigit = React.useCallback(
    (digit: string) => {
      if (display === "Error") {
        setDisplay(digit);
        setWaitingForOperand(false);
        return;
      }
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
        return;
      }
      const plain = display.replace(/^-/, "").replace(".", "");
      if (plain.length >= 12) return;
      setDisplay(display === "0" ? digit : display + digit);
    },
    [display, waitingForOperand],
  );

  const inputDecimal = React.useCallback(() => {
    if (display === "Error" || waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(`${display}.`);
    }
  }, [display, waitingForOperand]);

  const clearAll = React.useCallback(() => {
    if (display !== "0" && !waitingForOperand) {
      setDisplay("0");
      return;
    }
    setDisplay("0");
    setStoredValue(null);
    setPendingOp(null);
    setWaitingForOperand(false);
    setExpressionLine("");
  }, [display, waitingForOperand]);

  const toggleSign = React.useCallback(() => {
    if (display === "0" || display === "Error") return;
    setDisplay(display.startsWith("-") ? display.slice(1) : `-${display}`);
  }, [display]);

  const inputPercent = React.useCallback(() => {
    const val = Number.parseFloat(display);
    if (!Number.isFinite(val)) return;
    setDisplay(Number((val / 100).toPrecision(12)).toString());
  }, [display]);

  const performOperation = React.useCallback(
    (nextOp: Operator) => {
      const inputValue = Number.parseFloat(display);
      if (!Number.isFinite(inputValue)) return;

      if (storedValue === null) {
        setStoredValue(inputValue);
        setExpressionLine(`${formatDisplayNumber(display)} ${OP_SYMBOL[nextOp]}`);
      } else if (pendingOp && !waitingForOperand) {
        const nextStr = evaluateBinary(storedValue, pendingOp, inputValue);
        setDisplay(nextStr);
        const parsed = Number.parseFloat(nextStr);
        setStoredValue(Number.isFinite(parsed) ? parsed : null);
        setExpressionLine(`${formatDisplayNumber(nextStr)} ${OP_SYMBOL[nextOp]}`);
      } else {
        setExpressionLine(
          `${formatDisplayNumber(String(storedValue))} ${OP_SYMBOL[nextOp]}`,
        );
      }

      setWaitingForOperand(true);
      setPendingOp(nextOp);
    },
    [display, pendingOp, storedValue, waitingForOperand],
  );

  const performEquals = React.useCallback(() => {
    if (pendingOp === null || storedValue === null) return;
    const inputValue = Number.parseFloat(display);
    if (!Number.isFinite(inputValue)) return;
    const nextStr = evaluateBinary(storedValue, pendingOp, inputValue);
    setExpressionLine(
      `${formatDisplayNumber(String(storedValue))} ${OP_SYMBOL[pendingOp]} ${formatDisplayNumber(display)} =`,
    );
    setDisplay(nextStr);
    setStoredValue(null);
    setPendingOp(null);
    setWaitingForOperand(true);
  }, [display, pendingOp, storedValue]);

  const applyUnary = React.useCallback(
    (label: string, fn: (x: number) => number) => {
      const val = Number.parseFloat(display);
      if (!Number.isFinite(val)) return;
      const out = fn(val);
      const nextStr = Number.isFinite(out)
        ? Number(out.toPrecision(12)).toString()
        : "Error";
      setExpressionLine(`${label}(${formatDisplayNumber(display)})`);
      setDisplay(nextStr);
      setWaitingForOperand(true);
    },
    [display],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
          void navigator.clipboard?.writeText(display);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 900);
        }
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        inputDigit(e.key);
      } else if (e.key === "." || e.key === ",") {
        e.preventDefault();
        inputDecimal();
      } else if (e.key === "+" || e.key === "-" || e.key === "*" || e.key === "/") {
        e.preventDefault();
        performOperation(e.key as Operator);
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        performEquals();
      } else if (e.key === "Escape" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        clearAll();
      } else if (e.key === "%") {
        e.preventDefault();
        inputPercent();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (waitingForOperand || display === "Error") {
          setDisplay("0");
          return;
        }
        const next = display.slice(0, -1);
        setDisplay(!next || next === "-" ? "0" : next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearAll,
    display,
    inputDecimal,
    inputDigit,
    inputPercent,
    performEquals,
    performOperation,
    waitingForOperand,
  ]);

  const formatted = formatDisplayNumber(display);
  const clearLabel =
    display !== "0" || storedValue !== null || pendingOp !== null ? "C" : "AC";

  const closeButton = isCsd && (
      <button
        type="button"
        data-window-no-drag
        aria-label={_("Close window")}
        onClick={handleClose}
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-black/8 text-ui-label-secondary transition-colors outline-none hover-fill:bg-black/15 hover-fill:text-ui-label active:bg-black/22 dark:bg-white/10 dark:hover-fill:bg-white/18 dark:hover-fill:text-ui-label dark:active:bg-white/24"
      >
        <XIcon className="size-3" strokeWidth={2.5} />
      </button>
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-transparent text-ui-label select-none">
      {/* Combined Vibrant Headerbar + Result Display */}
      <div
        ref={headerRef}
        data-window-drag-region={isCsd ? "" : undefined}
        className="bg-ui-sidebar ui-material-sidebar flex shrink-0 flex-col justify-between border-b border-ui-separator/60 px-2.5 pt-2 pb-2"
      >
        <div
          ref={topBarRef}
          className="flex h-5 w-max min-w-full items-center justify-between gap-2"
        >
          <div className="flex shrink-0 items-center gap-1.5">
          {closeOnLeft && closeButton}
          <button
            type="button"
            data-window-no-drag
            aria-pressed={scientific}
            aria-label={_("Scientific")}
            onClick={() => setMode(!scientific)}
            className={cn(
              "inline-flex h-5 shrink-0 cursor-default items-center justify-center rounded-full px-2 text-ui-subheadline font-medium leading-none transition-colors outline-none select-none",
              scientific
                ? "bg-ui-accent text-white hover-fill:brightness-110 active:brightness-95"
                : "bg-black/8 text-ui-label-secondary hover-fill:bg-black/15 hover-fill:text-ui-label active:bg-black/22 dark:bg-white/10 dark:hover-fill:bg-white/18 dark:hover-fill:text-ui-label dark:active:bg-white/24",
            )}
          >
            {_("Scientific")}
          </button>
          {/* Same size as the mode toggle; shown briefly after a copy. */}
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-black/8 px-2 text-ui-subheadline font-medium leading-none text-ui-label-secondary transition-opacity duration-200 select-none dark:bg-white/10",
              copied ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {_("Copied")}
          </span>
          </div>
          {!closeOnLeft && closeButton}
        </div>

        <div
          onClick={() => {
            void navigator.clipboard?.writeText(display);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
          }}
          className="mt-1 flex cursor-default flex-col items-end justify-end"
        >
          <div className="flex h-3.5 w-full items-center justify-end text-ui-footnote text-ui-dim tabular-nums">
            <span className="truncate">{expressionLine}</span>
          </div>
          <div className="flex h-[36px] w-full items-end justify-end">
            <div
              className={cn(
                "w-full truncate text-right font-extralight tracking-tight tabular-nums",
                formatted.length > 11
                  ? "text-[20px] leading-[1.15]"
                  : formatted.length > 8
                    ? "text-ui-large-title leading-[1.1]"
                    : "text-[34px] leading-[1.05]",
              )}
            >
              {formatted}
            </div>
          </div>
        </div>
      </div>

      {/* Keypad */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-ui-window p-1.5">
        <div ref={keypadContentRef} className="flex h-full w-full items-stretch gap-1.5">
        {scientific && (
          <div className="grid h-full min-w-[92px] flex-[2] grid-cols-2 grid-rows-5 gap-1">
            <button
              type="button"
              onClick={() => applyUnary("sq", (x) => x * x)}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              x²
            </button>
            <button
              type="button"
              onClick={() => applyUnary("sqrt", (x) => Math.sqrt(x))}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              √x
            </button>
            <button
              type="button"
              onClick={() => applyUnary("sin", (x) => Math.sin(x))}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              sin
            </button>
            <button
              type="button"
              onClick={() => applyUnary("cos", (x) => Math.cos(x))}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              cos
            </button>
            <button
              type="button"
              onClick={() => applyUnary("tan", (x) => Math.tan(x))}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              tan
            </button>
            <button
              type="button"
              onClick={() => applyUnary("ln", (x) => Math.log(x))}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              ln
            </button>
            <button
              type="button"
              onClick={() => applyUnary("log", (x) => Math.log10(x))}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              log
            </button>
            <button
              type="button"
              onClick={() => applyUnary("inv", (x) => 1 / x)}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              1/x
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplay(Number(Math.PI.toPrecision(12)).toString());
                setWaitingForOperand(false);
              }}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              π
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplay(Number(Math.E.toPrecision(12)).toString());
                setWaitingForOperand(false);
              }}
              className="rounded-ui-item bg-black/14 text-ui-subheadline font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
            >
              e
            </button>
          </div>
        )}

        <div className="grid h-full min-w-0 flex-[4] grid-cols-4 grid-rows-5 gap-1">
          {/* Row 1 */}
          <button
            type="button"
            onClick={clearAll}
            className="rounded-ui-item bg-black/14 text-ui-body font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={toggleSign}
            className="rounded-ui-item bg-black/14 text-ui-body font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
          >
            +/−
          </button>
          <button
            type="button"
            onClick={inputPercent}
            className="rounded-ui-item bg-black/14 text-ui-body font-medium text-ui-label outline-none hover-fill:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover-fill:bg-white/18 dark:active:bg-white/24"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => performOperation("/")}
            className="rounded-ui-item bg-ui-accent text-[16px] font-medium text-white outline-none hover-fill:brightness-110 focus:outline-none active:brightness-90"
          >
            ÷
          </button>

          {/* Row 2 */}
          {["7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="rounded-ui-item bg-black/7 text-ui-title-3 font-medium text-ui-label outline-none hover-fill:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover-fill:bg-white/30 dark:active:bg-white/36"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("*")}
            className="rounded-ui-item bg-ui-accent text-[16px] font-medium text-white outline-none hover-fill:brightness-110 focus:outline-none active:brightness-90"
          >
            ×
          </button>

          {/* Row 3 */}
          {["4", "5", "6"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="rounded-ui-item bg-black/7 text-ui-title-3 font-medium text-ui-label outline-none hover-fill:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover-fill:bg-white/30 dark:active:bg-white/36"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("-")}
            className="rounded-ui-item bg-ui-accent text-[16px] font-medium text-white outline-none hover-fill:brightness-110 focus:outline-none active:brightness-90"
          >
            −
          </button>

          {/* Row 4 */}
          {["1", "2", "3"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="rounded-ui-item bg-black/7 text-ui-title-3 font-medium text-ui-label outline-none hover-fill:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover-fill:bg-white/30 dark:active:bg-white/36"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("+")}
            className="rounded-ui-item bg-ui-accent text-[16px] font-medium text-white outline-none hover-fill:brightness-110 focus:outline-none active:brightness-90"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => inputDigit("0")}
            className="col-span-2 flex items-center justify-center rounded-ui-item bg-black/7 text-ui-title-3 font-medium text-ui-label outline-none hover-fill:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover-fill:bg-white/30 dark:active:bg-white/36"
          >
            0
          </button>
          <button
            type="button"
            onClick={inputDecimal}
            className="rounded-ui-item bg-black/7 text-ui-title-3 font-medium text-ui-label outline-none hover-fill:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover-fill:bg-white/30 dark:active:bg-white/36"
          >
            .
          </button>
          <button
            type="button"
            onClick={performEquals}
            className="rounded-ui-item bg-ui-accent text-[16px] font-medium text-white outline-none hover-fill:brightness-110 focus:outline-none active:brightness-90"
          >
            =
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

