import * as React from "react";
import type { AddressSuggestion } from "@/core/address/types";

export interface AddressFieldOptions {
  /** The current location (page address, folder path): the field starts with it. */
  value: string;
  /**
   * Suggestions for what is typed. `untouched` is true while the field still
   * holds `value` (the browser then lists bookmarks). May be async (a folder
   * listing): an answer for older text is dropped.
   */
  suggest?: (
    draft: string,
    untouched: boolean
  ) => readonly AddressSuggestion[] | Promise<readonly AddressSuggestion[]>;
  /** Enter: the picked suggestion, if any, and the typed text. */
  onSubmit: (entry: { suggestion?: AddressSuggestion; text: string }) => void;
}

export interface AddressField {
  editing: boolean;
  /** Ctrl+L or a click on the title: the field opens on `value`, selected. */
  open: () => void;
  close: () => void;
  draft: string;
  untouched: boolean;
  setDraft: (text: string) => void;
  suggestions: readonly AddressSuggestion[];
  /** Index in `suggestions`, -1 for none. */
  selected: number;
  /** The text the field would complete to, shown after the caret as in the
   *  Launcher (Tab or Right accepts it, Enter goes there). */
  inlineCompletion: string | undefined;
  acceptCompletion: (text: string) => void;
  setSelected: (index: number) => void;
  pick: (item: AddressSuggestion) => void;
  inputRef: (node: HTMLInputElement | null) => void;
  input: HTMLInputElement | null;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * The editing state of an address bar: open and close, the typed text, the
 * suggestions and the one picked with the arrows, Tab to complete a path,
 * Escape to give up. Shared by the Web Browser and Folders; no shell import,
 * so it runs in an app module too.
 */
export function useAddressField({ value, suggest, onSubmit }: AddressFieldOptions): AddressField {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [input, setInput] = React.useState<HTMLInputElement | null>(null);
  const [suggestions, setSuggestions] = React.useState<readonly AddressSuggestion[]>([]);
  const [selected, setSelected] = React.useState(-1);
  const untouched = draft === value;

  const open = React.useCallback(() => {
    setDraft(value);
    setEditing(true);
    // Already open (Ctrl+L again): select the text anew.
    input?.select();
  }, [value, input]);
  const close = React.useCallback(() => setEditing(false), []);

  React.useEffect(() => {
    if (!editing || !input) return;
    const frame = requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    // A press anywhere else closes it, even where focus does not move
    // (a window's drag area).
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (input.contains(target) || target?.closest?.("[data-slot=address-suggestions]")) return;
      setEditing(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [editing, input]);

  const suggestRef = React.useRef(suggest);
  suggestRef.current = suggest;
  React.useEffect(() => {
    setSelected(-1);
    const run = suggestRef.current;
    if (!editing || !run) {
      setSuggestions([]);
      return;
    }
    let current = true;
    void Promise.resolve(run(draft, untouched)).then(
      (list) => current && setSuggestions(list),
      () => current && setSuggestions([])
    );
    return () => {
      current = false;
    };
  }, [editing, draft, untouched]);

  // The picked suggestion, else the first, when it continues what is typed.
  const inlineCompletion = React.useMemo(() => {
    if (untouched || !draft) return undefined;
    const item = suggestions[selected >= 0 ? selected : 0];
    const text = item?.completion;
    return text && text.length > draft.length && text.toLowerCase().startsWith(draft.toLowerCase())
      ? text
      : undefined;
  }, [draft, selected, suggestions, untouched]);

  const pick = React.useCallback(
    (item: AddressSuggestion) => {
      setEditing(false);
      onSubmit({ suggestion: item, text: draft });
    },
    [draft, onSubmit]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setSelected((i) => Math.max(-1, Math.min(suggestions.length - 1, i + step)));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(false);
    // Enter on a shown completion goes there (`exa` → example.com).
    const picked = suggestions[selected];
    if (picked) onSubmit({ suggestion: picked, text: draft });
    else onSubmit({ text: inlineCompletion ?? draft });
  };

  return {
    editing,
    open,
    close,
    draft,
    untouched,
    setDraft,
    suggestions,
    selected,
    setSelected,
    inlineCompletion,
    acceptCompletion: setDraft,
    pick,
    inputRef: setInput,
    input,
    onKeyDown,
    onSubmit: submit,
  };
}
