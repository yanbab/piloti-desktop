import * as React from "react";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings, useSystemBackends } from "@/context/DesktopStateContext";
import { playAlertSound } from "@/lib/sound-effects";

export function SoundPane() {
  const { settings, updateSettings } = useSettings();
  const { audioSinks, selectAudioSink, pushNotification } =
    useSystemBackends();
  const [outputDevice, setOutputDevice] = React.useState("speakers");

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Output & Volume</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Output Volume ({settings.muted ? "Muted" : `${settings.volume}%`})
              </GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-48">
              <Slider
                min={0}
                max={100}
                value={[settings.muted ? 0 : settings.volume]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number") {
                    updateSettings({ volume: next, muted: next === 0 });
                  }
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Mute All Audio</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.muted}
                onCheckedChange={(checked) =>
                  updateSettings({ muted: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Output Device</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              {audioSinks.length > 0 ? (
                <Select
                  value={
                    audioSinks.find((s) => s.active)?.name ?? audioSinks[0].name
                  }
                  onValueChange={(v) => v && void selectAudioSink(v)}
                >
                  <SelectTrigger variant="borderless">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audioSinks.map((sink) => (
                      <SelectItem key={sink.name} value={sink.name}>
                        {sink.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={outputDevice}
                  onValueChange={(v) => v && setOutputDevice(v)}
                >
                  <SelectTrigger variant="borderless">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="speakers">
                      Built-in Stereo Speakers (PipeWire)
                    </SelectItem>
                    <SelectItem value="headphones">
                      Studio Headphones (USB-C DAC)
                    </SelectItem>
                    <SelectItem value="hdmi">
                      HDMI / DisplayPort Audio Out
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Notification Sound Effects</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void playAlertSound(settings.volume, settings.muted);
                  pushNotification({
                    appName: "Sound Settings",
                    summary: "Audio Test Chime",
                    body: settings.muted
                      ? "Output is currently muted."
                      : `Output routing active at ${settings.volume}% volume.`,
                  });
                }}
              >
                Play Test Alert
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

