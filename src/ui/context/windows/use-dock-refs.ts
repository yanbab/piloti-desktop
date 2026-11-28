import * as React from "react";

/** The Dock tiles by app, where windows minimise to. */
export function useDockRefs() {
  const dockRefs = React.useRef<
    Record<string, React.RefObject<Element | null>>
  >({});
  const registerDockRef = React.useCallback(
    (appId: string, node: HTMLElement | null) => {
      if (!dockRefs.current[appId]) {
        dockRefs.current[appId] = { current: node };
      } else {
        dockRefs.current[appId].current = node;
      }
    },
    []
  );

  const getDockRef = React.useCallback(
    (appId: string): React.RefObject<Element | null> => {
      if (!dockRefs.current[appId]) {
        dockRefs.current[appId] = { current: null };
      }
      return dockRefs.current[appId];
    },
    []
  );

  return { registerDockRef, getDockRef };
}
