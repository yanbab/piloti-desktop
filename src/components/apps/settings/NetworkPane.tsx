import { CheckIcon, SignalHighIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowDescription,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import { Switch } from "@/components/ui/switch";
import { useSettings, useSystemBackends } from "@/context/DesktopStateContext";

export function NetworkPane() {
  const { settings, updateSettings } = useSettings();
  const { gnomeCapabilities, liveWifiNetworks, connectWifiNetwork } =
    useSystemBackends();

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Wireless Adapter</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Wi-Fi</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {settings.wifiEnabled
                  ? `Connected to ${settings.connectedWifi} · WPA3 Personal`
                  : "Wireless networking is turned off"}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.wifiEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ wifiEnabled: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      {settings.wifiEnabled && (
        <GroupedFormSection>
          <GroupedFormSectionTitle>
            {gnomeCapabilities.networkManager
              ? "Wi-Fi Networks (NetworkManager)"
              : "Known & Nearby Networks"}
          </GroupedFormSectionTitle>
          <GroupedFormGroup>
            {liveWifiNetworks.map((net) => {
              const connected = settings.connectedWifi === net.ssid;
              return (
                <GroupedFormRow key={net.ssid}>
                  <GroupedFormRowLabel>
                    <GroupedFormRowTitle className="flex items-center gap-2 font-medium">
                      <SignalHighIcon className="size-4 text-mac-accent" />
                      <span>{net.ssid}</span>
                      {connected && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          Connected
                        </span>
                      )}
                    </GroupedFormRowTitle>
                    <GroupedFormRowDescription>
                      {net.band} · Signal {net.signal}%
                      {net.ipAddress ? ` · IP ${net.ipAddress}` : ""}
                    </GroupedFormRowDescription>
                  </GroupedFormRowLabel>
                  <GroupedFormRowControl>
                    {connected ? (
                      <CheckIcon className="size-4 text-mac-accent" />
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void connectWifiNetwork(net.ssid)}
                      >
                        Connect
                      </Button>
                    )}
                  </GroupedFormRowControl>
                </GroupedFormRow>
              );
            })}
          </GroupedFormGroup>
        </GroupedFormSection>
      )}
    </GroupedForm>
  );
}

