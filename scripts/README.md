# Scripts

Run from the project folder. `sh scripts/<name>.sh` works without the executable bit.

## Try a branch (Mac)

`try.sh` tries a branch from GitHub, or this folder as it is, in the web demo,
on the Linux VM, or both. This checkout never changes branch.

```sh
sh scripts/try.sh --list                 # recent branches on GitHub
sh scripts/try.sh <branch>               # web demo of the branch
sh scripts/try.sh <branch> vm            # VM: build the shell, reload the session (fast)
sh scripts/try.sh <branch> deb           # VM: build and install the .deb (full)
sh scripts/try.sh <branch> all           # vm, then web
sh scripts/try.sh . vm                   # this folder, uncommitted changes included
sh scripts/try.sh --clean                # remove the web worktrees
```

- **web**: the branch is checked out in `.claude/worktrees/try-<branch>`.
  `node_modules` is cloned from this folder when the lock file is the same,
  otherwise `npm ci` runs. Vite starts on the first free port from 5174 and opens
  the browser. Ctrl+C stops it.
- **vm** and **deb**: over ssh. The VM keeps its own clone with Linux
  `node_modules` (made on first use); `vm-try.sh` is copied there and run.
  Use `deb` when apps or `.desktop` files changed: `vm` only reloads the shell.
  After `deb`, log out and back in.

| Variable | Default | |
|---|---|---|
| `PILOTI_VM` | `debian@192.168.162.236` | ssh target |
| `PILOTI_VM_DIR` | `.cache/piloti-try` | the VM's clone, under its `$HOME`; on the VM's disk, not a link or `/mnt/hgfs` (refused) |

An ssh key saves typing the password each time:
`ssh-copy-id debian@192.168.162.236`. `deb` still asks for the sudo password.

## Inside the VM

These run in the VM, from a folder shared with the Mac or from its own clone.

| Script | What it does |
|---|---|
| `vm-try.sh dev\|deb <branch>` | Called by `try.sh`: fetch the branch into the VM's clone, then build (`dev`: shell and reload; `deb`: `.deb` and install). `--local <N>` builds the files `try.sh` copied over instead. |
| `vm-build.sh` | Build the `.deb` from the shared folder: copies the sources to `~/.cache/piloti-deb-build` (the shared `node_modules` are macOS ones), builds, copies the `.deb` back to `dist/`. |
| `vm-update.sh` | `git pull` in the shared folder, then `vm-build.sh` and install the `.deb`. |
| `vm-dev.sh [watch]` | Sync the shared folder into the VM's clone, build the shell, reload. `watch` repeats on every change. Uses `PILOTI_SHARED` and `PILOTI_LOCAL`. |

## Build and generate

| Script | Run | What it does |
|---|---|---|
| `build-deb.mjs` | `npm run build:deb` | `.deb` from `data/files/`, `dist/shell.js` and `debian/`. Flags: `--skip-build`, `--stage-only`, `--stage-dir <dir>`, `--out <file.deb>`. Works on macOS and Linux. |
| `generate-gschemas.ts` | `~/.bun/bin/bun scripts/generate-gschemas.ts` | GSettings schema from the settings table. Run after changing `core/config/piloti-settings-ini.ts` (a test checks). |
| `generate-piloti-icons.mjs` | `node scripts/generate-piloti-icons.mjs` | Icons and default tree, after changing `data/files/`. |
| `data-files.mjs` | (imported) | Lists `data/files/` for the web demo (`__fs/`). Used by `vite.config.ts`. |
| `version.mjs` | (imported) | Build version: `package.json`'s, then `-N` for the commits since the tag. `PILOTI_REVISION` overrides N. |
