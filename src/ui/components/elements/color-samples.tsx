import { ElementSample, ElementSampleList } from "@/ui/components/elements/element-sample";

const SYSTEM_COLORS = [
  "accent", "blue", "indigo", "purple", "pink", "red", "orange", "yellow",
  "green", "mint", "teal", "cyan", "gray", "brown",
];
const LABEL_TOKENS = ["label", "label-secondary", "label-tertiary", "label-quaternary"];
const SURFACE_TOKENS = ["window", "group", "sidebar", "overlay", "control", "fill-primary", "separator"];
const RADIUS_TOKENS = ["control", "box", "window"];
const HEIGHT_TOKENS = ["small", "medium", "large"];

const short = (token: string) => token.replace("label-", "");

function swatches(title: string, tokens: string[], round = false) {
  const radius = round ? "9999px" : "var(--ui-radius-control)";
  return (
    <ElementSample
      title={title}
      react={tokens.map((t) => (
        <div key={t} className="flex w-16 flex-col items-center gap-1">
          <span
            className="size-8 shadow-[inset_0_0_0_1px_var(--ui-border)]"
            style={{ background: `var(--ui-${t})`, borderRadius: radius }}
          />
          <span className="w-full truncate text-center text-ui-caption text-ui-label-secondary">{short(t)}</span>
        </div>
      ))}
      reactCode={tokens.map((t) => `<span className="bg-ui-${t}" />`).join("\n")}
      html={tokens
        .map((t) => `<span title="${short(t)}" style="width: 2rem; height: 2rem; border-radius: ${radius}; background: var(--ui-${t})"></span>`)
        .join("\n")}
    />
  );
}

/** The theme's colour and shape tokens. */
export function ColorSamples() {
  return (
    <ElementSampleList>
      {swatches("System colours", SYSTEM_COLORS, true)}
      {swatches("Labels", LABEL_TOKENS)}
      {swatches("Surfaces", SURFACE_TOKENS)}
      <ElementSample
        title="Corner radii"
        react={RADIUS_TOKENS.map((t) => (
          <div key={t} className="flex flex-col items-center gap-1">
            <span
              className="size-12 bg-ui-fill-primary shadow-[inset_0_0_0_1px_var(--ui-border)]"
              style={{ borderRadius: `var(--ui-radius-${t})` }}
            />
            <span className="text-ui-caption text-ui-label-secondary">{t}</span>
          </div>
        ))}
        reactCode={RADIUS_TOKENS.map((t) => `<div className="rounded-ui-${t}" />`).join("\n")}
        html={RADIUS_TOKENS.map((t) => `<span title="${t}" style="width: 3rem; height: 3rem; background: var(--ui-fill-primary); border-radius: var(--ui-radius-${t})"></span>`).join("\n")}
      />
      <ElementSample
        title="Control heights"
        react={HEIGHT_TOKENS.map((t) => (
          <span
            key={t}
            className="flex w-16 items-center justify-center rounded-ui-control bg-ui-control text-ui-caption text-ui-label-secondary"
            style={{ height: `var(--ui-control-${t})` }}
          >
            {t}
          </span>
        ))}
        reactCode={HEIGHT_TOKENS.map((t) => `<div className="h-ui-control-${t}" />`).join("\n")}
        html={HEIGHT_TOKENS.map((t) => `<span style="width: 4rem; height: var(--ui-control-${t}); background: var(--ui-control)">${t}</span>`).join("\n")}
      />
    </ElementSampleList>
  );
}
