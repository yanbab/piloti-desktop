import * as React from "react";
import { LockIcon, UnlockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useSystemBackends } from "@/context/DesktopStateContext";

export function LockScreen() {
  const { isBrowserRuntime, settings, activeWallpaper } = useSettings();
  const { locked, unlockSession, unlockError } = useSystemBackends();
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
    <div
      style={{
        background: settings.customWallpaperUrl
          ? `url(${settings.customWallpaperUrl}) center/cover no-repeat`
          : activeWallpaper.backgroundCss,
      }}
      className="fixed inset-0 z-[900] flex flex-col items-center justify-center text-white animate-in fade-in-0"
    >
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
    </div>
  );
}

