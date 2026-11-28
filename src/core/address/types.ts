/**
 * The address bar shared by the Web Browser, Folders and the Launcher: what
 * it suggests and where an entry leads. Plain data, so a suggestion list can
 * be drawn by any app, in the shell or in an app module.
 */

/** Where a suggestion or a typed entry leads. Each app opens its own kind
 *  and hands the others on (an address typed in Folders opens the browser). */
export type AddressTarget =
  | { kind: "url"; url: string }
  | { kind: "path"; path: string }
  | { kind: "search"; text: string };

export type AddressSuggestionIcon = "bookmark" | "history" | "folder";

export interface AddressSuggestion {
  /** Unique within a list. */
  key: string;
  title: string;
  /** Second column: the address or path, shortened. */
  detail: string;
  icon: AddressSuggestionIcon;
  target: AddressTarget;
  /** The text the field completes to (a path keeps its trailing `/`). */
  completion?: string;
}
