# Plugins

Plugins live in `~/.config/piloti/plugins/` (user) and
`/usr/share/piloti/plugins/` (system). No build step.

On Linux the shell only runs its own code, so JavaScript works in the plugins
that ship with Piloti (built into the shell, `lib/plugins/bundled.ts`). Your own
plugins can use CSS and manifest entries there; their scripts run in the browser
demo only.

| Form | Effect |
|---|---|
| `name.css` | stylesheet |
| `name.js`, `name.mjs` | ES module |
| `name/` | optional `manifest.json`; else `style.css`, `index.js` or `index.mjs` |

Manage them in Settings > Advanced > User Plugins. `?safe-mode=1` skips
JavaScript.

## Manifest

All fields are optional (`lib/plugins/types.ts`).

```json
{
  "name": "Notes",
  "type": "plugin",
  "style": "style.css",
  "script": "index.js",
  "commands": [
    { "id": "notes", "title": "Quick Notes", "exec": ["gnome-text-editor", "notes.md"] }
  ]
}
```

Also: `id`, `version`, `description`, `main`, `gtk3Style`, `gtk4Style`,
`wallpapers`. A command takes `exec`, `url` or `appId`.

## Script

```js
export function activate(ctx) {
  const item = ctx.menubar.addStatusItem({
    id: "hello",
    label: "Hello",
    onClick: () => ctx.notify({ summary: "Hello" }),
  });
  ctx.onCleanup(() => item.remove());
}
```

`deactivate()` is optional; top-level code can use `window.piloti`. Plugins run
unsandboxed.

`ctx` holds what is undone when the plugin stops. The rest, windows and apps
included, is the [Piloti API](./API.md) on `ctx.piloti`.

| `ctx` | Members |
|---|---|
| `menubar` | `addStatusItem` |
| `launcher` | `registerProvider` |
| `commands`, `wallpapers` | `register` |
| `windows` | `setPresentation`, `getPresentation`, `addMenuItem` |
| `notify` | a notification in the plugin's name |
| `storage` | `get`, `set` |
| `pluginId`, `piloti`, `onCleanup` | |

## Window plugins

- `ctx.windows.setPresentation(id, box)` shows a window moved and scaled without changing
  its geometry; `null` restores it. Coordinates are in the work area.
- `interactive: false` sends the pointer to `onPointerDown` and `onDoubleClick`.
  `above: true` keeps it on top.
- `floating: { resizable?, minWidth?, maxWidth? }` lets the shell drag, snap and
  resize it (`lib/windows/floating-window.ts`); `onChange` reports the result.
- `ctx.windows.addMenuItem` adds to the window menu.

Example: the bundled `picture-in-picture` plugin.
