/**
 * App icons for shared components (`AppSymbol`, folder icons): the shell's
 * loaded icons, or none in an app on its own. Lets those components skip the
 * shell's contexts, which would bring the whole shell into an app module.
 */
import * as React from "react";

export interface AppIconSource {
  getAppIconUrl: (appIdOrName: string | undefined) => string | undefined;
  fallbackAppIconUrl?: string;
}

const AppIconContext = React.createContext<AppIconSource | null>(null);
export const AppIconProvider = AppIconContext.Provider;

export function useAppIcons(): AppIconSource | null {
  return React.useContext(AppIconContext);
}
