// The version a build carries: package.json's, then "-N" for the N commits
// since the release tag (0.10.9-3; -0 is the release itself). PILOTI_REVISION
// overrides N, for copies without git (scripts/vm-build.sh).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export function buildVersion(root = ROOT) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  let revision = process.env.PILOTI_REVISION;
  if (!revision) {
    try {
      revision = execFileSync("git", ["rev-list", "--count", `v${version}..HEAD`], {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      // no git, or the version isn't tagged yet
    }
  }
  return revision ? `${version}-${revision}` : version;
}
