import * as React from "react";
import { ChevronDownIcon, XIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsolatedAppBridge } from "@/lib/app-bridge";
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

export const CalculatorApp: React.FC<CalculatorAppProps> = ({
  windowId: propWindowId = "",
  isCsd: propIsCsd = true,
  onCloseWindow,
}) => {
  const bridge = useIsolatedAppBridge(propWindowId, propIsCsd);
  const isCsd = bridge.isCsd ?? propIsCsd;

  const [display, setDisplay] = React.useState("0");
  const [storedValue, setStoredValue] = React.useState<number | null>(null);
  const [pendingOp, setPendingOp] = React.useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = React.useState(false);
  const [expressionLine, setExpressionLine] = React.useState("");
  const [scientific, setScientific] = React.useState(() =>
    typeof window !== "undefined" && window.location.hash === "#scientific",
  );
  const [copied, setCopied] = React.useState(false);

  const setMode = React.useCallback(
    (nextScientific: boolean) => {
      setScientific(nextScientific);
      if (typeof window !== "undefined") {
        const nextHash = nextScientific ? "#scientific" : "#basic";
        if (window.location.hash !== nextHash) {
          window.history.replaceState(null, "", nextHash);
        }
      }
      bridge.resizeWindow(nextScientific ? 388 : 260, 380);
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
    <div
      style={{ "--adw-accent": "#ff9f0a" } as React.CSSProperties}
      className="flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label select-none"
    >
      {/* Top Drag Header + Mode Toggle + Window Close on Right */}
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        className="flex h-8 shrink-0 items-center justify-end gap-1.5 px-2.5 pt-1"
      >
        <button
          type="button"
          data-window-no-drag
          onClick={() => setMode(!scientific)}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
            scientific
              ? "border-[#ff9f0a] bg-[#ff9f0a] text-white"
              : "border-adw-border bg-adw-fill-secondary text-adw-label hover:bg-adw-fill-primary",
          )}
        >
          {scientific ? "Scientific" : "Basic"}
        </button>
        {isCsd && (
          <button
            type="button"
            data-window-no-drag
            aria-label="Close window"
            onClick={handleClose}
            className="flex size-5 items-center justify-center rounded-full bg-adw-fill-secondary text-adw-label-secondary transition-colors hover:bg-adw-fill-primary hover:text-adw-label"
          >
            <XIcon className="size-3" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Display Screen */}
      <div
        onClick={() => {
          void navigator.clipboard?.writeText(display);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 900);
        }}
        title="Click to copy"
        className="mx-2.5 mb-1.5 flex shrink-0 cursor-default flex-col items-end justify-end rounded-lg border border-adw-border bg-adw-content px-2.5 py-1.5"
      >
        <div className="flex h-3.5 w-full items-center justify-between text-[10.5px] text-adw-dim tabular-nums">
          <span>{copied ? "Copied" : ""}</span>
          <span className="truncate">{expressionLine}</span>
        </div>
        <div
          className={cn(
            "w-full truncate text-right font-light tracking-tight tabular-nums",
            formatted.length > 11
              ? "text-[18px]"
              : formatted.length > 8
                ? "text-[22px]"
                : "text-[28px] leading-[1.1]",
          )}
        >
          {formatted}
        </div>
      </div>

      {/* Keypad */}
      <div className="flex min-h-0 flex-1 gap-1 p-2.5 pt-0">
        {scientific && (
          <div className="grid w-24 shrink-0 grid-cols-2 grid-rows-5 gap-1">
            <button
              type="button"
              onClick={() => applyUnary("sq", (x) => x * x)}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              x²
            </button>
            <button
              type="button"
              onClick={() => applyUnary("sqrt", (x) => Math.sqrt(x))}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              √x
            </button>
            <button
              type="button"
              onClick={() => applyUnary("sin", (x) => Math.sin(x))}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              sin
            </button>
            <button
              type="button"
              onClick={() => applyUnary("cos", (x) => Math.cos(x))}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              cos
            </button>
            <button
              type="button"
              onClick={() => applyUnary("tan", (x) => Math.tan(x))}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              tan
            </button>
            <button
              type="button"
              onClick={() => applyUnary("ln", (x) => Math.log(x))}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              ln
            </button>
            <button
              type="button"
              onClick={() => applyUnary("log", (x) => Math.log10(x))}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              log
            </button>
            <button
              type="button"
              onClick={() => applyUnary("inv", (x) => 1 / x)}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              1/x
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplay(Number(Math.PI.toPrecision(12)).toString());
                setWaitingForOperand(false);
              }}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              π
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplay(Number(Math.E.toPrecision(12)).toString());
                setWaitingForOperand(false);
              }}
              className="rounded-md border border-adw-border/70 bg-adw-fill-tertiary text-[11.5px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              e
            </button>
          </div>
        )}

        <div className="grid flex-1 grid-cols-4 grid-rows-5 gap-1">
          {/* Row 1 */}
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-adw-border/70 bg-adw-fill-secondary text-[13px] font-medium text-adw-label transition-colors hover:bg-adw-fill-primary active:opacity-80"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={toggleSign}
            className="rounded-md border border-adw-border/70 bg-adw-fill-secondary text-[13px] font-medium text-adw-label transition-colors hover:bg-adw-fill-primary active:opacity-80"
          >
            +/−
          </button>
          <button
            type="button"
            onClick={inputPercent}
            className="rounded-md border border-adw-border/70 bg-adw-fill-secondary text-[13px] font-medium text-adw-label transition-colors hover:bg-adw-fill-primary active:opacity-80"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => performOperation("/")}
            className={cn(
              "rounded-md text-[16px] font-medium transition-colors",
              pendingOp === "/" && waitingForOperand
                ? "bg-white text-[#ff9f0a] ring-1 ring-[#ff9f0a]"
                : "bg-[#ff9f0a] text-white hover:bg-[#ffb340] active:bg-[#d98200]",
            )}
          >
            ÷
          </button>

          {/* Row 2 */}
          {["7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="rounded-md border border-adw-border/70 bg-adw-card text-[15px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("*")}
            className={cn(
              "rounded-md text-[16px] font-medium transition-colors",
              pendingOp === "*" && waitingForOperand
                ? "bg-white text-[#ff9f0a] ring-1 ring-[#ff9f0a]"
                : "bg-[#ff9f0a] text-white hover:bg-[#ffb340] active:bg-[#d98200]",
            )}
          >
            ×
          </button>

          {/* Row 3 */}
          {["4", "5", "6"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="rounded-md border border-adw-border/70 bg-adw-card text-[15px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("-")}
            className={cn(
              "rounded-md text-[16px] font-medium transition-colors",
              pendingOp === "-" && waitingForOperand
                ? "bg-white text-[#ff9f0a] ring-1 ring-[#ff9f0a]"
                : "bg-[#ff9f0a] text-white hover:bg-[#ffb340] active:bg-[#d98200]",
            )}
          >
            −
          </button>

          {/* Row 4 */}
          {["1", "2", "3"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              className="rounded-md border border-adw-border/70 bg-adw-card text-[15px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => performOperation("+")}
            className={cn(
              "rounded-md text-[16px] font-medium transition-colors",
              pendingOp === "+" && waitingForOperand
                ? "bg-white text-[#ff9f0a] ring-1 ring-[#ff9f0a]"
                : "bg-[#ff9f0a] text-white hover:bg-[#ffb340] active:bg-[#d98200]",
            )}
          >
            +
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => inputDigit("0")}
            className="col-span-2 flex items-center rounded-md border border-adw-border/70 bg-adw-card pl-4 text-left text-[15px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
          >
            0
          </button>
          <button
            type="button"
            onClick={inputDecimal}
            className="rounded-md border border-adw-border/70 bg-adw-card text-[15px] font-medium text-adw-label transition-colors hover:bg-adw-fill-secondary active:bg-adw-fill-primary"
          >
            .
          </button>
          <button
            type="button"
            onClick={performEquals}
            className="rounded-md bg-[#ff9f0a] text-[16px] font-medium text-white transition-colors hover:bg-[#ffb340] active:bg-[#d98200]"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
};

