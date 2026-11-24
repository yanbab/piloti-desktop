#!/bin/sh
# Fast edit -> test loop inside the Linux VM, no .deb.
#
#   scripts/vm-dev.sh          sync, build the shell, hot-reload the running session
#   scripts/vm-dev.sh watch    repeat whenever the shared folder changes
#
# SHARED is the host project folder mounted in the VM (its node_modules are the
# host's, so it can't build here). LOCAL is a clone with Linux node_modules
# (run `npm install` there after package.json changes).
set -eu

SHARED="${PILOTI_SHARED:-$HOME/Projets/Piloti}"
LOCAL="${PILOTI_LOCAL:-$HOME/Projets/piloti-desktop}"

sync_sources() {
  rsync -a --delete --itemize-changes \
    --exclude node_modules --exclude dist --exclude .git --exclude _docs \
    --exclude test-results --exclude docs/demo --exclude '/.*' \
    "$SHARED"/ "$LOCAL"/ | grep -v '/$' | grep -c '^[<>c]' || true
}

build_and_reload() {
  cd "$LOCAL"
  npm run build:shell 2>&1 | tail -25
  if command -v piloti >/dev/null 2>&1; then
    piloti reload "$LOCAL/dist/shell.js"
  else
    domicile load-shell "$LOCAL/dist/shell.js"
  fi
}

changed="$(sync_sources)"
echo "synced ($changed changed)"
build_and_reload

if [ "${1:-}" = "watch" ]; then
  while sleep 2; do
    changed="$(sync_sources)"
    if [ "$changed" != "0" ]; then
      echo "--- $changed changed"
      build_and_reload
    fi
  done
fi
