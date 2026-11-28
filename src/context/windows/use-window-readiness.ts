import * as React from "react";

/** Windows not painted yet: hidden until they say so, or after a timeout. */
export function useWindowReadiness() {
  const [unreadyWindowIds, setUnreadyWindowIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const readyTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const markWindowReady = React.useCallback((windowId: string) => {
    const timer = readyTimersRef.current.get(windowId);
    if (timer) {
      clearTimeout(timer);
      readyTimersRef.current.delete(windowId);
    }
    setUnreadyWindowIds((prev) => {
      if (!prev.has(windowId)) return prev;
      const next = new Set(prev);
      next.delete(windowId);
      return next;
    });
  }, []);

  const markWindowUnready = React.useCallback(
    (windowId: string, timeoutMs = 2500) => {
      setUnreadyWindowIds((prev) => {
        if (prev.has(windowId)) return prev;
        const next = new Set(prev);
        next.add(windowId);
        return next;
      });
      const existingTimer = readyTimersRef.current.get(windowId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        readyTimersRef.current.delete(windowId);
        markWindowReady(windowId);
      }, timeoutMs);
      readyTimersRef.current.set(windowId, timer);
    },
    [markWindowReady]
  );

  React.useEffect(() => {
    const timers = readyTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return { unreadyWindowIds, markWindowReady, markWindowUnready };
}
