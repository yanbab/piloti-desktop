import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { _ } from "@/lib/core/i18n";
import {
  formatMenuShortcut,
  type ShortcutGroup,
} from "@/lib/shell/menu-shortcuts";

export function ShortcutsDialog({
  open,
  onOpenChange,
  appName,
  groups,
  model,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appName: string;
  groups: ShortcutGroup[];
  model: "mac" | "pc";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{_("Keyboard Shortcuts")}</DialogTitle>
          <DialogDescription>{appName}</DialogDescription>
        </DialogHeader>
        <div
          data-testid="shortcuts-dialog-body"
          className="max-h-[56vh] space-y-4 overflow-y-auto pr-1"
        >
          {groups.length === 0 ? (
            <p className="text-sm text-adw-label-secondary">
              {_("This application does not declare any keyboard shortcuts.")}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.title}>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-adw-label-secondary uppercase">
                  {_(group.title)}
                </h3>
                <ul className="divide-y divide-adw-separator/60 rounded-adw-item border border-adw-separator/60">
                  {group.entries.map((entry) => (
                    <li
                      key={`${entry.label}-${entry.shortcut}`}
                      className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">{_(entry.label)}</span>
                      <kbd className="shrink-0 rounded-adw-control bg-black/6 px-1.5 py-0.5 font-mono text-xs text-adw-label-secondary dark:bg-white/10">
                        {formatMenuShortcut(entry.shortcut, model)}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
