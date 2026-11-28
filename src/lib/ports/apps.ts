/**
 * Applications as any app sees them, in the shell or in its own process. Plain
 * TypeScript: no React and nothing of the shell, since an app module only has
 * Domicile's `files`, `processes` and `dbus`.
 */
import type { Files } from "@domicile-desktop/sdk/desktop/files";
import type { Processes } from "@domicile-desktop/sdk/desktop/processes";
import type { ParseDesktopEntryOptions, XdgDesktopEntry } from "@/lib/xdg/xdg-desktop-entry";

/** What listing and asking for apps needs; the shell and a module both have it. */
export interface AppsHost {
  files: Pick<Files, "readDir" | "readText" | "read">;
  processes: Pick<Processes, "run">;
}

export type ListAppsOptions = Omit<ParseDesktopEntryOptions, "applicationDirs">;

export interface Apps {
  /** The installed applications a menu would show, by name. */
  list(options?: ListAppsOptions): Promise<XdgDesktopEntry[]>;
  /** Asks the shell to open an app (its id or desktop id), with a path or pane. */
  launch(appId: string, options?: { payload?: string }): void;
}
