import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildDebPackage,
  REPO_ROOT,
  shouldIncludeDataFile,
  stagePackageRoot,
} from "../../scripts/build-deb.mjs";

describe("Debian packaging (data/files -> .deb)", () => {
  test("includes Piloti system files and excludes Web-VFS / conflicting Debian package files", () => {
    expect(shouldIncludeDataFile("usr/bin/piloti")).toBe(true);
    expect(shouldIncludeDataFile("usr/bin/piloti-session")).toBe(true);
    expect(shouldIncludeDataFile("usr/bin/piloti-greeter")).toBe(true);
    expect(shouldIncludeDataFile("usr/bin/piloti-settings")).toBe(true);
    expect(shouldIncludeDataFile("usr/libexec/piloti-desktop/piloti-greetd-client")).toBe(true);
    expect(shouldIncludeDataFile("usr/share/wayland-sessions/piloti.desktop")).toBe(true);
    expect(shouldIncludeDataFile("usr/share/applications/piloti-settings.desktop")).toBe(true);
    expect(shouldIncludeDataFile("usr/share/piloti-desktop/domicile.json")).toBe(true);
    expect(shouldIncludeDataFile("usr/share/piloti-desktop/greetd.toml")).toBe(true);
    expect(shouldIncludeDataFile("usr/share/icons/Piloti/index.theme")).toBe(true);
    expect(shouldIncludeDataFile("usr/share/icons/Piloti/animated/places/folder.json")).toBe(true);
    expect(shouldIncludeDataFile("usr/share/icons/hicolor/scalable/apps/piloti-desktop.svg")).toBe(true);

    // Must exclude paths owned by other Debian packages or browser-only VFS
    expect(shouldIncludeDataFile("home/user/Documents/Notes.txt")).toBe(false);
    expect(shouldIncludeDataFile("etc/issue")).toBe(false);
    expect(shouldIncludeDataFile("usr/share/icons/Adwaita/index.theme")).toBe(false);
    expect(shouldIncludeDataFile("usr/share/icons/Papirus/index.theme")).toBe(false);
    expect(shouldIncludeDataFile("usr/share/icons/hicolor/index.theme")).toBe(false);
    expect(shouldIncludeDataFile("usr/share/icons/hicolor/scalable/apps/org.gnome.Nautilus.svg")).toBe(false);
    expect(shouldIncludeDataFile("usr/share/icons/hicolor/scalable/apps/.DS_Store")).toBe(false);
  });

  test("stages expected files with executable permissions and builds a valid .deb archive", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piloti-deb-test-"));
    try {
      const dummyShell = path.join(tmpDir, "shell.js");
      const dummyGreeter = path.join(tmpDir, "greeter.js");
      fs.writeFileSync(dummyShell, "export const Shell = {};\n", "utf8");
      fs.writeFileSync(dummyGreeter, "export const Shell = {};\n", "utf8");

      const stageDir = path.join(tmpDir, "stage");
      const staged = stagePackageRoot({
        repoRoot: REPO_ROOT,
        stageDir,
        shellBundlePath: dummyShell,
        greeterBundlePath: dummyGreeter,
      });

      const rels = new Set(staged.files.map((f) => f.rel));
      expect(rels.has("usr/bin/piloti")).toBe(true);
      expect(rels.has("usr/bin/piloti-session")).toBe(true);
      expect(rels.has("usr/bin/piloti-greeter")).toBe(true);
      expect(rels.has("usr/bin/piloti-webapp")).toBe(true);
      expect(rels.has("usr/bin/piloti-settings")).toBe(true);
      expect(rels.has("usr/bin/piloti-files")).toBe(true);
      expect(rels.has("usr/libexec/piloti-desktop/piloti-greetd-client")).toBe(true);
      expect(rels.has("usr/share/wayland-sessions/piloti.desktop")).toBe(true);
      expect(rels.has("usr/share/applications/piloti-settings.desktop")).toBe(true);
      expect(rels.has("usr/share/piloti-desktop/domicile.json")).toBe(true);
      expect(rels.has("usr/share/piloti-desktop/greeter-domicile.json")).toBe(true);
      expect(rels.has("usr/share/piloti-desktop/greetd.toml")).toBe(true);
      expect(rels.has("usr/share/piloti-desktop/shell.js")).toBe(true);
      expect(rels.has("usr/share/piloti-desktop/greeter.js")).toBe(true);
      expect(rels.has("usr/share/icons/Piloti/index.theme")).toBe(true);
      expect(rels.has("usr/share/icons/hicolor/scalable/apps/piloti-desktop.svg")).toBe(true);

      // No conflicting files staged
      expect(rels.has("etc/issue")).toBe(false);
      expect(rels.has("usr/share/icons/Adwaita/index.theme")).toBe(false);
      expect(rels.has("usr/share/icons/Papirus/index.theme")).toBe(false);
      expect(rels.has("usr/share/icons/hicolor/index.theme")).toBe(false);

      // /usr/bin/* and /usr/libexec/* must be executable (0755)
      for (const f of staged.files) {
        if (f.rel.startsWith("usr/bin/") || f.rel.startsWith("usr/libexec/")) {
          expect(f.mode).toBe(0o755);
        }
      }

      // Build an actual .deb archive using the dummy shell & greeter bundles
      const outDeb = path.join(tmpDir, "piloti-desktop.deb");
      const res = buildDebPackage({
        repoRoot: REPO_ROOT,
        skipBuild: true,
        shellBundlePath: dummyShell,
        greeterBundlePath: dummyGreeter,
        outPath: outDeb,
      });
      expect(fs.existsSync(res.debPath!)).toBe(true);

      const magic = fs.readFileSync(outDeb).subarray(0, 8).toString("ascii");
      expect(magic).toBe("!<arch>\n");

      const arList = execFileSync("ar", ["-t", outDeb], { encoding: "utf8" })
        .trim()
        .split(/\r?\n/)
        .map((s) => s.trim());
      expect(arList).toHaveLength(3);
      expect(arList[0]).toBe("debian-binary");
      expect(arList[1]).toMatch(/^control\.tar\.(gz|xz|zst)$/);
      expect(arList[2]).toMatch(/^data\.tar\.(gz|xz|zst)$/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);
});
