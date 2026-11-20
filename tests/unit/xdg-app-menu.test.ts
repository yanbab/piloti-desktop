import { describe, expect, test } from "bun:test";
import {
  buildSectionsFromGtkMenus,
  formatActionTitle,
  formatGtkAccel,
  parseDbusIntrospectXml,
  parseGtkActionsDescribeAll,
  parseGtkMenusStartResponse,
  stripGtkMnemonic,
} from "@/lib/xdg-app-menu";

describe("xdg-app-menu D-Bus parsers", () => {
  test("strips GTK mnemonics and formats GTK accelerator strings", () => {
    expect(stripGtkMnemonic("_File")).toBe("File");
    expect(stripGtkMnemonic("Save __As...")).toBe("Save _As...");

    expect(formatGtkAccel("<Primary>n")).toBe("Ctrl+N");
    expect(formatGtkAccel("<Control><Shift>t")).toBe("Ctrl+Shift+T");
    expect(formatGtkAccel("<Alt>bracketleft")).toBe("Alt+[");
  });

  test("parses D-Bus Introspect XML interfaces and child nodes", () => {
    const parsed = parseDbusIntrospectXml(`
      <node name="/org/gnome/Example">
        <interface name="org.freedesktop.DBus.Properties"/>
        <interface name="org.gtk.Actions"/>
        <interface name="org.gtk.Menus"/>
        <node name="menus"/>
        <node name="window"/>
      </node>
    `);

    expect(parsed.interfaces).toEqual([
      "org.freedesktop.DBus.Properties",
      "org.gtk.Actions",
      "org.gtk.Menus",
    ]);
    expect(parsed.childNodes).toEqual(["menus", "window"]);
  });

  test("parses org.gtk.Actions.DescribeAll and org.gtk.Menus.Start into Global Menu sections", () => {
    const actions = parseGtkActionsDescribeAll({
      "new-window": [true, "", []],
      "show-hidden": [true, "", [{ value: true }]],
      disabled: [false, "", []],
    });
    const prefixed = new Map(
      Array.from(actions.entries()).map(([k, v]) => [`app.${k}`, v])
    );

    const groups = parseGtkMenusStartResponse([
      [
        0,
        0,
        [
          { label: { value: "_File" }, ":submenu": { value: [1, 0] } },
          { label: { value: "_View" }, ":submenu": { value: [2, 0] } },
        ],
      ],
      [
        1,
        0,
        [
          {
            label: { value: "_New Window" },
            action: { value: "app.new-window" },
            accel: { value: "<Primary>n" },
          },
          { ":section": { value: [1, 1] } },
        ],
      ],
      [
        1,
        1,
        [
          {
            label: { value: "Unavailable" },
            action: { value: "app.disabled" },
          },
        ],
      ],
      [
        2,
        0,
        [
          {
            label: { value: "Show _Hidden Files" },
            action: { value: "app.show-hidden" },
          },
        ],
      ],
    ]);

    const triggered: string[] = [];
    const built = buildSectionsFromGtkMenus(groups, {
      actionsByFullName: prefixed,
      onActivate: (action) => {
        triggered.push(action);
      },
    });

    expect(built.sections.map((s) => s.title)).toEqual(["File", "View"]);
    expect(built.sections[0].items).toHaveLength(3);
    const fileItems = built.sections[0].items;
    expect(fileItems[0]).toMatchObject({
      kind: "item",
      label: "New Window",
      enabled: true,
      shortcut: "Ctrl+N",
    });
    expect(fileItems[1]).toMatchObject({ kind: "separator" });
    expect(fileItems[2]).toMatchObject({
      kind: "item",
      label: "Unavailable",
      enabled: false,
    });

    const viewItem = built.sections[1].items[0];
    expect(viewItem).toMatchObject({
      kind: "item",
      label: "Show Hidden Files",
      checked: true,
    });

    if (fileItems[0].kind === "item") {
      fileItems[0].activate?.();
    }
    expect(triggered).toEqual(["app.new-window"]);
    expect(formatActionTitle("app.new-window")).toBe("New Window");
  });
});

