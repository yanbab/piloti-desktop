import * as React from "react";
import { _ } from "@/lib/core/i18n";

/**
 * Modal "Save Changes?" prompt rendered inside an app window.
 * Shared by apps that block window close while they hold unsaved edits.
 */
export function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onCancel,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-xs rounded-2xl border border-shell-border bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:bg-zinc-900/95">
        <h2
          id="unsaved-changes-title"
          className="text-base font-semibold text-shell-label"
        >
          {_("Save Changes?")}
        </h2>
        <p className="mt-1.5 text-sm text-shell-label-secondary">
          {_("This document has unsaved changes. Save before closing?")}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-shell-item bg-red-500/12 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover-fill:bg-red-500/20"
          >
            {_("Discard")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-shell-item bg-black/8 px-3 py-1.5 text-xs font-medium text-shell-label transition-colors hover-fill:bg-black/14 dark:bg-white/10 dark:hover-fill:bg-white/16"
          >
            {_("Cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-shell-item bg-shell-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover-fill:opacity-90"
          >
            {_("Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
