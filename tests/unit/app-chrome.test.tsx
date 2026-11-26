import { describe, expect, test } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppChromeProvider,
  HeaderEdgesContext,
  hostControlInsets,
  type Decorations,
  type HeaderEdges,
} from "@/components/elements/app-chrome";
import { HeaderBar } from "@/components/elements/header-bar";
import { isCloseOnLeft, Window } from "@/components/ui/window";

function render(
  layout: string,
  decorations: Decorations,
  {
    edges = "both",
    content = true,
    interactive = false,
  }: { edges?: HeaderEdges; content?: boolean; interactive?: boolean } = {},
) {
  // As the window menu button does: only opposite the Close button.
  const menuSide = isCloseOnLeft(layout) ? "right" : "left";
  const menu = (side: "left" | "right") => (side === menuSide ? <i>MENU</i> : null);
  return renderToStaticMarkup(
    <Window buttonLayout={layout}>
      <AppChromeProvider
        value={{ appId: "t", decorations, menu, insets: { left: 40, right: 70 } }}
      >
        <HeaderEdgesContext.Provider value={edges}>
          <HeaderBar>
            {content && <HeaderBar.Start>START</HeaderBar.Start>}
            <HeaderBar.Title interactive={interactive}>TITLE</HeaderBar.Title>
            {content && <HeaderBar.End>END</HeaderBar.End>}
          </HeaderBar>
        </HeaderEdgesContext.Provider>
      </AppChromeProvider>
    </Window>,
  );
}

/** What the header shows, left to right. */
function order(html: string) {
  return [...html.matchAll(/aria-label="(Close|Minimize|Maximize)"|>(MENU|START|TITLE|END)</g)].map(
    (m) => m[1] ?? m[2],
  );
}

describe("HeaderBar", () => {
  test.each([
    ["close:", ["Close", "START", "TITLE", "END", "MENU"]],
    [":close", ["MENU", "START", "TITLE", "END", "Close"]],
    ["appmenu:minimize,maximize,close", ["MENU", "START", "TITLE", "END", "Minimize", "Maximize", "Close"]],
    ["close:minimize", ["Close", "START", "TITLE", "END", "MENU", "Minimize"]],
  ])("client decorations, layout %s", (layout, expected) => {
    expect(order(render(layout, "client"))).toEqual(expected);
  });

  test("server decorations: a toolbar without controls, title or drag region", () => {
    const html = render("close:", "server");
    expect(order(html)).toEqual(["START", "END", "MENU"]);
    expect(html).not.toContain('data-window-drag-region=""');
    expect(order(render("close:", "server", { interactive: true }))).toContain("TITLE");
  });

  test("server decorations: nothing at all when only the title is left", () => {
    expect(render("close:", "server", { content: false })).not.toContain('data-slot="window-titlebar"');
  });

  test("host decorations: room for the shell's controls, none of its own", () => {
    const html = render("close:", "host");
    expect(order(html)).toEqual(["START", "TITLE", "END", "MENU"]);
    // The same on both sides, so the title is centred.
    expect(html).toContain("padding-left:70px;padding-right:70px");
  });

  test.each([
    ["start", ["Close", "START", "TITLE", "END"]],
    ["end", ["START", "TITLE", "END", "MENU", "Minimize"]],
    ["none", ["START", "TITLE", "END"]],
    ["inset", ["Close", "START", "TITLE", "END", "MENU", "Minimize"]],
  ] as const)("a header at the %s edge only draws that side", (edges, expected) => {
    expect(order(render("close:minimize", "client", { edges }))).toEqual([...expected]);
  });
});

describe("hostControlInsets", () => {
  test("room for the buttons on each side", () => {
    expect(hostControlInsets(":close")).toEqual({ left: 9, right: 46 });
    expect(hostControlInsets("close,minimize,maximize:")).toEqual({ left: 110, right: 9 });
  });
});
