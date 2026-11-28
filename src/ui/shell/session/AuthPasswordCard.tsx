import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeOffIcon } from "@/ui/components/ui/symbols";
import { Button } from "@/ui/components/ui/button";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";

export interface AuthPasswordCardProps {
  avatar: React.ReactNode;
  avatarClassName?: string;
  title: string;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  showPasswordInput?: boolean;
  error?: string | null;
  shakeTick?: number;
  onBack?: () => void;
  backLabel?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Shared frosted-glass authentication card used by both LoginScreenApp and LockScreen.
 */
export function AuthPasswordCard({
  avatar,
  avatarClassName = "from-sky-400 to-indigo-600",
  title,
  password,
  onPasswordChange,
  onSubmit,
  placeholder,
  submitLabel,
  disabled = false,
  loading = false,
  showPasswordInput = true,
  error,
  shakeTick = 0,
  onBack,
  backLabel,
  inputRef: externalInputRef,
  autoFocus = true,
  className,
}: AuthPasswordCardProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const internalInputRef = React.useRef<HTMLInputElement | null>(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const inputBusy = disabled || loading;

  // Root cause of the lost focus: the native `autoFocus` only runs on the very
  // first mount (before entry transitions settle), and a disabled input drops
  // focus without ever regaining it (loading / retry countdown / failed
  // attempt). Re-focus on mount, whenever the input becomes enabled again and
  // after a failed attempt (`error` / `shakeTick`).
  React.useEffect(() => {
    if (!autoFocus || !showPasswordInput || inputBusy) return;
    const focus = () => {
      const el = inputRef.current;
      if (el && !el.disabled && document.activeElement !== el) el.focus();
    };
    focus();
    const raf = requestAnimationFrame(focus);
    const timer = window.setTimeout(focus, 180);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [autoFocus, showPasswordInput, inputBusy, error, shakeTick, inputRef]);

  return (
    <div
      style={
        shakeTick > 0
          ? {
              animation:
                "piloti-gdm-shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97)",
            }
          : undefined
      }
      className={cn(
        "relative z-10 flex w-[320px] max-w-[calc(100vw-32px)] flex-col items-center gap-3.5 rounded-[22px] bg-white/10 p-6 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-xl",
        className,
      )}
    >
      {onBack && (
        <button
          type="button"
          disabled={disabled || loading}
          aria-label={backLabel ?? _("Switch User")}
          title={backLabel ?? _("Switch User")}
          onClick={onBack}
          className="absolute top-3.5 left-3.5 flex size-7 items-center justify-center rounded-full text-white/75 transition-colors hover-fill:bg-white/14 hover-fill:text-white disabled:opacity-40"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
      )}

      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full bg-gradient-to-br text-ui-title font-medium text-white shadow-md",
          avatarClassName,
        )}
      >
        {avatar}
      </div>

      <div className="max-w-full truncate text-ui-body font-medium">{title}</div>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-2.5">
        {showPasswordInput ? (
          <div className="relative flex w-full items-center">
            <input
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              autoFocus={autoFocus}
              onBlur={(e) => {
                // Keep focus while the card is shown unless the user moved to
                // another focusable element (e.g. the back button).
                if (!autoFocus || e.relatedTarget) return;
                const el = e.currentTarget;
                window.setTimeout(() => {
                  if (
                    el.isConnected &&
                    !el.disabled &&
                    (document.activeElement === document.body ||
                      document.activeElement === null)
                  ) {
                    el.focus();
                  }
                }, 0);
              }}
              disabled={disabled || loading}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={placeholder ?? _("Password")}
              aria-label={_("Password")}
              className={cn(
                "h-9 w-full rounded-[10px] border bg-black/30 pr-16 pl-3 text-ui-body text-white placeholder:text-white/45 focus:outline-none disabled:opacity-60",
                error
                  ? "border-rose-400/80 ring-1 ring-rose-400/40"
                  : "border-white/20 focus:border-white/45",
              )}
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              <button
                type="button"
                tabIndex={-1}
                aria-label={
                  showPassword ? _("Hide password") : _("Show password")
                }
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowPassword((v) => !v);
                  inputRef.current?.focus();
                }}
                className="flex size-6 items-center justify-center rounded-ui-control text-white/70 transition-colors hover-fill:bg-white/14 hover-fill:text-white"
              >
                {showPassword ? (
                  <EyeOffIcon className="size-3.5" />
                ) : (
                  <EyeIcon className="size-3.5" />
                )}
              </button>
              <button
                type="submit"
                disabled={disabled || loading}
                aria-label={submitLabel ?? _("Sign In")}
                className="flex size-6 items-center justify-center rounded-ui-control bg-ui-accent text-white transition-all hover-fill:brightness-110 active:scale-95 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRightIcon className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <Button type="submit" disabled={disabled || loading} className="w-full">
            {submitLabel ?? _("Unlock")}
          </Button>
        )}

        {error && (
          <div
            role="alert"
            className="w-full rounded-ui-control bg-rose-500/20 px-2.5 py-1.5 text-center text-ui-small text-rose-200 ring-1 ring-rose-400/30"
          >
            {error}
          </div>
        )}
      </form>
    </div>
  );
}

