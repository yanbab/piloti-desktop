# Piloti API

`piloti` is Domicile's desktop (SDK 2.2.0) plus what the shell adds.

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

| Schema | File in `~/.config/piloti/` |
|---|---|
| `org.piloti.desktop[.*]` | `settings.ini` |
| `org.piloti.<app>[.*]` | `apps/<app>.ini` |
| other | `apps/<schema>.ini` |

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
| `useChromeSettings()` | all but window bounds and icon positions |
| `useApps()`, `usePlugins()` | apps, plugins |
| `useOpenPath()` | open a file or folder |
| `useWindowActions()`, `useWindowManagerSelector(fn)` | window actions, window state |
| `useFileUndoState()` | undo and redo labels |

`useSettings()` re-renders on any change and is for contexts only (tested).
