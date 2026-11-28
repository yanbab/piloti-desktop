import * as React from "react";
import { cn } from "@/core/util/utils";
import { AddressSuggestionList } from "@/ui/components/address-bar/AddressSuggestionList";
import type { AddressField } from "@/ui/components/address-bar/use-address-field";

/**
 * An address bar in a header: at rest, the app's own title (`children`: the
 * page title and padlock, the folder name), which opens the field on a
 * click; while editing, the field and its suggestions. State comes from
 * `useAddressField`.
 */
export function AddressBar({
  field,
  label,
  placeholder,
  suggestionsLabel,
  suggestionsHeading,
  className,
  inputClassName,
  children,
}: {
  field: AddressField;
  /** The field's accessible name ("Address", "Folder path"). */
  label: string;
  placeholder?: string;
  suggestionsLabel: string;
  suggestionsHeading?: string;
  /** The form while editing. */
  className?: string;
  inputClassName?: string;
  children: React.ReactNode;
}) {
  if (!field.editing) return <>{children}</>;
  return (
    <form
      onSubmit={field.onSubmit}
      data-window-no-drag
      data-slot="address-bar"
      className={cn("relative flex min-w-0 flex-1 items-center", className)}
    >
      <input
        ref={field.inputRef}
        type="text"
        value={field.draft}
        onChange={(e) => field.setDraft(e.target.value)}
        onBlur={field.close}
        onKeyDown={field.onKeyDown}
        role="combobox"
        aria-expanded={field.suggestions.length > 0}
        aria-autocomplete="list"
        aria-label={label}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          "h-7 w-full rounded-ui-control border border-ui-accent/70 bg-black/8 px-2.5 text-ui-body outline-none dark:bg-white/12",
          inputClassName
        )}
      />
      <AddressSuggestionList
        anchor={field.input}
        items={field.suggestions}
        selected={field.selected}
        heading={suggestionsHeading}
        label={suggestionsLabel}
        onPick={field.pick}
        onHover={field.setSelected}
      />
    </form>
  );
}
