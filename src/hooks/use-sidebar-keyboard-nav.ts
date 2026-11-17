import * as React from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => el.offsetParent !== null);
}

export interface UseSidebarKeyboardNavOptions<T extends string> {
  itemIds: readonly T[];
  activeId: T | null;
  onActivate: (id: T) => void;
  sidebarRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
}

/**
 * Provides GNOME/macOS-style sidebar keyboard navigation:
 * - ArrowUp/ArrowDown rapidly cycle highlight (`highlightedId`) across sidebar
 *   items using the active selection color, activating only on `keyup`.
 * - `Tab` / `ArrowRight` from the sidebar focuses the first focusable item in
 *   the detail view (`contentRef`).
 * - `Shift+Tab` / `ArrowLeft` on the first focusable item in the detail view
 *   returns focus to the active sidebar item.
 */
export function useSidebarKeyboardNav<T extends string>({
  itemIds,
  activeId,
  onActivate,
  sidebarRef,
  contentRef,
}: UseSidebarKeyboardNavOptions<T>) {
  const [pendingId, setPendingId] = React.useState<T | null>(null);
  const pendingRef = React.useRef<T | null>(null);
  pendingRef.current = pendingId;

  const highlightedId = pendingId ?? activeId;

  const focusSidebarItem = React.useCallback(
    (id: T | null) => {
      if (!id || !sidebarRef.current) return;
      const btn = sidebarRef.current.querySelector<HTMLElement>(
        `[data-sidebar-item="${CSS.escape(id)}"]`
      );
      btn?.focus();
    },
    [sidebarRef]
  );

  const onSidebarKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (itemIds.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const curId = pendingRef.current ?? activeId ?? itemIds[0];
        const curIdx = curId ? itemIds.indexOf(curId) : -1;
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          curIdx === -1
            ? 0
            : (curIdx + delta + itemIds.length) % itemIds.length;
        const nextId = itemIds[nextIdx];
        if (nextId !== undefined) {
          setPendingId(nextId);
          pendingRef.current = nextId;
          focusSidebarItem(nextId);
        }
        return;
      }

      if (
        e.key === "ArrowRight" ||
        (e.key === "Tab" && !e.shiftKey)
      ) {
        const focusables = getFocusableElements(contentRef.current);
        if (focusables.length > 0) {
          e.preventDefault();
          if (pendingRef.current !== null) {
            onActivate(pendingRef.current);
            setPendingId(null);
            pendingRef.current = null;
          }
          focusables[0].focus();
        }
      }
    },
    [activeId, contentRef, focusSidebarItem, itemIds, onActivate]
  );

  const onSidebarKeyUp = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        pendingRef.current !== null
      ) {
        const target = pendingRef.current;
        setPendingId(null);
        pendingRef.current = null;
        if (target !== activeId) {
          onActivate(target);
        }
      }
    },
    [activeId, onActivate]
  );

  const onContentKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const isBack =
        e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey);
      if (!isBack) return;

      const focusables = getFocusableElements(contentRef.current);
      if (focusables.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      if (active !== focusables[0]) return;

      if (
        e.key === "ArrowLeft" &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
      ) {
        const inputEl = active as HTMLInputElement;
        if (
          typeof inputEl.selectionStart === "number" &&
          inputEl.selectionStart > 0
        ) {
          return;
        }
      }

      e.preventDefault();
      focusSidebarItem(pendingRef.current ?? activeId ?? itemIds[0] ?? null);
    },
    [activeId, contentRef, focusSidebarItem, itemIds]
  );

  return {
    highlightedId,
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  };
}

