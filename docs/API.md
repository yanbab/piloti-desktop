# Piloti API

`piloti` is Domicile's desktop (SDK 3.0.0) plus what the shell adds.

| Member | What | Where |
|---|---|---|
| `.vfs` | files | everywhere |
| `.settings`, `.desktop`, `.plugins`, `.notifications.push` | shell additions | `window.piloti` |
| `.files`, `.processes`, `.dbus`… | Domicile | everywhere |

"Everywhere" is `usePiloti()`, the `piloti` argument in engine code and
`window.piloti`. The latter is for scripts, plugins and the console.

## vfs

`src/lib/ports/vfs.ts`. Absolute paths, async, rejects with a `VfsError`
(`not-found`, `exists`, `failed`).

```
readText(path)  read(path)          content, or null if missing
write(path, data)                   folder must exist; follows symlinks
stat(path)  list(dir)               null if missing; list includes hidden
watch(path, onChange)               returns stop
createDir(path)                     with parents
move(from, to, {overwrite?})        `to` is the full new path
copy(from, to)  symlink(target, link)
trash(path)  restore(trashPath)     restore returns the path
remove(path)  emptyTrash()          for good
metadata(path, keys)  setMetadata(path, patch)
thumbnail(path)                     data URL or undefined
```

- `watch` calls once when in place (load there), then on changes. Not recursive.
- Views use the file hooks, not `watch` (tested). Other code uses
  `retainVfsWatch()` (`lib/engine/vfs-query.ts`) to share watches.
- Undoable operations go through `lib/engine/fs-undo.ts`.
- `lib/engine/fs-bridge.ts` operations update cached listings at once.

## settings

Schema id plus typed keys (`string`, `number`, `boolean`, `string[]`).

```
get(schema, key)  set(schema, key, value)  reset(schema, key)
watch(schema, key, fn)    returns stop
schemas                   defined schemas
get()  update(patch)      older whole-desktop object
```

In shell code (`lib/engine/settings.ts`):

```ts
const calc = defineSettings("org.piloti.calculator", { scientific: false });
calc.get("scientific");   // also set, reset, subscribe
```

| Schema | Stored in |
|---|---|
| `org.piloti.desktop[.*]` | dconf on Linux when Piloti's schema is installed (`gsettings get org.piloti.desktop.dock icon-size`); otherwise `~/.config/piloti/settings.ini` |
| `org.piloti.<app>[.*]` | `~/.config/piloti/apps/<app>.ini` |
| other | `~/.config/piloti/apps/<schema>.ini` |

The `.deb` installs `/usr/share/glib-2.0/schemas/org.piloti.desktop.gschema.xml`,
generated from the settings table (`bun scripts/generate-gschemas.ts`; a test
checks it is current). The first start with it copies settings.ini into dconf;
after that settings.ini is no longer read on Linux.

**GNOME links** (Linux). `data/files/usr/share/piloti/gsettings-links.ini`
(installed to `/usr/share/piloti/`) lists the Piloti keys that follow a GNOME
key: appearance, clock, fonts, wallpaper, window buttons, notifications. While
`org.piloti.desktop.system sync-gnome-settings` is on, a linked key reads
GNOME's value once one is set, and a change writes both. First-run values are
not sent to GNOME. The icon theme is sent only. Needs `dconf`; the file's
header gives the format.

An app file's `[General]` section holds keys the shell applies to the app
(`getAppSetting`, `setAppSetting`, `ctx.apps`). Unknown schemas read as text.
Remembered state (window bounds, history) is not a setting.

## Other shell additions

```
desktop         list, launchApp(id), openWebUrl(url, title?), focus(id),
                close(id), minimize(id), toggleMaximize(id)
notifications   push({ summary, body?, urgency? })
plugins         list
```

`desktop` is the shell's own windows; `windows` is Linux client windows.
Installed apps are not listed here (React: `useApps()`).

## Domicile

Types: `node_modules/@domicile-desktop/sdk/dist/desktop/`.

- Fallible calls return a `Result`; errors are `{ kind, message }`.
- State (`list`, `current`) may be `undefined` at first; `x.on("change", fn)`.
- Relative paths start at home.

| Namespace | Members |
|---|---|
| `files` | `read`, `readText`, `write`, `createDir`, `readDir`, `stat`, `watch`, `search`. Prefer `vfs`; else `hostFiles(piloti)` (tested) |
| `processes` | `run(argv)`, `spawn(argv)`, `launch(argv)`. No shell; check `code` |
| `dbus` | `call(…)`, `match(…)` |
| `windows` | `list`, `focused`, `focus`, `focusShell`, `close`, `setBounds`, `setStates`, `requests`, `syncFrames` |
| `displays`, `capture`, `pointer` | `list`, `addVirtual`, `setColorTemperature`; `screenshot`, `screenRecord`, `preview`; `warp` |
| `keyboard`, `gestures` | `grab`, `ungrab`, `modifiers`, `keymaps`, `selectKeymap` |
| `session` | `idle`, `locked`, `lock`, `unlock`, `idleWarnings`, `idleHolds`, `unlockRefusals` |
| `notifications`, `tray` | `list`, `dismiss`, `invoke`, `reply`; `items`, `activate`, `menu` |
| `clipboard`, `downloads` | `entries`, `copy`; `list`, `cancel`, `remove`, `clear` |
| `portals` | `requests`, `capturing`, `boundShortcuts`, `wallpaper`, `answer`, recording |
| `theme`, `appearance` | `current`, `set`; `accentColor`, `highContrast`, `reducedMotion` |
| `browser` | `windows`, `open`, `openPrivate`, `openApp`, `close`, `fetch`, `countMatches` |
| `extensions`, `googleCast`, `shell` | `list`, `activate`; `receivers`, `cast`, `stop`; `options`, `commands` |

## Command line

`piloti` is a wrapper that sends commands to the running shell
(`domicile send-shell`). Commands it doesn't have go to
[`domicile`](https://domicile-desktop.com/docs/reference/cli): `status`,
`list-windows`, `list-displays`, `logs`, `list-shell-commands`…

| `piloti` command | Does |
|---|---|
| `session [args]` (default), `greeter` | start the desktop or the greeter |
| `reload [shell.js]`, `which-shell` | reload, or print, the shell |
| `open [--app] <app\|url\|file> [arg]` | open an app, URL or file |
| `settings [pane]` | open Settings |
| `theme dark\|light\|system\|toggle` | change Piloti's color scheme |
| `launcher`, `overview` | open the Launcher; toggle the Overview |
| `screenshot [file]`, `record` | capture |
| `lock`, `logout`, `restart`, `poweroff` | session and power |
| `install <url>`, `remove <url\|id>`, `list` | web apps (aliases `add`; `del`, `uninstall`) |
| `send <word...>` | send a raw shell command |
| `help`, `version` | usage, version |

Shell commands live in `lib/shell/shell-commands.ts`.

Where names differ, Piloti's win (`open`, `lock`, `screenshot`). Prefer
`piloti theme` to `domicile theme`, which the shell does not follow.

## Piloti shell

The Terminal's JavaScript mode (menu: Piloti Shell). A line is read as:

| Line | Runs |
|---|---|
| `name arg 'other arg'` | `name("arg", "other arg")`, for a function of the shell |
| `git status` | the program of `$PATH`, or a path (`./run.sh`), Linux only |
| anything else | JavaScript, `await` included |

**Arguments.** Bare and quoted words are text; `*` and `?` match file names.
`$name`, `$(expression)`, `{…}` and `[…]` are JavaScript values. For shell
functions other than file commands, bare numbers, `true`, `false` and `null`
keep their type. `name(…)`, `name = …` and `name + …` stay JavaScript.

**On Linux** the shell's security policy forbids `eval`, so JavaScript is limited
to expressions and simple statements (calls, `await`, `const`). Loops, blocks and
`.psh` scripts only run in the browser demo.

**Programs** run on a pseudo-terminal in the current folder, so interactive ones
work. Shell names win over programs (`ls` is the shell's; `/bin/ls` is not).
There are no pipes, redirections or `&&`: use `sh -c '…'`.

**Tab** completes command names, file paths and object members
(`piloti.desktop.`); twice lists the choices.

**Prompt.** The folder in the accent color: from home inside it
(`Documents/files> `, just `> ` in home), else absolute (`/etc> `).

**`ls`** takes `-a`, `-A`, `-l`, `-h`, with the usual colors (also in the string
`await ls()` returns). `-l` is a table of type, size, date and name: the VFS has
no permissions or owners, so executables are not colored.

**Aliases.** `alias name='value'`, `alias`, `unalias name`. Defaults: `ll`
(`ls -la`), `la` (`ls -a`), `less` and `more` (`cat`). Kept for the window.

**Scripts** (`.psh`) run with `source file` or `./file.psh`. A script is one
JavaScript program in which a line may be a command, so variables, `if` and
loops work across lines:

```
# backup.psh
const folder = 'backup'
mkdir -p $folder
for (const name of ['a.txt', 'b.txt']) {
  cp $name $folder
}
```

- A command takes a whole line; `if (x) { ls }` on one line is JavaScript.
- Commands print their result; JavaScript lines do not (use `echo`).
- To keep a command's result, call it: `const text = await cat('a.txt')`.
- A line starting with a name the script declares is JavaScript.
- `#` starts a comment line. The first error ends the script; a program's exit
  code does not. Ctrl+C stops it.

**Loops** in scripts and typed lines are checked, so they cannot freeze the
desktop: they pause every 50 ms and Ctrl+C stops them. In a function that is not
`async` a loop cannot pause, and is stopped after 5 s.

`~/.config/piloti-shell/autoexec.psh` runs when the shell starts, and goes on
after a failed command (not after a JavaScript error): put aliases and `cd`
there.

**`top`** lists processes by CPU, from `/proc`, every 2 s; `q` or Ctrl+C quits.
`/usr/bin/top` is the system's. The browser demo's `/proc` is made up
(`stat`, `meminfo`, `<pid>/stat`), with a process per running app.

**Tables.** A non-empty array of objects, or its JSON text (a result, `cat`, a
program's output), prints as a table with a line under its header. It shows six
columns at most (`id`, `name`, `title` first) and cuts wide cells with `…`.
`-a` shows every column (`apps -a`, `cat list.json -a`), wrapping if need be;
a program's `-a` is its own. `x.map(JSON.stringify)` avoids the table.

| Functions | |
|---|---|
| `cd`, `pwd`, `ls [-alh]`, `cat`, `echo` | look around |
| `touch`, `mkdir [-p]`, `cp [-r]`, `mv`, `ln -s` | create and move, on `piloti.vfs` |
| `rm [-r] [-f]`, `rmdir`, `trash` | `rm` is for good; it refuses `/`, home and the current folder |
| `open`, `clear`, `help` | open with its app; clear; list functions |
| `windows`, `settings`, `set`, `apps`, `launch`, `notify` | the desktop |
| `alias`, `unalias`, `source`, `top` | see above |
| `run(cmd)` | a `sh -c` command, returns `{ code, stdout, stderr }` |
| `files`, `piloti` | Domicile's files; the desktop |

File operations are not in the Folders undo history. Code:
`lib/shell/piloti-{repl,commands,programs,run,completion,table,top,script,loops}.ts`.

## React hooks

| Hook | Gives |
|---|---|
| `usePiloti()` | `piloti` |
| `useWatch(obj, "change", read)` | live Domicile state |
| `useCapabilities()` | engine capabilities |
| `useVfsList(dir)`, `useVfsText(path)`, `useVfsStat(path)` | cached, live file data (TanStack Query result) |
| `useVfsWatch(path, fn)` | change calls |
| `useVfsQuery(key, watchPath, load)`, `useVfsRefresh()` | own loader; refresh a `vfsKeys` key |
| `useSetting(calc, "key")` | `[value, set]` |
| `useDesktopSetting("dockSize")`, `useDesktopSettings([…])` | desktop settings, re-render on those only |
| `useUpdateSettings()`, `useSettingsSelector(fn)` | patch; derived value |
| `useApps()`, `usePlugins()` | apps, plugins |
| `useOpenPath()` | open a file or folder |
| `useWindowActions()`, `useWindowManagerSelector(fn)` | window actions, window state |
| `useFileUndoState()` | undo and redo labels |

`useSettings()` re-renders on any change and is for contexts only (tested).
