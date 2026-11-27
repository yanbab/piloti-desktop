import * as React from "react";
import { PortalTestButtons } from "@/components/elements/portal-test-buttons";
import { LoginScreenApp } from "@/apps/login/LoginScreenApp";
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
import { FileChangedDialog, UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { useSystemBackends, useWindowActions } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <GroupedFormRow>
      <GroupedFormRowLabel>
        <GroupedFormRowTitle>{title}</GroupedFormRowTitle>
        {hint && <GroupedFormRowDescription>{hint}</GroupedFormRowDescription>}
      </GroupedFormRowLabel>
      <GroupedFormRowControl className="flex flex-wrap items-center gap-1.5">{children}</GroupedFormRowControl>
    </GroupedFormRow>
  );
}

/** Every dialog the shell can show, opened on demand. */
export function DialogsPage() {
  const { lockSession, requestPowerAction, pushNotification } = useSystemBackends();
  const { setAboutOpen } = useWindowActions();
  const [shown, setShown] = React.useState<"unsaved" | "changed" | "login" | null>(null);
  const close = () => setShown(null);
  const action = (label: string, onClick: () => void) => (
    <Button size="sm" variant="secondary" onClick={onClick}>
      {label}
    </Button>
  );

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Portals")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <PortalTestButtons />
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Session")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <Row title={_("Login screen")} hint={_("A preview, shown below")}>
            {action(shown === "login" ? _("Hide") : _("Show"), () => setShown(shown === "login" ? null : "login"))}
          </Row>
          <Row title={_("Lock Screen")}>{action(_("Show"), () => lockSession())}</Row>
          <Row title={_("Power")} hint={_("Confirming really ends the session on Linux")}>
            {action(_("Log Out…"), () => requestPowerAction("logout"))}
            {action(_("Restart…"), () => requestPowerAction("restart"))}
            {action(_("Turn Off…"), () => requestPowerAction("poweroff"))}
          </Row>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Shell and apps")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <Row title={_("About Computer")}>{action(_("Show"), () => setAboutOpen(true))}</Row>
          <Row title={_("Unsaved changes")}>{action(_("Show"), () => setShown("unsaved"))}</Row>
          <Row title={_("File Changed on Disk")}>{action(_("Show"), () => setShown("changed"))}</Row>
          <Row title={_("Notification")}>
            {action(_("Normal"), () =>
              pushNotification({ appName: "Piloti", summary: _("Test notification"), body: _("A normal notification.") }),
            )}
            {action(_("Urgent"), () =>
              pushNotification({
                appName: "Piloti",
                summary: _("Test notification"),
                body: _("An urgent notification."),
                urgency: "critical",
              }),
            )}
          </Row>
        </GroupedFormGroup>
      </GroupedFormSection>

      {shown === "login" && (
        <div className="relative flex h-[32rem] shrink-0 flex-col overflow-hidden">
          <LoginScreenApp />
        </div>
      )}
      {/* These cover the window they are in. */}
      {shown === "unsaved" && <UnsavedChangesDialog onSave={close} onDiscard={close} onCancel={close} />}
      {shown === "changed" && <FileChangedDialog onOverwrite={close} onReload={close} onCancel={close} />}
    </GroupedForm>
  );
}
