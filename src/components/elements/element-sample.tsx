import * as React from "react";
import { Segmented } from "@/components/ui/segmented";
import { _ } from "@/lib/core/i18n";

// Set off from the card and its code, so elements stand out.
const PREVIEW =
  "flex min-w-0 flex-wrap content-center items-center justify-center gap-2 bg-black/6 p-3 dark:bg-white/7";

/** A column of samples: one pane of the demo. */
export function ElementSampleList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5 p-4">{children}</div>;
}

/**
 * One element: its preview on the left, the code that makes it on the right,
 * as React or, when it has plain CSS, as HTML. The preview follows the tab; the
 * HTML one is made from the very string shown, so the two can't drift apart.
 */
export function ElementSample({
  title,
  react,
  reactCode,
  html,
  controls,
}: {
  title: string;
  react: React.ReactNode;
  reactCode: string;
  html?: string;
  /** Options of the preview, e.g. the window's decorations. */
  controls?: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<"react" | "html">("react");
  const asHtml = tab === "html" && html !== undefined;
  return (
    <section data-element-sample={title} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 data-page-title-anchor="" className="text-ui-body font-semibold text-ui-label">{_(title)}</h3>
        {controls}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] overflow-hidden rounded-ui-box border border-ui-separator bg-ui-group">
        {asHtml ? (
          // Constant strings from this repository: never user content.
          <div className={PREVIEW} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className={PREVIEW}>{react}</div>
        )}
        <div className="min-w-0 border-l border-ui-separator">
          <pre className="max-h-64 min-h-12 overflow-auto p-3 font-mono text-ui-caption break-words whitespace-pre-wrap select-text">
            {/* Floated, so the first lines wrap around it instead of taking a row. */}
            {html !== undefined && (
              <span className="float-right -mt-1 -mr-1 ml-2 font-sans select-none">
                <Segmented
                  value={tab}
                  onChange={setTab}
                  options={[
                    { id: "react", label: "React" },
                    { id: "html", label: "HTML" },
                  ]}
                />
              </span>
            )}
            {asHtml ? html : reactCode}
          </pre>
        </div>
      </div>
    </section>
  );
}
