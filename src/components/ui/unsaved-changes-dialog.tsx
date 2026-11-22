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
      <div className="w-full max-w-xs rounded-2xl border border-adw-border bg-adw-card p-5 shadow-2xl">
        <h2
          id="unsaved-changes-title"
          className="text-base font-semibold text-adw-label"
        >
          {_("Save Changes?")}
        </h2>
        <p className="mt-1.5 text-sm text-adw-label-secondary">
          {_("This document has unsaved changes. Save before closing?")}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg bg-red-500/12 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
          >
            {_("Discard")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-black/8 px-3 py-1.5 text-xs font-medium text-adw-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
          >
            {_("Cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-adw-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            {_("Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
