import * as React from "react";
import {
  MenubarCheckboxItem,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from "@/components/ui/menubar";
import type { AppMenuSection } from "@/data/catalog";
import type { AppMenuItemState } from "@/lib/engine/app-bridge";
import { _ } from "@/lib/core/i18n";
import { formatMenuShortcut } from "@/lib/core/menu-shortcuts";

export function MenuShortcutLabel({
  shortcut,
  model,
}: {
  shortcut: string;
  model: "mac" | "pc";
}) {
  return (
    <MenubarShortcut className={model === "pc" ? "tracking-normal" : undefined}>
      {formatMenuShortcut(shortcut, model)}
    </MenubarShortcut>
  );
}

/**
 * The items of an app menu section (from the catalog), with the live checked /
 * disabled state the app publishes. One renderer for the menu bar and for
 * in-window menus (e.g. the Folders view button), so they always match.
 * The items are Base UI menu items: they work in any menu root.
 */
export function AppMenuItems({
  items,
  menuState,
  onAction,
  computerModel,
}: {
  items: AppMenuSection["items"];
  menuState: Record<string, AppMenuItemState>;
  onAction: (actionId: string) => void;
  computerModel: "mac" | "pc";
}) {
  const hasCheckable = items.some(
    (i) => (menuState[i.actionId]?.checked ?? i.checked) !== undefined,
  );
  return (
    <>
      {items.map((item) => {
        const itemState = menuState[item.actionId];
        const checked = itemState?.checked ?? item.checked;
        const disabled = itemState?.disabled ?? false;
        const shortcut = item.shortcut ? (
          <MenuShortcutLabel shortcut={item.shortcut} model={computerModel} />
        ) : null;
        if (itemState?.hidden) {
          return item.separatorAfter ? <MenubarSeparator key={item.actionId} /> : null;
        }
        return (
          <React.Fragment key={item.actionId}>
            {checked !== undefined ? (
              <MenubarCheckboxItem
                checked={checked}
                disabled={disabled}
                // App menus close on any choice, checkable or not.
                closeOnClick
                onClick={() => onAction(item.actionId)}
              >
                {_(item.label)}
                {shortcut}
              </MenubarCheckboxItem>
            ) : (
              <MenubarItem
                disabled={disabled}
                className={hasCheckable ? "pl-8" : undefined}
                onClick={() => onAction(item.actionId)}
              >
                {_(item.label)}
                {shortcut}
              </MenubarItem>
            )}
            {item.separatorAfter && <MenubarSeparator />}
          </React.Fragment>
        );
      })}
    </>
  );
}
