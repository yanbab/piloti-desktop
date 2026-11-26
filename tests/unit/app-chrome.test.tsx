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
import { Window } from "@/components/ui/window";

function render(
  layout: string,
  decorations: Decorations,
  {
    edges = "both",
    content = true,
    interactive = false,
  }: { edges?: HeaderEdges; content?: boolean; interactive?: boolean } = {},
) {
  return renderToStaticMarkup(
    <Window buttonLayout={layout}>
      <AppChromeProvider
        value={{ appId: "t", decorations, menu: <i>MENU</i>, insets: { left: 40, right: 70 } }}
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
    ["close:", ["Close", "MENU", "START", "TITLE", "END"]],
    [":close", ["MENU", "START", "TITLE", "END", "Close"]],
    ["appmenu:minimize,maximize,close", ["MENU", "START", "TITLE", "END", "Minimize", "Maximize", "Close"]],
    ["close:minimize", ["Close", "MENU", "START", "TITLE", "END", "Minimize"]],
  ])("client decorations, layout %s", (layout, expected) => {
    expect(order(render(layout, "client"))).toEqual(expected);
  });

  test("server decorations: a toolbar without controls, title or drag region", () => {
    const html = render("close:", "server");
    expect(order(html)).toEqual(["MENU", "START", "END"]);
    expect(html).not.toContain('data-window-drag-region=""');
    expect(order(render("close:", "server", { interactive: true }))).toContain("TITLE");
  });

  test("server decorations: nothing at all when only the title is left", () => {
    expect(render("close:", "server", { content: false })).not.toContain('data-slot="window-titlebar"');
  });

  test("host decorations: room for the shell's controls, none of its own", () => {
    const html = render("close:", "host");
    expect(order(html)).toEqual(["MENU", "START", "TITLE", "END"]);
    expect(html).toContain("padding-left:40px;padding-right:70px");
  });

  test.each([
    ["start", ["Close", "MENU", "START", "TITLE", "END"]],
    ["end", ["START", "TITLE", "END", "Minimize"]],
    ["none", ["START", "TITLE", "END"]],
    ["inset", ["Close", "MENU", "START", "TITLE", "END", "Minimize"]],
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
