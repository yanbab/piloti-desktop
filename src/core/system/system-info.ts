import { runText } from "@/platform/shared/system-commands";
import { hostFiles } from "@/platform/shared/host-files";
import type { Piloti } from "@/core/ports/piloti";

export interface ComputerInfo {
  computerName: string;
  modelSubtitle: string;
  processor: string;
  graphics: string;
  memory: string;
  osName: string;
  kernel?: string;
}

/**
 * Extracts a concise CPU description (e.g. "Intel Core i5 (8 cores)")
 * from Linux `/proc/cpuinfo`.
 */
export function parseCpuInfo(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  let model: string | null = null;
  let coreCount = 0;

  for (const line of lines) {
    if (line.startsWith("processor\t") || line.startsWith("processor ")) {
      coreCount += 1;
      continue;
    }
    if (!model) {
      const match = line.match(/^(?:model name|Hardware|Processor)\s*:\s*(.+)$/i);
      if (match?.[1]) {
        model = match[1]
          .replace(/\(R\)|\(TM\)|CPU\s*@.*$/gi, "")
          .replace(/\s+/g, " ")
          .trim();
      }
    }
  }

  if (!model && coreCount === 0) return null;
  if (!model) return `${coreCount} cores`;
  return coreCount > 1 ? `${model} (${coreCount} cores)` : model;
}

/**
 * Extracts formatted total RAM (e.g. "16 GiB") from Linux `/proc/meminfo`.
 */
export function parseMemTotalGiB(raw: string): string | null {
  const match = raw.match(/^MemTotal:\s+(\d+)\s+kB/m);
  if (!match?.[1]) return null;
  const kb = Number.parseInt(match[1], 10);
  if (!Number.isFinite(kb) || kb <= 0) return null;
  const gib = kb / (1024 * 1024);
  if (gib >= 1) {
    const rounded = gib >= 8 ? Math.round(gib) : Math.round(gib * 10) / 10;
    return `${rounded} GiB`;
  }
  const mib = Math.round(kb / 1024);
  return `${mib} MiB`;
}

/**
 * Extracts `PRETTY_NAME` or `NAME` from `/etc/os-release`.
 */
export function parseOsReleasePrettyName(raw: string): string | null {
  const pretty = raw.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1]?.trim();
  if (pretty) return pretty;
  const name = raw.match(/^NAME="?([^"\n]+)"?/m)?.[1]?.trim();
  return name || null;
}

/**
 * Normalizes WebGL `UNMASKED_RENDERER_WEBGL` strings (strips ANGLE wrapper noise).
 */
export function formatWebGlRenderer(raw: string): string {
  const angleMatch = raw.match(/^ANGLE\s*\([^,]+,\s*([^,(]+)/i);
  const inner = angleMatch?.[1] ?? raw;
  return inner.replace(/\s+Direct3D.*$|\s+OpenGL.*$/i, "").trim() || raw.trim();
}

function detectBrowserGraphics(): string {
  if (typeof document === "undefined") return "Virtual GPU";
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl || !("getParameter" in gl)) return "Web Compositor";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (typeof renderer === "string" && renderer.trim()) {
        return formatWebGlRenderer(renderer);
      }
    }
    const basic = gl.getParameter(gl.RENDERER);
    if (typeof basic === "string" && basic.trim()) {
      return formatWebGlRenderer(basic);
    }
  } catch {
    // Ignore restricted WebGL contexts
  }
  return "Web Compositor";
}

async function readTextSafe(
  piloti: Piloti,
  path: string
): Promise<string | null> {
  try {
    const res = await hostFiles(piloti).readText(path);
    return res.match({
      Ok: (txt) => txt.trim() || null,
      Err: () => null,
    });
  } catch {
    return null;
  }
}

/** A command's trimmed output; `null` if it failed or said nothing. */
const runTextSafe = async (piloti: Piloti, argv: string[]): Promise<string | null> =>
  (await runText(piloti, argv).catch(() => null))?.trim() || null;

function getBrowserFallbackInfo(): ComputerInfo {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const navExt = nav as
    | (Navigator & { deviceMemory?: number })
    | undefined;
  const cores = nav?.hardwareConcurrency;
  const mem = navExt?.deviceMemory;
  const arch = nav?.platform || "Web";

  return {
    computerName: "Piloti Workstation",
    modelSubtitle: `Wayland Web Shell · ${arch}`,
    processor: cores ? `${cores}-core CPU` : "Web Worker CPU",
    graphics: detectBrowserGraphics(),
    memory: mem ? `${mem} GiB` : "Browser Managed",
    osName: "Piloti Desktop 1.0",
  };
}

/**
 * Probes host computer hardware & OS metadata for the About Computer dialog.
 */
export async function probeComputerInfo(
  piloti: Piloti,
  simulated: boolean
): Promise<ComputerInfo> {
  const fallback = getBrowserFallbackInfo();
  if (simulated) {
    return fallback;
  }

  const [
    hostnameRaw,
    productNameRaw,
    sysVendorRaw,
    cpuInfoRaw,
    memInfoRaw,
    osReleaseRaw,
    archRaw,
    kernelRaw,
    gpuRaw,
  ] = await Promise.all([
    readTextSafe(piloti, "/etc/hostname"),
    readTextSafe(piloti, "/sys/devices/virtual/dmi/id/product_name"),
    readTextSafe(piloti, "/sys/devices/virtual/dmi/id/sys_vendor"),
    readTextSafe(piloti, "/proc/cpuinfo"),
    readTextSafe(piloti, "/proc/meminfo"),
    readTextSafe(piloti, "/etc/os-release"),
    runTextSafe(piloti, ["uname", "-m"]),
    runTextSafe(piloti, ["uname", "-r"]),
    runTextSafe(piloti, [
      "sh",
      "-c",
      "lspci 2>/dev/null | grep -iE 'vga|3d|display' | head -n 1 | sed -E 's/^[^:]+:[^:]+:[[:space:]]*//; s/[[:space:]]*\\(rev [^)]+\\)$//'",
    ]),
  ]);

  const cleanProduct =
    productNameRaw &&
    !/to be filled|default string|system product/i.test(productNameRaw)
      ? productNameRaw
      : null;
  const cleanVendor =
    sysVendorRaw &&
    !/to be filled|default string|system manufacturer/i.test(sysVendorRaw)
      ? sysVendorRaw
      : null;

  const modelParts = [cleanVendor, cleanProduct].filter(Boolean);
  const subtitleParts = [
    modelParts.length > 0 ? modelParts.join(" ") : null,
    archRaw,
  ].filter(Boolean);

  return {
    computerName: hostnameRaw || fallback.computerName,
    modelSubtitle:
      subtitleParts.length > 0
        ? subtitleParts.join(" · ")
        : fallback.modelSubtitle,
    processor: (cpuInfoRaw && parseCpuInfo(cpuInfoRaw)) || fallback.processor,
    graphics: gpuRaw || fallback.graphics,
    memory: (memInfoRaw && parseMemTotalGiB(memInfoRaw)) || fallback.memory,
    osName:
      (osReleaseRaw && parseOsReleasePrettyName(osReleaseRaw)) ||
      fallback.osName,
    kernel: kernelRaw ?? undefined,
  };
}
