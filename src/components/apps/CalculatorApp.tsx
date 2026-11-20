import * as React from "react";
import { ChevronDownIcon, PanelLeftIcon, XIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsolatedAppBridge } from "@/lib/app-bridge";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  isCsd?: boolean;
  onCloseWindow?: () => void;
}

const CALCULATOR_STATE_KEY = "piloti.calculator.state.v1";

interface SavedCalculatorState {
  display?: string;
  storedValue?: number | null;
  pendingOp?: Operator | null;
  waitingForOperand?: boolean;
  expressionLine?: string;
  scientific?: boolean;
}

function loadSavedCalculatorState(): SavedCalculatorState {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CALCULATOR_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedCalculatorState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const CalculatorApp: React.FC<CalculatorAppProps> = ({
  windowId: propWindowId = "",
  isCsd: propIsCsd = true,
  onCloseWindow,
}) => {
  const bridge = useIsolatedAppBridge(propWindowId, propIsCsd);
  const isCsd = bridge.isCsd ?? propIsCsd;

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
  const [scientific, setScientific] = React.useState(() => {
    if (typeof window !== "undefined" && window.location.hash === "#scientific") {
      return true;
    }
    if (typeof window !== "undefined" && window.location.hash === "#basic") {
      return false;
    }
    return Boolean(initialSaved.scientific);
  });
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        CALCULATOR_STATE_KEY,
        JSON.stringify({
          display,
          storedValue,
          pendingOp,
          waitingForOperand,
          expressionLine,
          scientific,
        } satisfies SavedCalculatorState)
      );
    } catch {
      // ignore storage errors
    }
  }, [display, expressionLine, pendingOp, scientific, storedValue, waitingForOperand]);

  React.useEffect(() => {
    if (initialSaved.scientific) {
      bridge.resizeWindow(316, 292);
    }
    // only resize on mount if restored in scientific mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = React.useCallback(
    (nextScientific: boolean) => {
      setScientific(nextScientific);
      if (typeof window !== "undefined") {
        const nextHash = nextScientific ? "#scientific" : "#basic";
        if (window.location.hash !== nextHash) {
          window.history.replaceState(null, "", nextHash);
        }
      }
      bridge.resizeWindow(nextScientific ? 316 : 196, 292);
    },
    [bridge],
  );

  React.useEffect(() => {
    const onHashChange = () => {
      const next = window.location.hash === "#scientific";
      setScientific(next);
      bridge.resizeWindow(next ? 388 : 260, 380);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [bridge]);

  const handleClose = () => {
    if (onCloseWindow) {
      onCloseWindow();
    } else {
      bridge.closeWindow();
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label select-none">
      {/* Combined Vibrant Headerbar + Result Display */}
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        className="adw-material-sidebar flex shrink-0 flex-col justify-between border-b border-black/25 px-2.5 pt-1.5 pb-2 dark:border-black/50"
      >
        <div className="flex h-6 items-center justify-between">
          <button
            type="button"
            data-window-no-drag
            title={scientific ? _("Basic Mode") : _("Scientific Mode")}
            aria-label={scientific ? _("Basic Mode") : _("Scientific Mode")}
            onClick={() => setMode(!scientific)}
            className={cn(
              "flex size-6 items-center justify-center rounded-md transition-colors",
              scientific
                ? "bg-black/12 text-adw-label dark:bg-white/16"
                : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/12",
            )}
          >
            <PanelLeftIcon className="size-3.5" />
          </button>
          {isCsd && (
            <button
              type="button"
              data-window-no-drag
              aria-label={_("Close window")}
              onClick={handleClose}
              className="flex size-5 items-center justify-center rounded-full bg-black/10 text-adw-label-secondary transition-colors hover:bg-black/18 hover:text-adw-label dark:bg-white/12 dark:hover:bg-white/22"
            >
              <XIcon className="size-3" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div
          data-window-no-drag
          onClick={() => {
            void navigator.clipboard?.writeText(display);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
          }}
          title={_("Click to copy")}
          className="mt-1 flex cursor-default flex-col items-end justify-end"
        >
          <div className="flex h-3.5 w-full items-center justify-between text-[10px] text-adw-dim tabular-nums">
            <span>{copied ? _("Copied") : ""}</span>
            <span className="truncate">{expressionLine}</span>
          </div>
          <div
            className={cn(
              "w-full truncate text-right font-extralight tracking-tight tabular-nums",
              formatted.length > 11
                ? "text-[20px] leading-[1.15]"
                : formatted.length > 8
                  ? "text-[26px] leading-[1.1]"
                  : "text-[34px] leading-[1.05]",
            )}
          >
            {formatted}
          </div>
        </div>
      </div>

      {/* Keypad */}
      <div className="flex min-h-0 flex-1 gap-[1px] bg-black/25 dark:bg-black/45">
        {scientific && (
          <div className="grid w-[98px] shrink-0 grid-cols-2 grid-rows-5 gap-[1px]">
            <button
              type="button"
              onClick={() => applyUnary("sq", (x) => x * x)}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              x²
            </button>
            <button
              type="button"
              onClick={() => applyUnary("sqrt", (x) => Math.sqrt(x))}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              √x
            </button>
            <button
              type="button"
              onClick={() => applyUnary("sin", (x) => Math.sin(x))}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              sin
            </button>
            <button
              type="button"
              onClick={() => applyUnary("cos", (x) => Math.cos(x))}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              cos
            </button>
            <button
              type="button"
              onClick={() => applyUnary("tan", (x) => Math.tan(x))}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              tan
            </button>
            <button
              type="button"
              onClick={() => applyUnary("ln", (x) => Math.log(x))}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              ln
            </button>
            <button
              type="button"
              onClick={() => applyUnary("log", (x) => Math.log10(x))}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              log
            </button>
            <button
              type="button"
              onClick={() => applyUnary("inv", (x) => 1 / x)}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              1/x
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplay(Number(Math.PI.toPrecision(12)).toString());
                setWaitingForOperand(false);
              }}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              π
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplay(Number(Math.E.toPrecision(12)).toString());
                setWaitingForOperand(false);
              }}
              className="bg-black/14 text-[11.5px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
            >
              e
            </button>
          </div>
        )}

        <div className="grid flex-1 grid-cols-4 grid-rows-5 gap-[1px]">
          {/* Row 1 */}
          <button
            type="button"
            onClick={clearAll}
            className="bg-black/14 text-[13px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={toggleSign}
            className="bg-black/14 text-[13px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
          >
            +/−
          </button>
          <button
            type="button"
            onClick={inputPercent}
            className="bg-black/14 text-[13px] font-medium text-adw-label outline-none hover:bg-black/20 focus:outline-none active:bg-black/26 dark:bg-white/12 dark:hover:bg-white/18 dark:active:bg-white/24"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => performOperation("/")}
            className="bg-adw-accent text-[16px] font-medium text-white outline-none hover:brightness-110 focus:outline-none active:brightness-90"
          >
            ÷
          </button>

          {/* Row 2 */}
          {["7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="bg-black/7 text-[15px] font-medium text-adw-label outline-none hover:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover:bg-white/30 dark:active:bg-white/36"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("*")}
            className="bg-adw-accent text-[16px] font-medium text-white outline-none hover:brightness-110 focus:outline-none active:brightness-90"
          >
            ×
          </button>

          {/* Row 3 */}
          {["4", "5", "6"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="bg-black/7 text-[15px] font-medium text-adw-label outline-none hover:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover:bg-white/30 dark:active:bg-white/36"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("-")}
            className="bg-adw-accent text-[16px] font-medium text-white outline-none hover:brightness-110 focus:outline-none active:brightness-90"
          >
            −
          </button>

          {/* Row 4 */}
          {["1", "2", "3"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="bg-black/7 text-[15px] font-medium text-adw-label outline-none hover:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover:bg-white/30 dark:active:bg-white/36"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("+")}
            className="bg-adw-accent text-[16px] font-medium text-white outline-none hover:brightness-110 focus:outline-none active:brightness-90"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => inputDigit("0")}
            className="col-span-2 flex items-center justify-center bg-black/7 text-[15px] font-medium text-adw-label outline-none hover:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover:bg-white/30 dark:active:bg-white/36"
          >
            0
          </button>
          <button
            type="button"
            onClick={inputDecimal}
            className="bg-black/7 text-[15px] font-medium text-adw-label outline-none hover:bg-black/13 focus:outline-none active:bg-black/20 dark:bg-white/24 dark:hover:bg-white/30 dark:active:bg-white/36"
          >
            .
          </button>
          <button
            type="button"
            onClick={performEquals}
            className="bg-adw-accent text-[16px] font-medium text-white outline-none hover:brightness-110 focus:outline-none active:brightness-90"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
};

