#!/bin/sh
# Update Piloti inside the Linux VM: pull, build the .deb and install it.
#
#   scripts/vm-update.sh      from the shared folder
set -eu

# One block, read whole before it runs: `git pull` may rewrite this file.
{
  SHARED="${PILOTI_SHARED:-$(cd "$(dirname "$0")/.." && pwd)}"
  OUT="${PILOTI_OUT:-$SHARED/dist}"

  git -c safe.directory="$SHARED" -C "$SHARED" pull --ff-only

  # Only the package built now may be left to install.
  rm -f "$OUT"/piloti-desktop_*.deb
  PILOTI_SHARED="$SHARED" PILOTI_OUT="$OUT" "$SHARED/scripts/vm-build.sh"

  # --reinstall: a rebuild can carry the same version as the installed one.
  sudo apt-get install -y --reinstall "$OUT"/piloti-desktop_*.deb
  exit
}
