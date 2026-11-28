import * as React from "react";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { UnlockRefusal, type UnlockRefused } from "@domicile-desktop/sdk/system";
import { getEngine } from "@/lib/engine/engine";
import type { Piloti } from "@/lib/engine/piloti";

/** Seconds of warning before the screens blank for inactivity. */
const IDLE_WARNING_SECONDS = 30;

/** A stream from a Domicile `Listening` (items + stop). */
type StreamListening<T> = { items: ReadableStream<T>; stop: () => void };

/** The compositor's session lock and idle warnings (a flag in the demo). */
export function useSessionLock(piloti: Piloti) {
  const { systemServices } = getEngine().capabilities;
  // Compositor session lock (declared before banner helpers so lockscreen policy applies)
  const sessionLocked =
    useWatch(piloti.session, "lockchange", () => piloti.session.locked) ??
    false;
  const [browserLocked, setBrowserLocked] = React.useState(false);
  const locked = !systemServices ? browserLocked : sessionLocked;

  const [unlockRefusal, setUnlockRefusal] = React.useState<UnlockRefused | null>(
    null
  );
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [idleWarningMs, setIdleWarningMs] = React.useState<number | undefined>(
    undefined
  );

  React.useEffect(() => {
    if (!locked) {
      setUnlockError(null);
      setUnlockRefusal(null);
    }
  }, [locked]);

  React.useEffect(() => {
    if (!systemServices) return;
    let cancelled = false;
    let stopWarnings: (() => void) | undefined;
    let stopRefusals: (() => void) | undefined;

    // "Screen will dim in Ns": Domicile ≥ 1.3 says `true` that many seconds
    // before blanking and `false` when it is called off; older ones sent the
    // milliseconds left (`idleWarnings`).
    let countdown: ReturnType<typeof setInterval> | undefined;
    const stopCountdown = () => {
      if (countdown) clearInterval(countdown);
      countdown = undefined;
    };
    const listen = async <T,>(
      open: () => Promise<{ match: (arms: { Ok: (l: StreamListening<T>) => void; Err: () => void }) => void }>,
      onValue: (value: T) => void,
    ) => {
      try {
        (await open()).match({
          Ok: async (listening) => {
            if (cancelled) {
              listening.stop();
              return;
            }
            stopWarnings = () => listening.stop();
            const reader = listening.items.getReader();
            while (!cancelled) {
              const { done, value } = await reader.read();
              if (done || cancelled) break;
              onValue(value);
            }
          },
          Err: () => {},
        });
      } catch {
        // ignore
      }
    };
    const session = piloti.session as typeof piloti.session & {
      idleWarnings?: () => Promise<{
        match: (arms: { Ok: (l: StreamListening<number | undefined>) => void; Err: () => void }) => void;
      }>;
    };
    if (typeof session.idleBeforeBlanking === "function") {
      void listen<boolean>(
        () => session.idleBeforeBlanking(IDLE_WARNING_SECONDS),
        (warn) => {
          stopCountdown();
          if (!warn) {
            setIdleWarningMs(undefined);
            return;
          }
          const deadline = Date.now() + IDLE_WARNING_SECONDS * 1000;
          const tick = () => setIdleWarningMs(Math.max(0, deadline - Date.now()));
          tick();
          countdown = setInterval(tick, 1000);
        },
      );
    } else if (typeof session.idleWarnings === "function") {
      const idleWarnings = session.idleWarnings;
      void listen<number | undefined>(() => idleWarnings(), setIdleWarningMs);
    }

    (async () => {
      try {
        const res = await piloti.session.unlockRefusals();
        res.match({
          Ok: async (listening) => {
            if (cancelled) {
              listening.stop();
              return;
            }
            stopRefusals = () => listening.stop();
            const reader = listening.items.getReader();
            while (!cancelled) {
              const { done, value } = await reader.read();
              if (done || cancelled) break;
              setUnlockRefusal(value);
              if (value.refusal === UnlockRefusal.WrongPassphrase) {
                setUnlockError("Incorrect passphrase. Please try again.");
              } else if (value.refusal === UnlockRefusal.TooSoon) {
                setUnlockError(
                  `Too many attempts. Try again in ${Math.ceil(value.retryInMs / 1000)}s.`
                );
              } else {
                setUnlockError("Authentication backend unavailable (PAM).");
              }
            }
          },
          Err: () => {},
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      stopCountdown();
      cancelled = true;
      stopWarnings?.();
      stopRefusals?.();
    };
  }, [systemServices, piloti]);

  const lockSession = React.useCallback(() => {
    console.info("[Piloti] session: lock");
    setUnlockError(null);
    setUnlockRefusal(null);
    if (!systemServices) {
      setBrowserLocked(true);
      return;
    }
    piloti.session.lock();
  }, [piloti.session, systemServices]);

  const unlockSession = React.useCallback(
    (passphrase: string) => {
      console.info("[Piloti] session: unlock attempt");
      setUnlockError(null);
      if (!systemServices) {
        if (!passphrase.trim()) {
          setUnlockError("Please enter your password.");
          return;
        }
        setBrowserLocked(false);
        return;
      }
      piloti.session.unlock(passphrase);
    },
    [piloti.session, systemServices]
  );

  return React.useMemo(
    () => ({
      locked,
      setBrowserLocked,
      lockSession,
      unlockSession,
      unlockError,
      unlockRefusal,
      idleWarningMs,
    }),
    [locked, lockSession, unlockSession, unlockError, unlockRefusal, idleWarningMs],
  );
}
