import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/ui/components/ui/dropdown-menu";
import { useSystemBackends, useWindowActions, useDesktopSetting, useUpdateSettings } from "@/ui/context/DesktopStateContext";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { _ } from "@/core/util/i18n";
import { usePiloti } from "@/platform/shared/piloti";
import { CONFIG_LAYOUTS, useKeymaps } from "@/ui/hooks/keyboard";
import { showKeyboardLayout, showOnScreenKeyboard } from "@/platform/shared/system-commands";
import { KeyboardLayoutSwitcher } from "@/ui/shell/session/KeyboardLayoutSwitcher";

/** The menu bar's keyboard menu: layouts, the layout viewer, the on-screen keyboard. */
export function KeyboardMenu() {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
  const keyboardLayout = useDesktopSetting("keyboardLayout");
  const updateSettings = useUpdateSettings();
  const { pushNotification } = useSystemBackends();
  const { launchApp } = useWindowActions();
  const { active } = useKeymaps();

  const open = async (run: () => Promise<boolean>, missing: string) => {
    if (systemServices && (await run().catch(() => false))) return;
    pushNotification({ appName: "Piloti", summary: _("Keyboard"), body: missing });
  };

  return (
    <KeyboardLayoutSwitcher
      sideOffset={6}
      fallbackLayouts={systemServices ? undefined : CONFIG_LAYOUTS}
      value={keyboardLayout || "us"}
      onValueChange={(next) => updateSettings({ keyboardLayout: next })}
    >
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() =>
          void open(
            () => showKeyboardLayout(piloti, keyboardLayout || active || "us"),
            _("Install tecla to show the keyboard layout."),
          )
        }
      >
        {_("Show Keyboard Layout")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() =>
          void open(
            () => showOnScreenKeyboard(piloti),
            _("Install wvkbd or squeekboard to type on screen."),
          )
        }
      >
        {_("Show On-Screen Keyboard")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => launchApp("settings", { payload: "keyboard" })}>
        {_("Keyboard Settings…")}
      </DropdownMenuItem>
    </KeyboardLayoutSwitcher>
  );
}
