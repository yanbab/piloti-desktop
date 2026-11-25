#!/bin/sh
# Build the .deb inside the Linux VM.
#
#   scripts/vm-build.sh       from the shared folder; the .deb lands in its dist/
#
# The shared folder's node_modules are the host's (macOS binaries), so
# `npm run build:deb` fails there. This copies the sources to a folder of its
# own, installs Linux node_modules in it, builds, and copies the .deb back.
set -eu

SHARED="${PILOTI_SHARED:-$(cd "$(dirname "$0")/.." && pwd)}"
BUILD="${PILOTI_BUILD:-$HOME/.cache/piloti-deb-build}"
OUT="${PILOTI_OUT:-$SHARED/dist}"

mkdir -p "$BUILD"
# `rsync --delete` below mirrors into BUILD: it must never be the sources.
if [ "$(cd "$BUILD" && pwd -P)" = "$(cd "$SHARED" && pwd -P)" ]; then
  echo "PILOTI_BUILD must not be the source folder" >&2
  exit 1
fi
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude _docs \
  --exclude test-results --exclude docs/demo --exclude '/.*' \
  "$SHARED"/ "$BUILD"/

cd "$BUILD"
# Reinstall only when the lock file changed.
if ! cmp -s package-lock.json node_modules/.piloti-lock; then
  npm ci --no-audit --no-fund
  cp package-lock.json node_modules/.piloti-lock
fi
rm -rf dist
npm run build:deb

mkdir -p "$OUT"
cp dist/*.deb "$OUT"/
echo "Copied to $OUT: $(cd dist && ls *.deb)"
