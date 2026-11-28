import { describe, expect, test } from "bun:test";
import { latestRunner } from "@/lib/plugins/latest-run";

describe("latestRunner", () => {
  test("never overlaps, and folds calls made meanwhile into the last one", async () => {
    const seen: number[] = [];
    let running = 0;
    let most = 0;
    const run = latestRunner(async (n: number) => {
      most = Math.max(most, ++running);
      await new Promise((r) => setTimeout(r, 10));
      seen.push(n);
      running -= 1;
    });
    run(1);
    run(2);
    run(3);
    await new Promise((r) => setTimeout(r, 60));
    expect(seen).toEqual([1, 3]);
    expect(most).toBe(1);
  });
});
