import { describe, expect, it } from "bun:test";
import { retainVfsWatch, vfsKeys, watchedVfsPaths } from "@/lib/engine/vfs-query";
import type { Vfs } from "@/lib/ports/vfs";
import { QueryClient } from "@tanstack/react-query";
import { createVfsCacheUpdater } from "@/lib/engine/vfs-cache";
import type { WebVfsEntry } from "@/lib/core/vfs-paths";

/** A Vfs whose watches are driven by hand. */
function fakeVfs() {
  const watches = new Map<string, Set<() => void>>();
  let started = 0;
  const vfs = {
    watch(path: string, onChange: () => void) {
      started += 1;
      if (!watches.has(path)) watches.set(path, new Set());
      watches.get(path)!.add(onChange);
      onChange(); // in place
      return () => watches.get(path)?.delete(onChange);
    },
  } as unknown as Vfs;
  return {
    vfs,
    started: () => started,
    active: (path: string) => watches.get(path)?.size ?? 0,
    change: (path: string) => watches.get(path)?.forEach((l) => l()),
  };
}

describe("retainVfsWatch", () => {
  it("shares one watch per path and stops it with the last view", () => {
    const fake = fakeVfs();
    const a: boolean[] = [];
    const b: boolean[] = [];
    const releaseA = retainVfsWatch(fake.vfs, "/home/user/Documents/", (i) => a.push(i));
    const releaseB = retainVfsWatch(fake.vfs, "/home/user/Documents", (i) => b.push(i));
    expect(fake.started()).toBe(1);
    expect(watchedVfsPaths(fake.vfs)).toEqual(["/home/user/Documents"]);

    fake.change("/home/user/Documents");
    expect(a).toEqual([true, false]);
    expect(b).toEqual([true, false]);

    releaseA();
    releaseA();
    expect(fake.active("/home/user/Documents")).toBe(1);
    releaseB();
    expect(fake.active("/home/user/Documents")).toBe(0);
    expect(watchedVfsPaths(fake.vfs)).toEqual([]);
  });

  it("gives a view joining before the watch is in place its first call then", () => {
    let place: () => void = () => {};
    const vfs = {
      watch(_path: string, onChange: () => void) {
        place = onChange;
        return () => {};
      },
    } as unknown as Vfs;
    const a: boolean[] = [];
    const b: boolean[] = [];
    retainVfsWatch(vfs, "/late", (i) => a.push(i));
    retainVfsWatch(vfs, "/late", (i) => b.push(i));
    expect([a, b]).toEqual([[], []]);
    place();
    place();
    expect([a, b]).toEqual([[true, false], [true, false]]);
  });

  it("starts a new watch after the last one stopped", () => {
    const fake = fakeVfs();
    retainVfsWatch(fake.vfs, "/a", () => {})();
    const calls: boolean[] = [];
    retainVfsWatch(fake.vfs, "/a", (i) => calls.push(i));
    expect(fake.started()).toBe(2);
    expect(calls).toEqual([true]);
  });

  it("keys the same path the same way", () => {
    expect(vfsKeys.list("/home/user/Documents/")).toEqual(vfsKeys.list("/home/user/Documents"));
    expect(vfsKeys.text("/a")).not.toEqual(vfsKeys.stat("/a"));
  });
});

describe("vfs cache updates", () => {
  const entry = (path: string, kind: "file" | "directory" = "file") =>
    ({ path, name: path.split("/").pop()!, kind, parentPath: path.slice(0, path.lastIndexOf("/")) }) as WebVfsEntry;

  it("patches cached listings at once and marks them stale", () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const cache = createVfsCacheUpdater(client);
    client.setQueryData(vfsKeys.list("/a"), [entry("/a/one"), entry("/a/two")]);
    client.setQueryData(vfsKeys.list("/b"), [entry("/b/three")]);

    cache.moved("/a/one", entry("/b/one"));
    expect(client.getQueryData<WebVfsEntry[]>(vfsKeys.list("/a"))!.map((e) => e.name)).toEqual(["two"]);
    expect(client.getQueryData<WebVfsEntry[]>(vfsKeys.list("/b"))!.map((e) => e.name)).toEqual(["three", "one"]);
    expect(client.getQueryState(vfsKeys.list("/a"))!.isInvalidated).toBe(true);

    cache.added(entry("/b/one"));
    expect(client.getQueryData<WebVfsEntry[]>(vfsKeys.list("/b"))!.length).toBe(2);
  });

  it("leaves listings nobody loaded alone", () => {
    const client = new QueryClient();
    const cache = createVfsCacheUpdater(client);
    cache.added(entry("/c/new"));
    cache.removed("/c/old");
    expect(client.getQueryData(vfsKeys.list("/c"))).toBeUndefined();
  });
});
