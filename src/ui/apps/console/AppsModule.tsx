/**
 * Devtools ▸ Apps: which apps run in their own process, and what each way
 * costs in start time and memory.
 */
import * as React from "react";
import { APP_CATALOG } from "@/core/data/catalog";
import { getAppSettingsVersion, subscribeAppSettings } from "@/core/config/app-settings";
import { _ } from "@/core/util/i18n";
import {
  appTimings,
  getAppTimingsVersion,
  logAppLaunch,
  recordAppReady,
  subscribeAppTimings,
  type AppTiming,
} from "@/core/util/perf-log";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { getRunIn, ISOLATABLE_APPS, setRunIn } from "@/core/windows/run-mode";
import { usePiloti } from "@/platform/shared/piloti";
import { readRendererMemory, type RendererMemory } from "@/platform/shared/system-commands";
import { Button } from "@/ui/components/ui/button";
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
} from "@/ui/components/ui/grouped-form";
import { Switch } from "@/ui/components/ui/switch";
import { useApps, useWindowActions } from "@/ui/context/DesktopStateContext";
import { useCapabilities } from "@/ui/hooks/use-capabilities";

const megabytes = (kb: number) => `${kb < 0 ? "−" : "+"}${Math.round(Math.abs(kb) / 1024)} MB`;

/** The last start of an app one way: `640 ms · +145 MB (3 starts)`. */
export function describeStarts(timings: readonly AppTiming[]): string {
  const last = timings[timings.length - 1];
  if (!last) return "—";
  const memory =
    last.memoryKb === undefined
      ? ""
      : ` · ${last.pid ? `${Math.round(last.memoryKb / 1024)} MB` : megabytes(last.memoryKb)}`;
  const best = Math.min(...timings.map((t) => t.ms));
  const count = timings.length > 1 ? ` (${_("best %d ms of %d", best, timings.length)})` : "";
  return `${last.ms} ms${memory}${count}`;
}

/** A Linux program measured the same way, to compare with. */
const NATIVE_APP = "org.gnome.Calculator";

function NativeComparison() {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
  const { installedXdgApps, launchXdgEntry } = useApps();
  const clients = useWatch(piloti.windows, "change", () => piloti.windows.list);
  React.useSyncExternalStore(subscribeAppTimings, getAppTimingsVersion);
  /** The windows there were when Open was pressed. */
  const waiting = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    const known = waiting.current;
    if (!known) return;
    const opened = clients?.find(
      (c) => !known.has(c.appId) && c.desktopId.toLowerCase().includes("calculator"),
    );
    if (!opened) return;
    waiting.current = null;
    recordAppReady(NATIVE_APP, true, opened.pid ?? undefined);
  }, [clients]);

  const entry = installedXdgApps.find((a) => a.appId === NATIVE_APP);
  const timings = appTimings().filter((t) => t.appId === NATIVE_APP);
  const open = () => {
    if (!entry) return;
    waiting.current = new Set(clients?.map((c) => c.appId));
    logAppLaunch(NATIVE_APP);
    launchXdgEntry(entry);
  };

  return (
    <GroupedFormSection>
      <GroupedFormSectionTitle>{_("To compare with")}</GroupedFormSectionTitle>
      <GroupedFormGroup>
        <GroupedFormRow>
          <GroupedFormRowLabel>
            <GroupedFormRowTitle>GNOME Calculator</GroupedFormRowTitle>
            <GroupedFormRowDescription>
              {entry
                ? _("Window shown: %s", describeStarts(timings))
                : systemServices
                  ? _("Not installed (gnome-calculator)")
                  : _("Only measured on Linux")}
              <br />
              {_("Close it before opening it again. Its memory is its whole process.")}
            </GroupedFormRowDescription>
          </GroupedFormRowLabel>
          <GroupedFormRowControl>
            <Button type="button" size="sm" variant="secondary" disabled={!entry || !systemServices} onClick={open}>
              {_("Open")}
            </Button>
          </GroupedFormRowControl>
        </GroupedFormRow>
      </GroupedFormGroup>
    </GroupedFormSection>
  );
}

export function AppsModule() {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
  const { launchApp } = useWindowActions();
  React.useSyncExternalStore(subscribeAppSettings, getAppSettingsVersion);
  React.useSyncExternalStore(subscribeAppTimings, getAppTimingsVersion);
  const [renderers, setRenderers] = React.useState<RendererMemory | null>(null);
  const measure = React.useCallback(() => {
    if (systemServices) void readRendererMemory(piloti).then(setRenderers);
  }, [piloti, systemServices]);
  React.useEffect(measure, [measure]);

  const timings = appTimings();
  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Run in their own process")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          {ISOLATABLE_APPS.map((id) => {
            const name = _(APP_CATALOG.find((a) => a.id === id)?.name ?? id);
            const of = (separate: boolean) =>
              describeStarts(timings.filter((t) => t.appId === id && t.separate === separate));
            return (
              <GroupedFormRow key={id}>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>{name}</GroupedFormRowTitle>
                  <GroupedFormRowDescription>
                    {_("In the shell: %s", of(false))}
                    <br />
                    {_("Separate: %s", of(true))}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
                <GroupedFormRowControl className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => launchApp(id, { forceNew: true })}>
                    {_("Open")}
                  </Button>
                  <Switch
                    aria-label={_("Run %s separately", name)}
                    checked={getRunIn(id) === "isolated"}
                    onCheckedChange={(checked) => setRunIn(id, checked ? "isolated" : "shell")}
                  />
                </GroupedFormRowControl>
              </GroupedFormRow>
            );
          })}
        </GroupedFormGroup>
      </GroupedFormSection>
      <NativeComparison />
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Measures")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Renderer processes")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {renderers
                  ? _("%d processes, %d MB in all", renderers.count, Math.round(renderers.totalKb / 1024))
                  : _("Only measured on Linux")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button type="button" size="sm" variant="secondary" disabled={!systemServices} onClick={measure}>
                {_("Refresh")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowDescription>
              {_("Time is from the request to the app being drawn. Memory is what all renderers grew by, three seconds later: an estimate.")}
            </GroupedFormRowDescription>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
