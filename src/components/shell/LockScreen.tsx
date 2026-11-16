import * as React from "react";
import { BellIcon, LockIcon, UnlockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useSystemBackends } from "@/context/DesktopStateContext";
import { formatRelativeNotificationTime } from "@/lib/notifications";
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";

export function LockScreen() {
  const { isBrowserRuntime, settings } = useSettings();
  const { locked, notifications, unlockSession, unlockError } =
    useSystemBackends();
  const [passphrase, setPassphrase] = React.useState("");
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    if (!locked) {
      setPassphrase("");
      return;
    }
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [locked]);

  if (!locked) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlockSession(passphrase);
  };

  return (
    <div className="fixed inset-0 z-[900] flex flex-col items-center justify-center text-white animate-in fade-in-0">
      <DesktopBackgroundLayers />
      <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl" />

      <div className="relative z-10 mb-8 text-center">
        <div className="text-6xl font-light tracking-tight tabular-nums">
          {now.toLocaleTimeString("en-US", {
            hour12: !settings.clock24Hour,
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div className="mt-1 text-sm text-white/75">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-[300px] flex-col items-center gap-3 rounded-[22px] bg-white/10 p-6 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-lg font-bold shadow-md">
          <LockIcon className="size-6" />
        </div>
        <div className="text-sm font-semibold">Piloti Session Locked</div>

        {!isBrowserRuntime ? (
          <Input
            type="password"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter password…"
            className="w-full border-white/20 bg-black/30 text-center text-white placeholder:text-white/45"
          />
        ) : (
          <p className="text-center text-xs text-white/65">
            Browser harness lock preview (on Domicile Linux, authenticates via PAM)
          </p>
        )}

        {unlockError && (
          <div className="w-full rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-center text-xs text-rose-200 ring-1 ring-rose-400/30">
            {unlockError}
          </div>
        )}

        <Button type="submit" className="mt-1 w-full gap-1.5">
          <UnlockIcon className="size-3.5" />
          Unlock Session
        </Button>
      </form>

      {settings.notificationsEnabled &&
        settings.notificationShowOnLockScreen &&
        notifications.length > 0 && (
          <div className="relative z-10 mt-5 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2">
            {notifications.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="flex flex-col gap-0.5 rounded-[14px] bg-white/12 px-3.5 py-2.5 text-left text-white shadow-lg ring-1 ring-white/15 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between gap-2 text-[10.5px] text-white/75">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wide">
                    <BellIcon className="size-3" />
                    {n.appName}
                  </span>
                  <span className="tabular-nums">
                    {formatRelativeNotificationTime(n.time)}
                  </span>
                </div>
                <div className="truncate text-[12.5px] font-semibold">
                  {n.summary}
                </div>
                {settings.notificationShowPreviews ? (
                  n.body && (
                    <div className="line-clamp-2 text-[11.5px] text-white/80">
                      {n.body}
                    </div>
                  )
                ) : (
                  <div className="text-[11px] text-white/60 italic">
                    Notification content hidden
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

