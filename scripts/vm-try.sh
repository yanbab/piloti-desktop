#!/bin/sh
# Runs inside the Linux VM; scripts/try.sh on the Mac copies it there and calls it.
#
#   sh vm-try.sh dev|deb <branch>       fetch the branch into the VM's own clone, then build
#   sh vm-try.sh dev|deb --local <N>    build the files try.sh just copied (revision N)
#
#   dev   build the shell and reload the running session (no .deb)
#   deb   build the .deb and install it
#
# PILOTI_DIR: the VM's clone, relative to $HOME (default Projets/piloti-desktop).
# It is a scratch copy: local changes there are overwritten.
set -eu

MODE="${1:?dev or deb}"
REF="${2:?branch or --local}"
REPO="${PILOTI_REPO:-https://github.com/yanbab/piloti-desktop.git}"
cd "$HOME"
DIR="${PILOTI_DIR:-Projets/piloti-desktop}"

if [ "$REF" = "--local" ]; then
  export PILOTI_REVISION="${3:-0}"
  cd "$DIR"
  echo "vm: files from the Mac"
else
  if [ ! -d "$DIR/.git" ]; then
    mkdir -p "$(dirname "$DIR")"
    rm -rf "$DIR"
    git clone --quiet "$REPO" "$DIR"
  fi
  cd "$DIR"
  git fetch --quiet --tags origin "$REF"
  git checkout --quiet --force --detach FETCH_HEAD
  # Leftovers from a "." run; ignored files (node_modules) stay.
  git clean --quiet -fd
  echo "vm: $(git log -1 --format='%h %s')"
fi

# Reinstall only when the lock file changed.
if ! cmp -s package-lock.json node_modules/.piloti-lock; then
  npm ci --no-audit --no-fund
  cp package-lock.json node_modules/.piloti-lock
fi

case "$MODE" in
  dev)
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
    npm run build:deb
    sudo apt-get install -y --reinstall ./dist/piloti-desktop_*.deb
    echo "vm: installed $(cd dist && ls piloti-desktop_*.deb). Log out and back in."
    ;;
  *)
    echo "unknown mode '$MODE'" >&2
    exit 1
    ;;
esac
