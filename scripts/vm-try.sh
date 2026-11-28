#!/bin/sh
# Runs inside the Linux VM; scripts/try.sh on the Mac copies it there and calls it.
#
#   sh vm-try.sh dev|deb <branch>       fetch the branch into the VM's own clone, then build
#   sh vm-try.sh dev|deb --local <N>    build the files try.sh just copied (revision N)
#
#   dev   build the shell and reload the running session (no .deb)
#   deb   build the .deb and install it
#
# PILOTI_DIR: the VM's clone, relative to $HOME (default .cache/piloti-try).
# It is a scratch copy: local changes there are overwritten. It must be on the
# VM's own disk, not a link or a shared folder (/mnt/hgfs): npm ci is very slow
# there, and the checkout would switch the Mac's folder.
set -eu

MODE="${1:?dev or deb}"
REF="${2:?branch or --local}"
REPO="${PILOTI_REPO:-https://github.com/yanbab/piloti-desktop.git}"
cd "$HOME"
DIR="${PILOTI_DIR:-.cache/piloti-try}"

die() { echo "vm: $*" >&2; exit 1; }
if [ -L "$DIR" ]; then
  die "~/$DIR is a link to $(readlink "$DIR"): use a folder on the VM's disk (PILOTI_VM_DIR)"
fi
case "$(cd "$DIR" 2>/dev/null && pwd -P)" in
  /mnt/hgfs/* | /media/*) die "$DIR is a shared folder: use a folder on the VM's disk (PILOTI_VM_DIR)" ;;
esac

if [ "$REF" = "--local" ]; then
  export PILOTI_REVISION="${3:-0}"
  cd "$DIR"
  echo "vm: files from the Mac"
else
  if [ ! -d "$DIR/.git" ]; then
    mkdir -p "$(dirname "$DIR")"
    rm -rf "$DIR"
    echo "vm: cloning $REPO into ~/$DIR"
    git clone --quiet "$REPO" "$DIR"
  fi
  cd "$DIR"
  # From GitHub, whatever this clone's origin points to.
  # Into a named ref, not FETCH_HEAD: some git versions leave a tag first there.
  git fetch --quiet --force --tags "$REPO" "+refs/heads/$REF:refs/try/$REF"
  git checkout --quiet --force --detach "refs/try/$REF"
  # Leftovers from a "." run; ignored files (node_modules) stay.
  git clean --quiet -fd
  echo "vm: $(git log -1 --format='%h %s')"
fi

# Reinstall only when the lock file changed.
if ! cmp -s package-lock.json node_modules/.piloti-lock; then
  echo "vm: npm ci (package-lock.json changed; a few minutes the first time)"
  npm ci --no-audit --no-fund
  cp package-lock.json node_modules/.piloti-lock
fi

case "$MODE" in
  dev)
    echo "vm: building the shell"
    npm run build:shell 2>&1 | tail -5
    if command -v piloti >/dev/null 2>&1; then
      piloti reload "$PWD/dist/shell.js"
    else
      domicile load-shell "$PWD/dist/shell.js"
    fi
    echo "vm: shell reloaded. Apps or .desktop files changed? Use deb instead."
    ;;
  deb)
    rm -rf dist
    echo "vm: building the .deb"
    npm run build:deb
    sudo apt-get install -y --reinstall ./dist/piloti-desktop_*.deb
    echo "vm: installed $(cd dist && ls piloti-desktop_*.deb). Log out and back in."
    ;;
  *)
    echo "unknown mode '$MODE'" >&2
    exit 1
    ;;
esac
