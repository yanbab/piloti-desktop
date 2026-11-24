import { describe, expect, test } from "bun:test";
import { readLoginShells } from "@/lib/engine-native/pty-bridge";

const ok = <T,>(v: T) => ({ match: (h: { Ok: (v: T) => unknown }) => h.Ok(v) });
const err = () => ({ match: (h: { Err: () => unknown }) => h.Err() });

function fakeDomicile(shells: string, installed: Record<string, string>) {
  return {
    files: {
      readText: async () => ok(shells),
      stat: async (p: string) => (p in installed ? ok({ realPath: installed[p] }) : err()),
    },
  } as never;
}

describe("login shells", () => {
  test("merges /bin and /usr/bin, sorts a-z, skips missing and nologin", async () => {
    const list = await readLoginShells(
      fakeDomicile(
        "# shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/dash\n/usr/bin/dash\n/usr/bin/zsh\n/usr/sbin/nologin\n/bin/fish\n",
        {
          "/bin/sh": "/usr/bin/dash",
          "/bin/bash": "/usr/bin/bash",
          "/usr/bin/bash": "/usr/bin/bash",
          "/bin/dash": "/usr/bin/dash",
          "/usr/bin/dash": "/usr/bin/dash",
          "/usr/bin/zsh": "/usr/bin/zsh",
        },
      ),
    );
    expect(list.map((s) => s.path)).toEqual(["/bin/bash", "/bin/sh", "/usr/bin/zsh"]);
    expect(list.every((s) => s.available)).toBe(true);
  });

  test("lists bash as unavailable when it is not installed", async () => {
    const list = await readLoginShells(fakeDomicile("/bin/sh\n", { "/bin/sh": "/usr/bin/dash" }));
    expect(list).toEqual([
      { path: "/bin/bash", available: false },
      { path: "/bin/sh", available: true },
    ]);
  });
});
