/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import { LockIcon, TriangleAlertIcon } from "lucide-react";
import {
  WEBVIEW_PAGE_CHANGE_EVENT,
  WEBVIEW_SITE_PERMISSIONS_CHANGE_EVENT,
  type WebViewPermission,
  type WebViewPermissionSetting,
} from "@domicile-desktop/sdk/webview-element";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import {
  hasStoredPermissions,
  sitePermissionRows,
  type SitePermissionRow,
} from "@/ui/shell/windows/browser-site-permissions";

const PERMISSION_NAMES: Record<WebViewPermission, () => string> = {
  camera: () => _("Camera"),
  microphone: () => _("Microphone"),
  location: () => _("Location"),
  notifications: () => _("Notifications"),
  clipboard: () => _("Clipboard"),
  midi: () => _("MIDI Devices"),
  "window-management": () => _("Window Management"),
  "local-fonts": () => _("Fonts"),
  "idle-detection": () => _("Idle Detection"),
  "automatic-downloads": () => _("Automatic Downloads"),
};

const SETTING_NAMES: Record<WebViewPermissionSetting, () => string> = {
  ask: () => _("Ask"),
  allow: () => _("Allow"),
  block: () => _("Block"),
};

/** The view's rows, read again when the page or a setting changes. */
function useSitePermissions(view: HTMLWebViewElement | null): SitePermissionRow[] {
  const [rows, setRows] = React.useState<SitePermissionRow[]>([]);
  React.useEffect(() => {
    if (!view) return;
    const read = () => {
      try {
        setRows(sitePermissionRows(view.sitePermissions()));
      } catch {
        setRows([]);
      }
    };
    read();
    view.addEventListener(WEBVIEW_SITE_PERMISSIONS_CHANGE_EVENT, read);
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, read);
    return () => {
      view.removeEventListener(WEBVIEW_SITE_PERMISSIONS_CHANGE_EVENT, read);
      view.removeEventListener(WEBVIEW_PAGE_CHANGE_EVENT, read);
    };
  }, [view]);
  return rows;
}

/** The cameras or microphones, listed when the menu opens. */
function useMediaDevices(view: HTMLWebViewElement | null, open: boolean) {
  const [devices, setDevices] = React.useState<DomicileMediaDevices | null>(null);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    if (!view || !open) return;
    let live = true;
    view
      .mediaDevices()
      .then((d) => live && setDevices(d))
      .catch(() => live && setDevices(null));
    return () => {
      live = false;
    };
  }, [view, open, version]);
  const refresh = React.useCallback(() => setVersion((v) => v + 1), []);
  return [devices, refresh] as const;
}

function setPermission(view: HTMLWebViewElement, permission: WebViewPermission, setting: WebViewPermissionSetting) {
  try {
    view.setSitePermission(permission, setting);
  } catch {
    // The page left its site meanwhile.
  }
}

/**
 * The lock (or warning) before the address: a menu with the connection and
 * the site's permissions, each one Ask, Allow or Block, and which camera and
 * microphone the site gets. Native only: the demo has no permissions.
 */
export function BrowserSiteInfo({
  view,
  security,
  site,
  className,
}: {
  view: HTMLWebViewElement | null;
  security: string;
  site: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rows = useSitePermissions(view);
  const [devices, refreshDevices] = useMediaDevices(view, open);
  const secure = security === "secure";
  const warn = security === "warning" || security === "dangerous";
  if (!view || (!secure && !warn && rows.length === 0)) return null;
  const deviceList = (permission: WebViewPermission) =>
    permission === "camera" ? devices?.cameras : permission === "microphone" ? devices?.microphones : undefined;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        data-window-no-drag
        data-slot="browser-site-info"
        aria-label={_("Site Information")}
        title={secure ? _("Secure Connection") : warn ? _("Not Secure") : _("Site Information")}
        className={cn(
          "pointer-events-auto flex size-6 shrink-0 items-center justify-center rounded-ui-control outline-none transition-colors hover-fill:bg-black/8 data-[popup-open]:bg-black/14 dark:hover-fill:bg-white/10 dark:data-[popup-open]:bg-white/18",
          security === "dangerous" && "text-ui-red",
          className
        )}
      >
        {warn ? (
          <SymbolicIcon name="dialog-warning" fallback={TriangleAlertIcon} className="size-3.5" />
        ) : (
          <SymbolicIcon
            name="network-wireless-encrypted"
            fallback={LockIcon}
            className={cn("size-3.5", secure ? "opacity-60" : "opacity-40")}
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="truncate">{site}</DropdownMenuLabel>
        <div className={cn("px-2 pb-1.5 text-ui-caption text-ui-label-secondary", security === "dangerous" && "text-ui-red")}>
          {secure
            ? _("The connection to this site is secure.")
            : warn
              ? _("The connection to this site is not secure.")
              : _("This page is not a website.")}
        </div>
        {rows.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{_("Permissions")}</DropdownMenuLabel>
            {rows.map(({ permission, setting }) => {
              const list = deviceList(permission);
              return (
                <DropdownMenuSub key={permission}>
                  <DropdownMenuSubTrigger data-permission={permission}>
                    <span className="flex-1">{PERMISSION_NAMES[permission]()}</span>
                    <span
                      className={cn(
                        "text-ui-caption text-ui-label-secondary",
                        setting === "block" && "text-ui-red",
                        setting === "allow" && "text-ui-accent"
                      )}
                    >
                      {SETTING_NAMES[setting]()}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={setting}
                      onValueChange={(v) => setPermission(view, permission, v as WebViewPermissionSetting)}
                    >
                      {(Object.keys(SETTING_NAMES) as WebViewPermissionSetting[]).map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {SETTING_NAMES[s]()}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    {list && list.length > 1 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={list[0]?.id}
                          onValueChange={(id) => {
                            void view
                              .setMediaDevice(permission === "camera" ? "camera" : "microphone", String(id))
                              .then(refreshDevices, () => undefined);
                          }}
                        >
                          {list.map((d) => (
                            <DropdownMenuRadioItem key={d.id} value={d.id}>
                              <span className="truncate">{d.name}</span>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
            {hasStoredPermissions(rows) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    for (const r of rows) if (r.setting !== "ask") setPermission(view, r.permission, "ask");
                  }}
                >
                  {_("Reset Permissions")}
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
