import { describe, expect, it } from "bun:test";
import { watchNativeDir } from "@/lib/engine-native/file-watch";

type Files = Parameters<typeof watchNativeDir>[0];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ok = <T,>(v: T) => ({ match: <R,>(h: { Ok: (v: T) => R; Err: (e: unknown) => R }) => h.Ok(v) });
const err = () => ({ match: <R,>(h: { Ok: (v: never) => R; Err: (e: unknown) => R }) => h.Err("nope") });

describe("watchNativeDir", () => {
  it("debounces watch events into one onChange", async () => {
    let push: (p: string) => void = () => {};
    let stopped = false;
    const items = new ReadableStream<string>({ start(c) { push = (p) => c.enqueue(p); } });
    const files = { watch: async () => ok({ items, stop: () => { stopped = true; }, ended: new Promise(() => {}) }) } as unknown as Files;
    let calls = 0;
    const stop = watchNativeDir(files, "Desktop", () => { calls += 1; }, { debounceMs: 20 });
    await sleep(5);
    push("/home/u/Desktop/a"); push("/home/u/Desktop/b"); push("/home/u/Desktop/c");
    await sleep(60);
    expect(calls).toBe(1);
    stop();
    expect(stopped).toBe(true);
  });

  it("falls back to polling when the watch is refused", async () => {
    const files = { watch: async () => err() } as unknown as Files;
    let calls = 0;
    const stop = watchNativeDir(files, "Desktop", () => { calls += 1; }, { fallbackPollMs: 15 });
    await sleep(70);
    stop();
    const after = calls;
    expect(after).toBeGreaterThanOrEqual(2);
    await sleep(40);
    expect(calls).toBe(after);
  });
});
