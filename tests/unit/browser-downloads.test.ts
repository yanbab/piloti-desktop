import { describe, expect, it } from "bun:test";
import { DownloadState, type Download } from "@domicile-desktop/sdk/desktop/downloads";
import {
  downloadsProgress,
  formatDownloadSize,
  freeDownloadPath,
  numberedFileName,
} from "@/ui/shell/windows/browser-downloads";

const dl = (state: DownloadState, receivedBytes: number, totalBytes: number): Download => ({
  id: String(Math.random()),
  page: "",
  path: "/home/u/Downloads/x",
  receivedBytes,
  state,
  totalBytes,
  window: undefined,
});

describe("browser downloads", () => {
  it("numbers a name before its extension", () => {
    expect(numberedFileName("report.pdf", 0)).toBe("report.pdf");
    expect(numberedFileName("report.pdf", 2)).toBe("report (2).pdf");
    expect(numberedFileName("archive.tar.gz", 1)).toBe("archive (1).tar.gz");
    expect(numberedFileName(".bashrc", 1)).toBe(".bashrc (1)");
    expect(numberedFileName("README", 1)).toBe("README (1)");
  });

  it("finds a free path, skipping files and running downloads", async () => {
    const existing = new Set(["/d/a.txt"]);
    const exists = async (p: string) => existing.has(p);
    expect(await freeDownloadPath("/d/", "a.txt", exists)).toBe("/d/a (1).txt");
    expect(await freeDownloadPath("/d", "a.txt", exists, new Set(["/d/a (1).txt"]))).toBe("/d/a (2).txt");
    expect(await freeDownloadPath("/d", "../x/y", exists)).toBe("/d/.._x_y");
    expect(await freeDownloadPath("/d", "  ", exists)).toBe("/d/download");
  });

  it("sums the running downloads' progress", () => {
    expect(downloadsProgress([])).toBeUndefined();
    expect(downloadsProgress([dl(DownloadState.Complete, 5, 5)])).toBeUndefined();
    expect(downloadsProgress([dl(DownloadState.InProgress, 1, 4), dl(DownloadState.InProgress, 3, 4)])).toBe(0.5);
    expect(downloadsProgress([dl(DownloadState.InProgress, 1, 0)])).toBeNull();
  });

  it("formats sizes", () => {
    expect(formatDownloadSize(512)).toBe("512 B");
    expect(formatDownloadSize(12_400_000)).toBe("12.4 MB");
    expect(formatDownloadSize(250_000)).toBe("250 KB");
  });
});
