import * as React from "react";

/**
 * Keeps `<input type="color">` responsive at 60fps during OS color-picker drags:
 * updates local `draft` immediately, commits with leading+trailing throttle
 * (~100ms), and flushes on blur/unmount.
 */
export function useThrottledColor(
  committedValue: string,
  onCommit: (hex: string) => void,
  throttleMs = 100
) {
  const [draft, setDraft] = React.useState(committedValue);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = React.useRef<string | null>(null);
  const lastCommitAtRef = React.useRef(0);
  const onCommitRef = React.useRef(onCommit);
  onCommitRef.current = onCommit;

  React.useEffect(() => {
    if (pendingRef.current === null) {
      setDraft(committedValue);
    }
  }, [committedValue]);

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending !== null) {
      pendingRef.current = null;
      lastCommitAtRef.current = Date.now();
      onCommitRef.current(pending);
    }
  }, []);

  React.useEffect(() => flush, [flush]);

  const onChange = React.useCallback(
    (next: string) => {
      setDraft(next);
      const now = Date.now();
      const elapsed = now - lastCommitAtRef.current;
      if (elapsed >= throttleMs && !timerRef.current) {
        pendingRef.current = null;
        lastCommitAtRef.current = now;
        onCommitRef.current(next);
        return;
      }
      pendingRef.current = next;
      if (!timerRef.current) {
        const remaining = Math.max(16, throttleMs - elapsed);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          const latest = pendingRef.current;
          pendingRef.current = null;
          if (latest !== null) {
            lastCommitAtRef.current = Date.now();
            onCommitRef.current(latest);
          }
        }, remaining);
      }
    },
    [throttleMs]
  );

  return { draft, onChange, flush };
}

