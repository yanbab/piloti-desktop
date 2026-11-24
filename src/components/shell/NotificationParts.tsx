import * as React from "react";
import { BellIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useApps,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import { APP_CATALOG } from "@/data/catalog";
import {
  INLINE_REPLY_NOTIFICATION_ACTION,
} from "@domicile-desktop/sdk/notification";
import type { NotificationActionItem } from "@/lib/shell/notifications";
import { cn } from "@/lib/core/utils";

export function NotificationAppIcon({
  appName,
  icon,
  urgency,
  className,
}: {
  appName: string;
  icon?: string;
  urgency?: string;
  className?: string;
}) {
  const { installedXdgApps, getAppIconUrl } = useApps();

  const resolvedUrl = React.useMemo(() => {
    if (icon) return icon;
    const target = appName.trim().toLowerCase();
    if (!target) return undefined;

    const catalogMatch = APP_CATALOG.find((app) => {
      const name = app.name.toLowerCase();
      return (
        app.id.toLowerCase() === target ||
        name === target ||
        target.includes(name) ||
        name.includes(target)
      );
    });
    if (catalogMatch) {
      const url = getAppIconUrl(catalogMatch.id);
      if (url) return url;
    }

    const xdgMatch = installedXdgApps.find((entry) => {
      const name = entry.name.toLowerCase();
      return (
        entry.desktopId.toLowerCase() === target ||
        name === target ||
        target.includes(name) ||
        name.includes(target)
      );
    });
    if (xdgMatch) {
      const url = getAppIconUrl(xdgMatch.icon ?? xdgMatch.desktopId);
      if (url) return url;
    }

    return undefined;
  }, [appName, getAppIconUrl, icon, installedXdgApps]);

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        draggable={false}
        className={cn("size-5 shrink-0 rounded-[5px] object-contain", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[5px]",
        urgency === "critical"
          ? "bg-adw-accent/15 text-adw-accent"
          : "bg-black/8 text-adw-label-secondary dark:bg-white/10",
        className
      )}
    >
      {urgency === "critical" ? (
        <TriangleAlertIcon className="size-4" />
      ) : (
        <BellIcon className="size-4" />
      )}
    </span>
  );
}

export function NotificationActionControls({
  notificationId,
  actions,
  fromDomicile,
  onAfterAction,
  stopPropagation = true,
}: {
  notificationId: number;
  actions?: readonly NotificationActionItem[];
  fromDomicile?: boolean;
  onAfterAction?: () => void;
  stopPropagation?: boolean;
}) {
  const { invokeNotificationAction, replyToNotification } = useSystemBackends();
  const { launchApp } = useWindowActions();
  const [replyText, setReplyText] = React.useState("");

  if (!actions || actions.length === 0) return null;

  const replyAction = actions.find(
    (act) => act.key === INLINE_REPLY_NOTIFICATION_ACTION
  );
  const buttonActions = actions.filter(
    (act) => act.key !== INLINE_REPLY_NOTIFICATION_ACTION
  );

  const handleActionClick = (e: React.MouseEvent, act: NotificationActionItem) => {
    if (stopPropagation) e.stopPropagation();
    if (act.key === "settings") {
      launchApp("settings");
      invokeNotificationAction(notificationId, act.key);
    } else if (act.key === "notifications-settings") {
      launchApp("settings", { payload: "notifications" });
      invokeNotificationAction(notificationId, act.key);
    } else if (act.key === "launcher" || fromDomicile) {
      invokeNotificationAction(notificationId, act.key);
    } else {
      invokeNotificationAction(notificationId, act.key);
    }
    onAfterAction?.();
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stopPropagation) e.stopPropagation();
    const trimmed = replyText.trim();
    if (!trimmed) return;
    replyToNotification(notificationId, trimmed);
    setReplyText("");
    onAfterAction?.();
  };

  return (
    <div
      className="mt-1.5 flex flex-col gap-1.5"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
    >
      {buttonActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {buttonActions.map((act) => (
            <Button
              key={act.key}
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-adw-footnote"
              onClick={(e) => handleActionClick(e, act)}
            >
              {act.label}
            </Button>
          ))}
        </div>
      )}

      {replyAction && (
        <form onSubmit={handleReplySubmit} className="flex items-center gap-1.5">
          <Input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={replyAction.label || "Send a reply…"}
            className="h-7 flex-1 text-adw-subheadline"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!replyText.trim()}
            className="h-7 px-2 text-adw-footnote"
          >
            <SendIcon className="size-3" />
          </Button>
        </form>
      )}
    </div>
  );
}
