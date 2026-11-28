import { describe, expect, it } from "bun:test";
import { Ok } from "@cprussin/option-result";
import { entryCommand } from "@/lib/apps/entry-command";
import { createModuleApps } from "@/lib/apps/module-apps";
import type { AppsHost } from "@/lib/ports/apps";
import { parseDesktopEntry } from "@/lib/xdg/xdg-desktop-entry";

const entry = (extra = "") =>
  parseDesktopEntry(`[Desktop Entry]\nType=Application\nName=Edit\nExec=edit %F\n${extra}`, {
    filePath: "/usr/share/applications/edit.desktop",
    baseDir: "/usr/share/applications",
  })!;

/** One desktop file in `/usr/share/applications`; records the programs run. */
function fakeHost() {
  const ran: string[][] = [];
  const host = {
    files: {
      readDir: async (dir: string) =>
        Ok(dir === "/usr/share/applications" ? [{ name: "edit.desktop", fileType: 0 }] : []),
      readText: async () => Ok("[Desktop Entry]\nType=Application\nName=Edit\nExec=edit"),
      read: async () => Ok(new Uint8Array()),
    },
    processes: {
      run: async (argv: string[]) => {
        ran.push(argv);
        return Ok({ code: 0, stdout: "", stderr: "" });
      },
    },
  } as unknown as AppsHost;
  return { host, ran };
}

describe("apps", () => {
  it("builds an entry's command, in a terminal when it asks", () => {
    expect(entryCommand(entry(), undefined, ["/a"])?.argv).toEqual(["edit", "/a"]);
    const terminal = entry(
      "Terminal=true\nActions=new;\n[Desktop Action new]\nName=New\nExec=edit -n",
    );
    expect(entryCommand(terminal)?.argv).toEqual(["kitty", "-e", "edit"]);
    expect(entryCommand(terminal, "new")?.argv).toEqual(["kitty", "-e", "edit", "-n"]);
  });

  it("lists apps from outside the shell", async () => {
    const { host } = fakeHost();
    expect((await createModuleApps(host).list()).map((a) => a.name)).toEqual(["Edit"]);
  });

  it("asks the shell to open an app", async () => {
    const { host, ran } = fakeHost();
    createModuleApps(host).launch("texts", { payload: "/a b.txt" });
    expect(ran).toEqual([["piloti", "open", "texts", "/a b.txt"]]);
  });
});
