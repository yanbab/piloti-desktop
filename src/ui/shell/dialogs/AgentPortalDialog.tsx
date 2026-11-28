import * as React from "react";
import { PortalAnswer, PortalKind, type PortalRequest } from "@domicile-desktop/sdk/portal";
import { Button } from "@/ui/components/ui/button";
import { _ } from "@/core/util/i18n";

/**
 * An agent (`domicile mcp`) asks to see and use the desktop. Nothing is granted
 * by default: Allow waits for a choice.
 */
export function AgentPortalDialog({
  request,
  onAnswer,
}: {
  request: Extract<PortalRequest, { kind: PortalKind.Agent }>;
  onAnswer: (ans: PortalAnswer) => void;
}) {
  const { agent, windows, current, remembered } = request.body;
  const [reach, setReach] = React.useState<"desk" | "windows" | null>(current?.kind ?? null);
  const [checked, setChecked] = React.useState<ReadonlySet<string>>(
    () => new Set(current?.kind === "windows" ? current.windows.map((w) => w.id) : []),
  );
  const [remember, setRemember] = React.useState(remembered);
  const chosen = windows.filter((w) => checked.has(w.id));
  const ready = reach === "desk" || (reach === "windows" && chosen.length > 0);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-portal-title"
        className="w-full max-w-[400px] rounded-ui-box p-5 text-ui-label shadow-ui-menu ui-material-menu"
      >
        <h3 id="agent-portal-title" className="text-ui-body font-bold">
          {_("Let “%s” use your desktop?", agent)}
        </h3>
        <p className="mt-1 text-ui-small text-ui-label-secondary">
          {_("This program would see your screen and act for you. Its name is not verified.")}
        </p>
        <div className="mt-3 space-y-1.5 text-ui-body">
          <label className="flex items-center gap-2">
            <input type="radio" name="agent-reach" checked={reach === "desk"} onChange={() => setReach("desk")} />
            <span>{_("Entire desktop, with the keyboard and pointer")}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="agent-reach"
              checked={reach === "windows"}
              disabled={windows.length === 0}
              onChange={() => setReach("windows")}
            />
            <span>{_("Only the windows you check")}</span>
          </label>
          {reach === "windows" && (
            <div className="max-h-40 space-y-1 overflow-y-auto pl-6">
              {windows.map((w) => (
                <label key={w.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={checked.has(w.id)} onChange={() => toggle(w.id)} />
                  <span className="truncate">{w.title || w.app || w.id}</span>
                </label>
              ))}
            </div>
          )}
          {reach === "desk" && (
            <label className="flex items-center gap-2 pt-1 text-ui-small">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>{_("Don’t ask again for this name")}</span>
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="secondary" autoFocus onClick={() => onAnswer(PortalAnswer.Canceled())}>
            {current ? _("Cancel") : _("Deny")}
          </Button>
          <Button
            size="sm"
            disabled={!ready}
            onClick={() =>
              onAnswer(
                reach === "desk"
                  ? PortalAnswer.Agent({ kind: "desk" }, remember)
                  : PortalAnswer.Agent({ kind: "windows", windows: chosen }),
              )
            }
          >
            {_("Allow")}
          </Button>
        </div>
      </div>
    </div>
  );
}
