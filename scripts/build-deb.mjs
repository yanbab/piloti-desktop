#!/usr/bin/env node
/**
 * Builds a Debian binary package (`piloti-desktop_<version>_all.deb`) from
 * `data/files/` + `dist/shell.js` + `debian/` metadata.
 *
 * Uses `dpkg-deb --root-owner-group` when installed, and falls back to a
 * standards-compliant pure-Node `ar` + POSIX `ustar` `.tar.gz` packager so
 * `npm run build:deb` works identically on Linux and macOS.
 *
 * Usage:
 *   node scripts/build-deb.mjs [--skip-build] [--stage-only] [--stage-dir <dir>] [--out <file.deb>]
 */
import crypto from "node:crypto";
import { buildVersion } from "./version.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Returns true if a file relative to `data/files/` belongs in the Debian package
 * root filesystem (excluding Web-VFS-only files and paths owned by other Debian packages).
 */
export function shouldIncludeDataFile(relPath) {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!norm) return false;

  const base = path.posix.basename(norm);
  if (base === ".DS_Store" || base === "Thumbs.db") return false;

  // Never ship user home seed files inside a .deb.
  if (norm === "home" || norm.startsWith("home/")) return false;

  // Avoid file conflicts with Debian's adwaita-icon-theme, papirus-icon-theme,
  // hicolor-icon-theme, and upstream GNOME app packages.
  if (norm.startsWith("usr/share/icons/Adwaita/")) return false;
  if (norm.startsWith("usr/share/icons/Papirus/")) return false;
  if (norm === "usr/share/icons/hicolor/index.theme") return false;
  if (norm.startsWith("usr/share/icons/hicolor/scalable/apps/org.gnome.")) {
    return false;
  }

  return norm.startsWith("usr/") || norm.startsWith("etc/");
}

function getDesiredFileMode(relPath, srcStat) {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    norm.startsWith("usr/bin/") ||
    norm.startsWith("usr/sbin/") ||
    norm.startsWith("usr/libexec/")
  ) {
    return 0o755;
  }
  return srcStat && (srcStat.mode & 0o111) ? 0o755 : 0o644;
}

function walkFiles(dir, prefix = "") {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const ent of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results.push(...walkFiles(full, rel));
    } else if (ent.isFile()) {
      results.push({ rel, full });
    }
  }
  return results;
}

function readPackageJson(repoRoot = REPO_ROOT) {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
  );
}

/**
 * Stages the Debian package filesystem tree into `stageDir` from `data/files/`,
 * `dist/shell.js`, and `debian/{copyright,changelog}`.
 */
export function stagePackageRoot({
  repoRoot = REPO_ROOT,
  stageDir,
  shellBundlePath = path.join(repoRoot, "dist", "shell.js"),
  greeterBundlePath = path.join(repoRoot, "dist", "greeter.js"),
  version,
} = {}) {
  if (!stageDir) {
    throw new Error("stageDir is required");
  }
  const pkg = readPackageJson(repoRoot);
  const pkgVersion = version || pkg.version || "0.9.0";
  const dataFilesRoot = path.join(repoRoot, "data", "files");

  if (!fs.existsSync(shellBundlePath)) {
    throw new Error(
      `Built shell bundle not found at ${shellBundlePath}. Run 'npm run build:shell' first.`
    );
  }

  fs.mkdirSync(stageDir, { recursive: true });
  const stagedFiles = [];

  for (const { rel, full } of walkFiles(dataFilesRoot)) {
    if (!shouldIncludeDataFile(rel)) continue;
    const dst = path.join(stageDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });

    let content = fs.readFileSync(full);
    if (rel === "usr/bin/piloti") {
      const updated = content
        .toString("utf8")
        .replace(/^PILOTI_VERSION="[^"]*"/m, `PILOTI_VERSION="${pkgVersion}"`);
      content = Buffer.from(updated, "utf8");
    }

    const mode = getDesiredFileMode(rel, fs.statSync(full));
    fs.writeFileSync(dst, content, { mode });
    fs.chmodSync(dst, mode);
    stagedFiles.push({ rel, mode, size: content.length });
  }

  // Install compiled Domicile shell bundle
  const shellDstRel = "usr/share/piloti-desktop/shell.js";
  const shellDst = path.join(stageDir, shellDstRel);
  fs.mkdirSync(path.dirname(shellDst), { recursive: true });
  const shellBytes = fs.readFileSync(shellBundlePath);
  fs.writeFileSync(shellDst, shellBytes, { mode: 0o644 });
  fs.chmodSync(shellDst, 0o644);
  stagedFiles.push({ rel: shellDstRel, mode: 0o644, size: shellBytes.length });

  // Install Domicile app modules (one directory per app = own origin/storage)
  const appsSrc = path.join(repoRoot, "dist", "apps");
  if (fs.existsSync(appsSrc)) {
    for (const appId of fs.readdirSync(appsSrc)) {
      const appDir = path.join(appsSrc, appId);
      if (!fs.statSync(appDir).isDirectory()) continue;
      for (const name of fs.readdirSync(appDir)) {
        const rel = `usr/share/piloti-desktop/apps/${appId}/${name}`;
        const dst = path.join(stageDir, rel);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        const bytes = fs.readFileSync(path.join(appDir, name));
        fs.writeFileSync(dst, bytes, { mode: 0o644 });
        fs.chmodSync(dst, 0o644);
        stagedFiles.push({ rel, mode: 0o644, size: bytes.length });
      }
    }
  }

  // Install standalone Display Manager greeter bundle when built
  if (greeterBundlePath && fs.existsSync(greeterBundlePath)) {
    const greeterDstRel = "usr/share/piloti-desktop/greeter.js";
    const greeterDst = path.join(stageDir, greeterDstRel);
    fs.mkdirSync(path.dirname(greeterDst), { recursive: true });
    const greeterBytes = fs.readFileSync(greeterBundlePath);
    fs.writeFileSync(greeterDst, greeterBytes, { mode: 0o644 });
    fs.chmodSync(greeterDst, 0o644);
    stagedFiles.push({
      rel: greeterDstRel,
      mode: 0o644,
      size: greeterBytes.length,
    });
  }

  // Install Debian docs (copyright + compressed changelog)
  const docDirRel = "usr/share/doc/piloti-desktop";
  const copyrightSrc = path.join(repoRoot, "debian", "copyright");
  if (fs.existsSync(copyrightSrc)) {
    const rel = `${docDirRel}/copyright`;
    const dst = path.join(stageDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const bytes = fs.readFileSync(copyrightSrc);
    fs.writeFileSync(dst, bytes, { mode: 0o644 });
    stagedFiles.push({ rel, mode: 0o644, size: bytes.length });
  }

  const changelogSrc = path.join(repoRoot, "debian", "changelog");
  if (fs.existsSync(changelogSrc)) {
    const rel = `${docDirRel}/changelog.Debian.gz`;
    const dst = path.join(stageDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const gz = zlib.gzipSync(fs.readFileSync(changelogSrc), { level: 9 });
    fs.writeFileSync(dst, gz, { mode: 0o644 });
    stagedFiles.push({ rel, mode: 0o644, size: gz.length });
  }

  return {
    version: pkgVersion,
    files: stagedFiles.sort((a, b) => a.rel.localeCompare(b.rel)),
  };
}

/** The built shell's own version (`0.10.9-3`) when it matches, else release 1. */
function debVersion(version) {
  const built = buildVersion();
  return built.startsWith(`${version}-`) ? built : `${version}-1`;
}

function generateDebianControl({ version, installedSizeKiB, repoRoot }) {
  const pkg = readPackageJson(repoRoot);
  const srcControl = fs.readFileSync(
    path.join(repoRoot, "debian", "control"),
    "utf8"
  );
  const maintainer =
    srcControl.match(/^Maintainer:\s*(.+)$/m)?.[1]?.trim() ??
    "Piloti Desktop Maintainers <maintainers@piloti-desktop.org>";
  const homepage =
    srcControl.match(/^Homepage:\s*(.+)$/m)?.[1]?.trim() ??
    "https://github.com/yanbab/piloti-desktop";

  return [
    `Package: ${pkg.name || "piloti-desktop"}`,
    `Version: ${debVersion(version)}`,
    "Section: x11",
    "Priority: optional",
    "Architecture: all",
    "Depends: domicile",
    "Recommends: xwayland-satellite, papirus-icon-theme, adwaita-icon-theme, hicolor-icon-theme, xdg-utils, dbus-user-session",
    "Suggests: greetd, gnome-control-center, flatpak, network-manager, pipewire",
    "Provides: wayland-session",
    `Installed-Size: ${installedSizeKiB}`,
    `Maintainer: ${maintainer}`,
    `Homepage: ${homepage}`,
    "Description: Hybrid Web/Linux Wayland desktop shell built on Domicile",
    " Piloti Desktop is a Wayland desktop shell built on the Domicile compositor.",
    " It provides a unified menu bar, magnifying dock, spatial desktop icons,",
    " launcher, overview, control panel, built-in desktop applications, custom",
    " Piloti icon theme (with Lottie animated icons), CLI control utilities,",
    " and a Wayland session entry for display managers (GDM, SDDM, LightDM).",
    "",
  ].join("\n");
}

function writeDebianMeta(stageDir, { version, files, repoRoot }) {
  const debianDir = path.join(stageDir, "DEBIAN");
  fs.mkdirSync(debianDir, { recursive: true });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const installedSizeKiB = Math.max(1, Math.ceil(totalBytes / 1024));

  const controlText = generateDebianControl({
    version,
    installedSizeKiB,
    repoRoot,
  });
  fs.writeFileSync(path.join(debianDir, "control"), controlText, {
    mode: 0o644,
  });

  // md5sums
  const md5Lines = files.map((f) => {
    const hash = crypto
      .createHash("md5")
      .update(fs.readFileSync(path.join(stageDir, f.rel)))
      .digest("hex");
    return `${hash}  ${f.rel}`;
  });
  fs.writeFileSync(
    path.join(debianDir, "md5sums"),
    `${md5Lines.join("\n")}\n`,
    { mode: 0o644 }
  );

  // Maintainer scripts (strip #DEBHELPER# token when building directly)
  for (const scriptName of ["postinst", "postrm"]) {
    const src = path.join(repoRoot, "debian", `piloti-desktop.${scriptName}`);
    if (!fs.existsSync(src)) continue;
    const cleaned = fs
      .readFileSync(src, "utf8")
      .replace(/^#DEBHELPER#\r?\n?/gm, "");
    const dst = path.join(debianDir, scriptName);
    fs.writeFileSync(dst, cleaned, { mode: 0o755 });
    fs.chmodSync(dst, 0o755);
  }
}

// --- Pure-Node POSIX ustar + Debian ar writer (fallback when dpkg-deb is absent) ---

function writeOctal(buf, offset, length, value) {
  const str = Math.max(0, value).toString(8).padStart(length - 1, "0");
  buf.write(str.slice(-(length - 1)), offset, length - 1, "ascii");
  buf[offset + length - 1] = 0;
}

function splitTarPath(tarName) {
  if (Buffer.byteLength(tarName, "utf8") <= 100) {
    return { prefix: "", name: tarName };
  }
  const idx = tarName.lastIndexOf("/");
  if (idx > 0) {
    const prefix = tarName.slice(0, idx);
    const name = tarName.slice(idx + 1);
    if (
      Buffer.byteLength(prefix, "utf8") <= 155 &&
      Buffer.byteLength(name, "utf8") <= 100
    ) {
      return { prefix, name };
    }
  }
  throw new Error(`Tar path exceeds POSIX ustar limit: ${tarName}`);
}

function createTarHeader({ name, typeflag, mode, size, mtime }) {
  const header = Buffer.alloc(512, 0);
  const { prefix, name: shortName } = splitTarPath(name);
  header.write(shortName, 0, 100, "utf8");
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0); // uid = 0 (root)
  writeOctal(header, 116, 8, 0); // gid = 0 (root)
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, mtime);
  header.fill(0x20, 148, 156); // checksum placeholder spaces
  header.write(typeflag, 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  header.write("root", 265, 32, "ascii");
  header.write("root", 297, 32, "ascii");
  writeOctal(header, 329, 8, 0);
  writeOctal(header, 337, 8, 0);
  if (prefix) {
    header.write(prefix, 345, 155, "utf8");
  }

  let checksum = 0;
  for (let i = 0; i < 512; i += 1) checksum += header[i];
  const chkStr = checksum.toString(8).padStart(6, "0");
  header.write(chkStr, 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function createTarGzBuffer(rootDir, { skipTopDirs = [] } = {}) {
  const mtime = Math.floor(Date.now() / 1000);
  const chunks = [];
  const skipSet = new Set(skipTopDirs);

  // Root entry "./"
  chunks.push(
    createTarHeader({
      name: "./",
      typeflag: "5",
      mode: 0o755,
      size: 0,
      mtime,
    })
  );

  const walk = (curDir, relDir) => {
    const entries = fs
      .readdirSync(curDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (!relDir && skipSet.has(ent.name)) continue;
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      const full = path.join(curDir, ent.name);
      if (ent.isDirectory()) {
        chunks.push(
          createTarHeader({
            name: `./${rel}/`,
            typeflag: "5",
            mode: 0o755,
            size: 0,
            mtime,
          })
        );
        walk(full, rel);
      } else if (ent.isFile()) {
        const data = fs.readFileSync(full);
        const st = fs.statSync(full);
        const mode = st.mode & 0o777;
        chunks.push(
          createTarHeader({
            name: `./${rel}`,
            typeflag: "0",
            mode,
            size: data.length,
            mtime,
          })
        );
        chunks.push(data);
        const pad = (512 - (data.length % 512)) % 512;
        if (pad > 0) chunks.push(Buffer.alloc(pad, 0));
      }
    }
  };

  walk(rootDir, "");
  chunks.push(Buffer.alloc(1024, 0)); // two 512-byte EOF blocks
  return zlib.gzipSync(Buffer.concat(chunks), { level: 6 });
}

function createArMember(name, payload, mtime) {
  const header = Buffer.alloc(60, 0x20);
  header.write(name.slice(0, 16), 0, 16, "ascii");
  header.write(String(mtime).slice(0, 12), 16, 12, "ascii");
  header.write("0", 28, 6, "ascii");
  header.write("0", 34, 6, "ascii");
  header.write("100644", 40, 8, "ascii");
  header.write(String(payload.length).slice(0, 10), 48, 10, "ascii");
  header.write("`\n", 58, 2, "ascii");
  const pad = payload.length % 2 === 1 ? Buffer.from("\n", "ascii") : Buffer.alloc(0);
  return Buffer.concat([header, payload, pad]);
}

function buildDebPureNode(stageDir, outDebPath) {
  const mtime = Math.floor(Date.now() / 1000);
  const debianBinary = Buffer.from("2.0\n", "ascii");
  const controlTarGz = createTarGzBuffer(path.join(stageDir, "DEBIAN"));
  const dataTarGz = createTarGzBuffer(stageDir, { skipTopDirs: ["DEBIAN"] });

  const debBuf = Buffer.concat([
    Buffer.from("!<arch>\n", "ascii"),
    createArMember("debian-binary", debianBinary, mtime),
    createArMember("control.tar.gz", controlTarGz, mtime),
    createArMember("data.tar.gz", dataTarGz, mtime),
  ]);
  fs.mkdirSync(path.dirname(outDebPath), { recursive: true });
  fs.writeFileSync(outDebPath, debBuf, { mode: 0o644 });
}

function hasCommand(cmd) {
  const res = spawnSync("sh", ["-c", `command -v ${cmd}`], {
    stdio: "ignore",
  });
  return res.status === 0;
}

/**
 * Full build pipeline: builds `dist/shell.js` (unless `skipBuild`), stages files,
 * writes `DEBIAN/` control metadata, and produces `dist/piloti-desktop_<ver>_all.deb`.
 */
export function buildDebPackage({
  repoRoot = REPO_ROOT,
  skipBuild = false,
  stageOnly = false,
  stageDir,
  outPath,
  shellBundlePath = path.join(repoRoot, "dist", "shell.js"),
  greeterBundlePath = path.join(repoRoot, "dist", "greeter.js"),
} = {}) {
  const pkg = readPackageJson(repoRoot);
  const version = pkg.version || "0.9.0";

  if (!skipBuild) {
    execFileSync("npm", ["run", "build:shell"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    execFileSync("npm", ["run", "build:apps"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    execFileSync("npm", ["run", "build:greeter"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }

  const ownedTmpDir = !stageDir;
  const resolvedStageDir =
    stageDir || fs.mkdtempSync(path.join(os.tmpdir(), "piloti-deb-"));

  try {
    const staged = stagePackageRoot({
      repoRoot,
      stageDir: resolvedStageDir,
      shellBundlePath,
      greeterBundlePath,
      version,
    });

    if (stageOnly) {
      return {
        version,
        stageDir: resolvedStageDir,
        files: staged.files,
        debPath: null,
        method: "stage-only",
      };
    }

    writeDebianMeta(resolvedStageDir, {
      version,
      files: staged.files,
      repoRoot,
    });

    const debPath =
      outPath ||
      path.join(repoRoot, "dist", `${pkg.name || "piloti-desktop"}_${debVersion(version)}_all.deb`);

    let method;
    if (hasCommand("dpkg-deb")) {
      fs.mkdirSync(path.dirname(debPath), { recursive: true });
      execFileSync(
        "dpkg-deb",
        ["--root-owner-group", "--build", resolvedStageDir, debPath],
        { stdio: "inherit" }
      );
      method = "dpkg-deb";
    } else {
      buildDebPureNode(resolvedStageDir, debPath);
      method = "node-ar-tar";
    }

    return {
      version,
      stageDir: resolvedStageDir,
      files: staged.files,
      debPath,
      method,
    };
  } finally {
    if (ownedTmpDir) {
      fs.rmSync(resolvedStageDir, { recursive: true, force: true });
    }
  }
}

// CLI entrypoint
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const argv = process.argv.slice(2);
  let skipBuild = false;
  let stageOnly = false;
  let stageDir;
  let outPath;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--skip-build") {
      skipBuild = true;
    } else if (arg === "--stage-only") {
      stageOnly = true;
    } else if (arg === "--stage-dir" && argv[i + 1]) {
      stageDir = path.resolve(argv[++i]);
    } else if (arg === "--out" && argv[i + 1]) {
      outPath = path.resolve(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/build-deb.mjs [--skip-build] [--stage-only] [--stage-dir <dir>] [--out <file.deb>]"
      );
      process.exit(0);
    }
  }

  const res = buildDebPackage({ skipBuild, stageOnly, stageDir, outPath });
  if (stageOnly) {
    console.log(
      `Staged ${res.files.length} files for piloti-desktop ${res.version} in ${res.stageDir}`
    );
  } else {
    const sizeKB = Math.round(fs.statSync(res.debPath).size / 1024);
    console.log(
      `Built ${res.debPath} (${sizeKB} KB, ${res.files.length} files, backend=${res.method})`
    );
  }
}
