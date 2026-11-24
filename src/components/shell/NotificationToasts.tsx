import * as React from "react";
import {
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  useToastManager,
} from "@/components/ui/toast";
import {
  useSettings,
  useSystemBackends,
} from "@/context/DesktopStateContext";
import {
  type NotificationToastData,
  pilotiToastManager,
} from "@/lib/shell/notifications";
import { cn } from "@/lib/core/utils";
import { NotificationBodyText } from "@/components/shell/NicePathLabel";
import {
  NotificationActionControls,
  NotificationAppIcon,
} from "./NotificationParts";

function ToastBannerStack() {
  const { invokeNotificationAction } = useSystemBackends();
  const { toasts, close } = useToastManager<NotificationToastData>();

  if (toasts.length === 0) return null;

  return (
    <ToastViewport position="top-right">
      {toasts.map((toast) => {
        const data = toast.data;
        const isCritical = data?.urgency === "critical" || toast.type === "critical";
        const isClickable = Boolean(data?.clickable && data?.fromDomicile);

        return (
          <ToastRoot
            key={toast.id}
            toast={toast}
            swipeDirection={["up", "right"]}
            onClick={() => {
              if (isClickable && data) {
                invokeNotificationAction(data.notificationId, "default");
              }
            }}
            className={cn(
              isCritical && "border-adw-accent/50 ring-1 ring-adw-accent/35",
              isClickable && "cursor-default hover-fill:brightness-105"
            )}
          >
            <ToastContent>
              <div className="flex items-start gap-3">
                <NotificationAppIcon
                  appName={data?.appName || "Piloti System"}
                  icon={data?.icon}
                  urgency={data?.urgency}
                  className="mt-0.5 size-9 rounded-[8px]"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    {toast.title ? (
                      <ToastTitle className="min-w-0 flex-1 truncate">
                        {toast.title}
                      </ToastTitle>
                    ) : (
                      <span />
                    )}
                    <ToastClose
                      onClick={(e) => {
                        e.stopPropagation();
                        close(toast.id);
                      }}
                    />
                  </div>
                  {toast.description && (
                    <ToastDescription className="mt-0.5 line-clamp-3">
                      {typeof toast.description === "string" ? (
                        <NotificationBodyText body={toast.description} />
                      ) : (
                        toast.description
                      )}
                    </ToastDescription>
                  )}

                  {data && (
                    <NotificationActionControls
                      notificationId={data.notificationId}
                      actions={data.actions}
                      fromDomicile={data.fromDomicile}
                      onAfterAction={() => close(toast.id)}
                    />
                  )}
                </div>
              </div>
            </ToastContent>
          </ToastRoot>
        );
      })}
    </ToastViewport>
  );
}

export function NotificationToasts() {
  const { settings } = useSettings();

  return (
    <ToastProvider
      toastManager={pilotiToastManager}
      timeout={settings.notificationBannerTimeoutMs}
      limit={4}
    >
      <ToastBannerStack />
    </ToastProvider>
  );
}

