import { describe, expect, test } from "bun:test";
import {
  formatWebGlRenderer,
  parseCpuInfo,
  parseMemTotalGiB,
  parseOsReleasePrettyName,
} from "@/core/system/system-info";

describe("system-info parsers", () => {
  test("parses /proc/cpuinfo model and core count", () => {
    const sample = [
      "processor\t: 0",
      "model name\t: Intel(R) Core(TM) i5-7360U CPU @ 2.30GHz",
      "",
      "processor\t: 1",
      "model name\t: Intel(R) Core(TM) i5-7360U CPU @ 2.30GHz",
    ].join("\n");

    expect(parseCpuInfo(sample)).toBe("Intel Core i5-7360U (2 cores)");
  });

  test("parses /proc/meminfo MemTotal into rounded GiB", () => {
    expect(parseMemTotalGiB("MemTotal:       16384000 kB\n")).toBe("16 GiB");
    expect(parseMemTotalGiB("MemTotal:        8123456 kB\n")).toBe("7.7 GiB");
    expect(parseMemTotalGiB("MemAvailable:    4000000 kB\n")).toBeNull();
  });

  test("parses PRETTY_NAME from /etc/os-release", () => {
    const sample = `NAME="Debian GNU/Linux"\nPRETTY_NAME="Debian GNU/Linux trixie/sid"\n`;
    expect(parseOsReleasePrettyName(sample)).toBe("Debian GNU/Linux trixie/sid");
  });

  test("strips ANGLE wrapper noise from WebGL renderer strings", () => {
    expect(
      formatWebGlRenderer(
        "ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)"
      )
    ).toBe("Apple M2 Pro");
  });
});

