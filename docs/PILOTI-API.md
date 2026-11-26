# Piloti API

`piloti` is Domicile's desktop (SDK 2.2.0) plus what the Piloti shell adds.

```
piloti                  main API
├─ .vfs                 files                      everywhere
├─ .settings            settings, schema + key     window.piloti only
├─ .desktop             the shell's windows, apps  window.piloti only
├─ .notifications.push  post a notification        window.piloti only
├─ .plugins             loaded plugins             window.piloti only
└─ .files, .processes…  inherited from Domicile    everywhere
```

"Everywhere" means `usePiloti()` in components, the `piloti: Piloti` argument
in engine code, and `window.piloti`. "`window.piloti` only" is for scripts,
plugins and the console.

## Piloti

### piloti.vfs

The one file API (`src/lib/ports/vfs.ts`). Paths are absolute. Every call is
async and rejects with a `VfsError` (`code`: `not-found`, `exists`, `failed`).

```
piloti.vfs
  .readText(path)               string, or null if missing
  .read(path)                   Uint8Array, or null
  .write(path, data)            folder must exist; writes through symlinks
  .stat(path)                   { name, path, kind, size?, modifiedMs?, realPath } or null
  .list(dir)                    entries, hidden included, or null
  .watch(path, onChange)        returns stop
  .createDir(path)              creates missing parents
  .move(from, to, {overwrite?}) `to` is the full new path
  .copy(from, to)               rejects if `to` exists
  .symlink(target, linkPath)
  .trash(path)                  move to Trash; returns nothing
  .restore(trashPath)           a path in the Trash; returns the restored path
  .remove(path)                 delete for good
  .emptyTrash()
  .metadata(path, keys)         `metadata::*` values
  .setMetadata(path, patch)
  .thumbnail(path)              data URL, or undefined
```

`watch` calls `onChange` once when in place (load there), then on each change,
own writes included. A folder watch does not cover subfolders.

Views don't call `watch` themselves (a unit test checks): React code uses the
file hooks below; other code uses `retainVfsWatch(vfs, path, onChange)`
(`lib/engine/vfs-query.ts`), which shares one watch per path. Its `onChange`
gets `initial` = true once when the watch is in place for that caller.

File operations the user should be able to undo go through
`src/lib/engine/fs-undo.ts`. The shell's own operations (`lib/engine/fs-bridge.ts`:
create, rename, move, copy, trash, restore, remove) update the cached folder
listings as soon as they are done, then the listing reloads for the details.
A plain `piloti.vfs` write shows up through the watch.

### piloti.settings

Modelled on GSettings: a schema id holds typed keys.

```
piloti.settings
  .get(schema, key)             value
  .set(schema, key, value)      string | number | boolean | string[]
  .reset(schema, key)           back to the default
  .watch(schema, key, fn)       fn(newValue); returns stop
  .schemas                      the schemas defined so far
  .get()                        older whole-desktop object
  .update(patch)                older whole-desktop patch
```

```js
piloti.settings.get("org.piloti.desktop.dock", "icon-size");
```

A schema nobody defined reads as stored text, or `undefined` when unset.

In shell code, define a schema (`src/lib/engine/settings.ts`):

```ts
const calc = defineSettings("org.piloti.calculator", { scientific: false });
calc.get("scientific");                     // false until set
calc.set("scientific", true);
calc.reset("scientific");
calc.subscribe("scientific", () => {});     // returns stop
```

| Schema | File in `~/.config/piloti/` |
|---|---|
| `org.piloti.desktop[.*]` | `settings.ini` |
| `org.piloti.<app>[.*]` | `apps/<app>.ini` |
| anything else | `apps/<schema>.ini` |

Each schema is a section named after it. An app's file also has a `[General]`
section for keys the shell applies to the app (`color-scheme=dark`), read and
written with `getAppSetting` / `setAppSetting` (`lib/shell/app-settings.ts`) and
by plugins through `ctx.apps`.

Settings are preferences the user chose. What the shell remembers by itself
(window bounds, history, caches) stays in state files.

### piloti.desktop

The shell's own windows, built-in apps included. `piloti.windows` is
Domicile's (Linux client windows).

```
piloti.desktop
  .list                         the shell's windows
  .launchApp(appId)
  .openWebUrl(url, title?)
  .focus(id)
  .close(id)
  .minimize(id)
  .toggleMaximize(id)
```

There is no call yet to list installed (XDG) apps. React code uses `useApps()`.

### piloti.notifications, piloti.plugins

```
piloti.notifications
  .push({ summary, body?, urgency? })    urgency: low | normal | critical
piloti.plugins
  .list
```

`piloti.notifications` also keeps Domicile's members (below).

## Inherited from Domicile

Full types: `node_modules/@domicile-desktop/sdk/dist/desktop/`.

- **Calls** that can fail return a `Result`. `SystemError` is `{ kind, message }`
  (`NotFound`, `PermissionDenied`, `Locked`, `Dbus`…).
- **State** (`list`, `current`…) is read directly and may be `undefined` at
  first. `x.on("change", fn)` returns an unsubscribe function.
- **Paths** that are relative start at home.

```ts
const res = await piloti.processes.run(["uname", "-r"]);
res.match({ Ok: (out) => out, Err: (e) => e.message });
```

### piloti.files

Prefer `piloti.vfs`. Where Domicile's call is needed, use
`hostFiles(piloti)`, never `piloti.files` (a unit test checks).

```
piloti.files
  .read(path, {offset?, length?})    Uint8Array
  .readText(path)                    string
  .write(path, data, {atomic?})
  .createDir(path)
  .readDir(path)                     [{ name, fileType }]
  .stat(path)                        { fileType, size, modifiedMs, realPath }
  .watch(path)                       { items, stop, ended }
  .search(query)                     { files, matched, … }, not a Result
```

### piloti.processes

```
piloti.processes
  .run(argv, {cwd?, env?})           { code, signal, stdout, stderr }
  .spawn(argv, {cwd?, env?, stdin?}) { stdout, stderr, exited, write, closeStdin, kill }
  .launch(argv)                      start an app, no result
```

`argv` is an array with no shell; use `["sh", "-c", …]` if needed. A non-zero
exit is still `Ok`, so check `code`.

### piloti.dbus

```
piloti.dbus
  .call({ bus, destination, path, interface, member, signature?, body? })
  .match({ bus, sender?, path?, interface?, member? })    stream of signals
```

### Windows and screen

| Namespace | Members |
|---|---|
| `windows` | `list`, `focused`, `focus(id)`, `focusShell()`, `close(id)`, `setBounds(id, box)`, `setStates()`, `requests()`, `syncFrames()` |
| `displays` | `list`, `addVirtual(mode)`, `setColorTemperature(kelvin, display?)` |
| `capture` | `screenshot()`, `screenRecord()`, `preview(window)` |
| `pointer` | `warp(x, y, unlessOver?)` |

### Input and session

| Namespace | Members |
|---|---|
| `keyboard` | `grab(chord)`, `ungrab(chord)`, `modifiers`, `keymaps()`, `selectKeymap()`; events `shortcut`, `shortcutrelease` |
| `gestures` | `grab("swipe:3")`, `ungrab()`; event `gesture` |
| `session` | `idle`, `locked`, `lock()`, `unlock(passphrase)`, `idleWarnings()`, `idleHolds()`, `unlockRefusals()` |

### Desktop services

| Namespace | Members |
|---|---|
| `notifications` | `list`, `dismiss(ids)`, `invoke(id, action)`, `reply(id, text)` |
| `tray` | `items`, `activate(id, action)`, `menu(address, onMenu)` |
| `clipboard` | `entries`, `copy(id)` |
| `downloads` | `list`, `cancel(id)`, `remove(id)`, `clear()` |
| `portals` | `requests`, `capturing`, `boundShortcuts`, `wallpaper`, `answer(id, answer)`, recording controls |
| `theme` | `current`, `windows`, `set("dark" \| "light")` |
| `appearance` | `accentColor`, `highContrast`, `reducedMotion` |

### Browser and shell

| Namespace | Members |
|---|---|
| `browser` | `windows`, `open(url)`, `openPrivate(url)`, `openApp(url)`, `close(id)`, `fetch(url, init)`, `countMatches()` |
| `extensions` | `list`, `activate(id)`; event `popup` |
| `googleCast` | `receivers`, `cast(id)`, `stop(route)` |
| `shell` | `options`, `commands()` |

## React hooks

### API access

| Hook | Gives |
|---|---|
| `usePiloti()` | `piloti` (`lib/engine/piloti.ts`) |
| `useWatch(piloti.x, "change", () => piloti.x.list)` | Domicile state, live (from `@domicile-desktop/react`) |
| `useCapabilities()` | what the engine can do |

### Files (`hooks/use-vfs.ts`)

Cached, shared by every view of a path, and refreshed when it changes.
Components use these rather than calling `vfs.watch`.

| Hook | Gives |
|---|---|
| `useVfsList(dir)` | folder entries, hidden included |
| `useVfsText(path)` | text, `null` if missing |
| `useVfsStat(path)` | kind, size, dates, `null` if missing |
| `useVfsWatch(path, onChange)` | change calls, for uncached data |
| `useVfsQuery(key, watchPath, load)` | the same caching for your own loader |
| `useVfsRefresh()` | `refresh(key)`, with keys from `vfsKeys` |

The first four take `null` as "nothing yet". The query hooks return a TanStack
Query result (`data`, `isPending`…).

```tsx
const { data: text } = useVfsText(path);
```

### Settings

```tsx
const [scientific, setScientific] = useSetting(calc, "scientific");
```

`useSetting` is in `hooks/use-setting.ts`. `useSettings()` and
`useChromeSettings()` give the older whole-desktop settings.

### Shell

| Hook | Gives |
|---|---|
| `useApps()` | apps |
| `useOpenPath()` | open a file or folder with the right app |
| `useWindowActions()` | stable window actions |
| `useWindowManagerSelector(selector)` | a slice of window state |
| `usePlugins()` | plugins |
| `useFileUndoState()` | undo and redo labels for file operations |
