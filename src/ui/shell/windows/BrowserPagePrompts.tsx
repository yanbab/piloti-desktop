/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import { XIcon } from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { Button } from "@/ui/components/ui/button";
import { _ } from "@/core/util/i18n";

function siteName(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

const PERMISSION_LABELS: Record<string, () => string> = {
  camera: () => _("use your camera"),
  microphone: () => _("use your microphone"),
  location: () => _("know your location"),
  notifications: () => _("show notifications"),
  clipboard: () => _("see what you copy"),
  midi: () => _("use your MIDI devices"),
  "window-management": () => _("manage windows on your screens"),
  "local-fonts": () => _("use your fonts"),
  "idle-detection": () => _("know when you are away"),
  "automatic-downloads": () => _("download several files"),
};

/** "use your camera and microphone". */
export function describePermissions(permissions: readonly string[]): string {
  const asks = permissions.includes("camera") && permissions.includes("microphone")
    ? [_("use your camera and microphone"), ...permissions.filter((p) => p !== "camera" && p !== "microphone")]
    : [...permissions];
  return asks
    .map((p) => PERMISSION_LABELS[p]?.() ?? p)
    .join(", ");
}

function answer(fn: () => void) {
  try {
    fn();
  } catch {
    // Withdrawn by the page meanwhile.
  }
}

/**
 * A site asks for a permission: a bubble under the toolbar, as in Chrome.
 * Allow and Block are remembered for the site; closing it decides nothing.
 */
export function PermissionBubble({
  request,
  onDone,
}: {
  request: DomicilePermissionRequestEvent;
  onDone: () => void;
}) {
  const close = (fn: () => void) => {
    answer(fn);
    onDone();
  };
  return (
    <div
      role="dialog"
      aria-label={_("Permission Request")}
      data-slot="browser-permission-request"
      className="absolute top-2 left-2 z-30 w-80 max-w-[calc(100%-16px)] rounded-ui-box border border-ui-separator p-3 text-ui-label shadow-ui-menu ui-material-menu"
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-ui-body">
          {_("%s wants to %s", siteName(request.origin), describePermissions(request.permissions))}
        </p>
        <button
          type="button"
          aria-label={_("Close")}
          onClick={() => close(() => request.dismiss())}
          className="flex size-6 shrink-0 items-center justify-center rounded-ui-control text-ui-label-secondary hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
        >
          <SymbolicIcon name="window-close" fallback={XIcon} className="size-3.5" />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => close(() => request.deny())}>
          {_("Block")}
        </Button>
        <Button size="sm" onClick={() => close(() => request.allow())}>
          {_("Allow")}
        </Button>
      </div>
    </div>
  );
}

/**
 * `alert()`, `confirm()`, `prompt()` or "leave this page?": a sheet over the
 * page only (the rest of the shell stays usable), as GNOME Web does.
 */
export function PageDialog({
  dialog,
  onDone,
}: {
  dialog: DomicileDialogEvent;
  onDone: () => void;
}) {
  const [value, setValue] = React.useState(dialog.defaultValue);
  const okRef = React.useRef<HTMLButtonElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const type = dialog.dialogType;
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else {
        okRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [dialog]);
  const accept = () => {
    answer(() => dialog.accept(type === "prompt" ? value : undefined));
    onDone();
  };
  const dismiss = () => {
    answer(() => dialog.dismiss());
    onDone();
  };
  const unload = type === "beforeunload";
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/25 p-6 pt-10">
      <form
        role="alertdialog"
        aria-label={siteName(dialog.origin)}
        data-slot="browser-page-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          accept();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            dismiss();
          }
        }}
        className="w-96 max-w-full rounded-ui-box border border-ui-separator p-4 text-ui-label shadow-ui-menu ui-material-menu"
      >
        <div className="text-ui-body font-semibold">
          {unload ? _("Leave this page?") : _("%s says", siteName(dialog.origin))}
        </div>
        <p className="mt-1.5 max-h-60 overflow-auto text-ui-body whitespace-pre-wrap break-words text-ui-label-secondary">
          {unload ? _("Changes you made may not be saved.") : dialog.message}
        </p>
        {type === "prompt" && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={dialog.message || _("Answer")}
            className="mt-3 h-8 w-full rounded-ui-control border border-ui-border bg-black/5 px-2.5 text-ui-body outline-none focus:border-ui-accent dark:bg-white/8"
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          {type !== "alert" && (
            <Button type="button" size="sm" variant="secondary" onClick={dismiss}>
              {unload ? _("Stay") : _("Cancel")}
            </Button>
          )}
          <Button ref={okRef} type="submit" size="sm">
            {unload ? _("Leave") : _("OK")}
          </Button>
        </div>
      </form>
    </div>
  );
}
