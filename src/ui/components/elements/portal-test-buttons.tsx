import { Button } from "@/ui/components/ui/button";
import { useSystemBackends } from "@/ui/context/DesktopStateContext";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { _ } from "@/core/util/i18n";
import { usePiloti } from "@/platform/shared/piloti";
import { runPortalRequest } from "@/platform/shared/system-commands";
import { PORTAL_TESTS } from "@/core/portals/portal-tests";

/** One button per portal dialog. */
export function PortalTestButtons() {
  const piloti = usePiloti();
  const { simulatedHardware } = useCapabilities();
  const { pushNotification } = useSystemBackends();

  const run = async (id: string) => {
    if (simulatedHardware) {
      window.__PILOTI_PORTALS__?.open(id);
      return;
    }
    const error = await runPortalRequest(piloti, id);
    if (error) pushNotification({ appName: "Piloti", summary: _("Portal request failed"), body: error });
  };

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {PORTAL_TESTS.filter((test) => simulatedHardware || !test.demoOnly).map((test) => (
        <Button key={test.id} size="sm" variant="secondary" onClick={() => void run(test.id)}>
          {_(test.label)}
        </Button>
      ))}
    </div>
  );
}
