import { BellRingIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSettings, useSystemBackends } from "@/context/DesktopStateContext";

const TIMEOUT_ITEMS: { value: string; label: string }[] = [
  { value: "3000", label: "3 seconds" },
  { value: "5000", label: "5 seconds" },
  { value: "8000", label: "8 seconds" },
  { value: "10000", label: "10 seconds" },
  { value: "0", label: "Stay until dismissed" },
];

const HISTORY_LIMIT_ITEMS: { value: string; label: string }[] = [
  { value: "25", label: "25 notifications" },
  { value: "50", label: "50 notifications" },
  { value: "100", label: "100 notifications" },
  { value: "200", label: "200 notifications" },
];

export function NotificationsPane() {
  const { settings, updateSettings } = useSettings();
  const { notifications, pushNotification, clearAllNotifications } =
    useSystemBackends();

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Do Not Disturb &amp; Delivery</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Do Not Disturb</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.doNotDisturb}
                onCheckedChange={(checked) =>
                  updateSettings({ doNotDisturb: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Allow Critical Alerts in Do Not Disturb</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.notificationAllowCriticalInDnd}
                onCheckedChange={(checked) =>
                  updateSettings({
                    notificationAllowCriticalInDnd: Boolean(checked),
                  })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Enable Notifications</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ notificationsEnabled: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Toast Banners</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Show Popup Banners</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                disabled={!settings.notificationsEnabled}
                checked={settings.notificationBannersEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({
                    notificationBannersEnabled: Boolean(checked),
                  })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Auto-Hide Delay</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                items={TIMEOUT_ITEMS}
                disabled={
                  !settings.notificationsEnabled ||
                  !settings.notificationBannersEnabled
                }
                value={String(settings.notificationBannerTimeoutMs)}
                onValueChange={(val) => {
                  const parsed = Number.parseInt(String(val), 10);
                  if (Number.isFinite(parsed)) {
                    updateSettings({ notificationBannerTimeoutMs: parsed });
                  }
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEOUT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Lock Screen &amp; Privacy</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Lock Screen Notifications</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                disabled={!settings.notificationsEnabled}
                checked={settings.notificationShowOnLockScreen}
                onCheckedChange={(checked) =>
                  updateSettings({
                    notificationShowOnLockScreen: Boolean(checked),
                  })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Show Message Previews</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                disabled={!settings.notificationsEnabled}
                checked={settings.notificationShowPreviews}
                onCheckedChange={(checked) =>
                  updateSettings({
                    notificationShowPreviews: Boolean(checked),
                  })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>History &amp; Diagnostics</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>History Retention</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                items={HISTORY_LIMIT_ITEMS}
                value={String(settings.notificationHistoryLimit)}
                onValueChange={(val) => {
                  const parsed = Number.parseInt(String(val), 10);
                  if (Number.isFinite(parsed)) {
                    updateSettings({ notificationHistoryLimit: parsed });
                  }
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HISTORY_LIMIT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Send Test Notification</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={!settings.notificationsEnabled}
                onClick={() =>
                  pushNotification({
                    appName: "Piloti System",
                    summary: "Wayland Compositor Synced",
                    body: `Workspace ${settings.activeWorkspace} active · Volume ${settings.volume}%`,
                    actions: [
                      {
                        key: "notifications-settings",
                        label: "Notification Settings",
                      },
                    ],
                  })
                }
              >
                <BellRingIcon className="size-3.5" />
                Normal
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!settings.notificationsEnabled}
                onClick={() =>
                  pushNotification({
                    appName: "System Monitor",
                    summary: "Critical Battery / Alert Preview",
                    body: "Urgent notifications stay pinned until you dismiss them.",
                    urgency: "critical",
                  })
                }
              >
                <TriangleAlertIcon className="size-3.5 text-rose-500" />
                Urgent
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Notification History ({notifications.length})
              </GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                disabled={notifications.length === 0}
                onClick={clearAllNotifications}
              >
                <Trash2Icon className="size-3.5" />
                Clear History
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

