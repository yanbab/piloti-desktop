import type { DbusSignal, Listened } from "@domicile-desktop/sdk/system";

/** The signal a D-Bus match heard; `undefined` when it only says some were missed. */
export const signalOf = (heard: unknown): DbusSignal | undefined =>
  (heard as Listened<DbusSignal> & { item?: DbusSignal }).item;
