# Piloti API quick reference

`piloti` is Domicile's desktop (SDK 2.2.0 types) plus what the shell adds.
The full types are in `node_modules/@domicile-desktop/sdk/dist/desktop/`.

## Basics

```ts
const piloti = usePiloti();            // in components
const res = await piloti.files.readText("Notes/todo.txt");
res.match({ Ok: (text) => text, Err: (e) => e.message });  // or res.unwrapOr("")
```

- **Calls** that can fail return a `Result`. `SystemError` is `{ kind, message }`
  (`NotFound`, `PermissionDenied`, `Locked`, `Dbus`…).
- **State** (`list`, `current`…) is read directly and may be `undefined` at
  first. `x.on("change", fn)` returns an unsubscribe function. In React:
  `useWatch(piloti.x, "change", () => piloti.x.list)`.
- **Paths** that are relative start at home.

## files

In Piloti code use `hostFiles(piloti)`, not `piloti.files` (a unit test checks).

```ts
read(path, {offset?, length?})   // Uint8Array
readText(path)                   // string
write(path, data, {atomic?})
createDir(path)
readDir(path)                    // [{ name, fileType }]
stat(path)                       // { fileType, size, modifiedMs, realPath }
watch(path)                      // { items, stop, ended }
search(query)                    // { files, matched, … }, not a Result
```

There is no delete, rename or copy: Piloti runs `mv`, `cp` and `gio trash`.

## processes

```ts
run(argv, {cwd?, env?})           // { code, signal, stdout, stderr }
spawn(argv, {cwd?, env?, stdin?}) // { stdout, stderr, exited, write, closeStdin, kill }
launch(argv)                      // start an app, no result
```

`argv` is an array with no shell; use `["sh", "-c", …]` if needed. A non-zero
exit is still `Ok`, so check `code`.

## dbus

```ts
call({ bus: Bus.System, destination, path, interface, member, signature?, body? })  // { signature, body }
match({ bus, sender?, path?, interface?, member? })   // stream of signals
```

## Windows and screen

| Namespace | Members |
|---|---|
| `windows` | `list`, `focused`, `focus(id)`, `focusShell()`, `close(id)`, `setBounds(id, box)`, `setStates()`, `requests()`, `syncFrames()` |
| `displays` | `list`, `addVirtual(mode)`, `setColorTemperature(kelvin, display?)` |
| `capture` | `screenshot()`, `screenRecord()`, `preview(window)` |
| `pointer` | `warp(x, y, unlessOver?)` |

## Input and session

| Namespace | Members |
|---|---|
| `keyboard` | `grab(chord)`, `ungrab(chord)`, `modifiers`, `keymaps()`, `selectKeymap()`; events `shortcut`, `shortcutrelease` |
| `gestures` | `grab("swipe:3")`, `ungrab()`; event `gesture` |
| `session` | `idle`, `locked`, `lock()`, `unlock(passphrase)`, `idleWarnings()`, `idleHolds()`, `unlockRefusals()` |

## Desktop services

| Namespace | Members |
|---|---|
| `notifications` | `list`, `dismiss(ids)`, `invoke(id, action)`, `reply(id, text)` |
| `tray` | `items`, `activate(id, action)`, `menu(address, onMenu)` |
| `clipboard` | `entries`, `copy(id)` |
| `downloads` | `list`, `cancel(id)`, `remove(id)`, `clear()` |
| `portals` | `requests`, `capturing`, `boundShortcuts`, `wallpaper`, `answer(id, answer)`, recording controls |
| `theme` | `current`, `windows`, `set("dark" \| "light")` |
| `appearance` | `accentColor`, `highContrast`, `reducedMotion` |

## Browser and shell

| Namespace | Members |
|---|---|
| `browser` | `windows`, `open(url)`, `openPrivate(url)`, `openApp(url)`, `close(id)`, `fetch(url, init)`, `countMatches()` |
| `extensions` | `list`, `activate(id)`; event `popup` |
| `googleCast` | `receivers`, `cast(id)`, `stop(route)` |
| `shell` | `options`, `commands()` |

## Piloti additions

On `window.piloti` only, for scripts, plugins and the console
(`src/lib/engine/piloti.ts`):

- `desktop`: `list`, `launchApp`, `openWebUrl`, `focus`, `close`, `minimize`, `toggleMaximize`
- `settings`: `get()`, `update(patch)`
- `plugins`: `list`
- `notifications.push({ summary, body?, urgency? })`
