import * as React from "react";
import { BellIcon, LockIcon } from "lucide-react";
import { useSystemBackends, useDesktopSettings } from "@/context/DesktopStateContext";
import { _, getLocale } from "@/lib/core/i18n";
import { formatRelativeNotificationTime } from "@/lib/shell/notifications";
import { NotificationBodyText } from "@/components/shell/NicePathLabel";
import { AuthPasswordCard } from "./AuthPasswordCard";
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";

export function LockScreen() {
  const settings = useDesktopSettings(["clock24Hour", "notificationShowOnLockScreen", "notificationShowPreviews", "notificationsEnabled"]);
  const { locked, notifications, unlockSession, unlockError, unlockRefusal } =
    useSystemBackends();
  const [passphrase, setPassphrase] = React.useState("");
  const [now, setNow] = React.useState(() => new Date());
  const [retrySeconds, setRetrySeconds] = React.useState(0);

  React.useEffect(() => {
    if (!locked) {
      setPassphrase("");
      setRetrySeconds(0);
      return;
    }
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [locked]);

  React.useEffect(() => {
    const ms = unlockRefusal?.retryInMs ?? 0;
    if (!locked || ms <= 0) {
      setRetrySeconds(0);
      return;
    }
    const endAt = Date.now() + ms;
    setRetrySeconds(Math.ceil(ms / 1000));
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRetrySeconds(rem);
      if (rem <= 0) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [locked, unlockRefusal]);

  if (!locked) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (retrySeconds > 0) return;
    unlockSession(passphrase);
  };

  const localeTag =
    getLocale() === "fr" ? "fr-FR" : getLocale() === "es" ? "es-ES" : "en-US";

  return (
    <div className="fixed inset-0 z-[900] flex flex-col items-center justify-center text-white animate-in fade-in-0">
      <DesktopBackgroundLayers />
      <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl" />

      <div className="relative z-10 mb-8 text-center">
        <div className="text-6xl font-light tracking-tight tabular-nums">
          {now.toLocaleTimeString(localeTag, {
            hour12: !settings.clock24Hour,
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div className="mt-1 text-sm text-white/75">
          {now.toLocaleDateString(localeTag, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      <AuthPasswordCard
        avatar={<LockIcon className="size-6" />}
        title={_("Piloti Session Locked")}
        password={passphrase}
        onPasswordChange={setPassphrase}
        onSubmit={handleSubmit}
        placeholder={_("Enter password…")}
        submitLabel={retrySeconds > 0 ? _("Wait %ds…", retrySeconds) : _("Unlock")}
        disabled={retrySeconds > 0}
        autoFocus
        error={
          unlockError
            ? retrySeconds > 0
              ? _("%s (try again in %ds)", unlockError, retrySeconds)
              : unlockError
            : null
        }
      />

      {settings.notificationsEnabled &&
        settings.notificationShowOnLockScreen &&
        notifications.length > 0 && (
          <div className="relative z-10 mt-5 flex w-[320px] max-w-[calc(100vw-32px)] flex-col gap-2">
            {notifications.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="flex flex-col gap-0.5 rounded-[14px] bg-white/12 px-3.5 py-2.5 text-left text-white shadow-lg ring-1 ring-white/15 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between gap-2 text-ui-footnote text-white/75">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wide">
                    <BellIcon className="size-3" />
                    {n.appName}
                  </span>
                  <span className="tabular-nums">
                    {formatRelativeNotificationTime(n.time)}
                  </span>
                </div>
                <div className="truncate text-ui-callout font-semibold">
                  {n.summary}
                </div>
                {settings.notificationShowPreviews ? (
                  n.body && (
                    <div className="line-clamp-2 text-ui-subheadline text-white/80">
                      <NotificationBodyText body={n.body} />
                    </div>
                  )
                ) : (
                  <div className="text-ui-subheadline text-white/60 italic">
                    {_("Notification content hidden")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

