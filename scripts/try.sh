#!/bin/sh
# Try a branch, from the Mac: in the web demo, on the Linux VM, or both.
#
#   scripts/try.sh <branch> [web|vm|deb|all]
#
#     web   web demo of the branch in its own worktree, opened in the browser (default)
#     vm    VM builds the shell from the branch and reloads the session (fast)
#     deb   VM builds the .deb from the branch and installs it (full, asks sudo)
#     all   vm, then web
#
#   <branch> is a branch on GitHub (claude/project-thread-xxxx, main...), or
#   "." for this folder as it is, uncommitted changes included.
#
#   scripts/try.sh --list     branches on GitHub, newest first
#   scripts/try.sh --clean    remove the web worktrees
#
# The VM is reached over ssh: PILOTI_VM (default debian@192.168.162.236).
# It keeps its own clone with Linux node_modules in PILOTI_VM_DIR
# (default ~/.cache/piloti-try), made on first use. Not a shared folder.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VM="${PILOTI_VM:-debian@192.168.162.236}"
VM_DIR="${PILOTI_VM_DIR:-.cache/piloti-try}"
TREES="$ROOT/.claude/worktrees"

die() { echo "try: $*" >&2; exit 1; }

case "${1:-}" in
  "" | -h | --help)
    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  --list)
    git -C "$ROOT" fetch --quiet --prune origin
    git -C "$ROOT" for-each-ref --sort=-committerdate --count=15 \
      --format='%(committerdate:relative)	%(refname:lstrip=3)	%(subject)' refs/remotes/origin |
      grep -v '	HEAD	' || true
    exit 0
    ;;
  --clean)
    for tree in "$TREES"/try-*; do
      [ -d "$tree" ] || continue
      git -C "$ROOT" worktree remove --force "$tree" && echo "removed $tree"
    done
    git -C "$ROOT" worktree prune
    exit 0
    ;;
esac

BRANCH="$1"
MODE="${2:-web}"
case "$MODE" in web | vm | deb | all) ;; *) die "unknown mode '$MODE' (web, vm, deb, all)" ;; esac

# --- web -----------------------------------------------------------------

free_port() {
  port=5174
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do port=$((port + 1)); done
  echo "$port"
}

# The branch in its own worktree, so this checkout is never switched.
web_tree() {
  if [ "$BRANCH" = "." ]; then
    echo "$ROOT"
    return
  fi
  slug="try-$(echo "$BRANCH" | tr '/' '-')"
  tree="$TREES/$slug"
  git -C "$ROOT" fetch --quiet origin "$BRANCH" || die "no branch '$BRANCH' on GitHub (scripts/try.sh --list)"
  sha="$(git -C "$ROOT" rev-parse FETCH_HEAD)"
  if [ -d "$tree" ]; then
    git -C "$tree" checkout --quiet --force --detach "$sha"
  else
    mkdir -p "$TREES"
    git -C "$ROOT" worktree add --quiet --detach "$tree" "$sha"
  fi
  # node_modules: an APFS clone of ours when the lock file is the same, else npm ci.
  if ! cmp -s "$tree/package-lock.json" "$tree/node_modules/.piloti-lock"; then
    rm -rf "$tree/node_modules"
    if cmp -s "$tree/package-lock.json" "$ROOT/package-lock.json" && [ -d "$ROOT/node_modules" ] &&
      cp -Rc "$ROOT/node_modules" "$tree/node_modules" 2>/dev/null; then
      echo "node_modules cloned from $ROOT" >&2
    else
      (cd "$tree" && npm ci --no-audit --no-fund >&2)
    fi
    cp "$tree/package-lock.json" "$tree/node_modules/.piloti-lock"
  fi
  echo "$tree"
}

run_web() {
  tree="$(web_tree)"
  port="$(free_port)"
  echo "web: $(git -C "$tree" log -1 --format='%h %s') -> http://localhost:$port (Ctrl+C to stop)"
  cd "$tree"
  exec npx vite --port "$port" --strictPort --open
}

# --- VM ------------------------------------------------------------------

run_vm() {
  vm_mode="$1"
  if [ "$BRANCH" = "." ]; then
    # This folder as it is: copy it over, the VM builds that.
    ssh "$VM" "mkdir -p '$VM_DIR'"
    rsync -az --delete \
      --exclude node_modules --exclude dist --exclude .git --exclude _docs \
      --exclude test-results --exclude docs/demo --exclude '/.*' \
      "$ROOT"/ "$VM:$VM_DIR"/
    revision="$(git -C "$ROOT" describe --tags --long 2>/dev/null | sed 's/^v[^-]*-\([0-9]*\)-.*/\1/')"
    ref="--local ${revision:-0}"
  else
    ref="$BRANCH"
  fi
  scp -q "$ROOT/scripts/vm-try.sh" "$VM:/tmp/piloti-vm-try.sh"
  # -t: sudo may ask for the password (deb).
  ssh -t "$VM" "PILOTI_DIR='$VM_DIR' sh /tmp/piloti-vm-try.sh $vm_mode $ref"
}

case "$MODE" in
  web) run_web ;;
  vm) run_vm dev ;;
  deb) run_vm deb ;;
  all)
    run_vm dev
    run_web
    ;;
esac
