# Domicile

Piloti extends the domicile commands and apis.

What is Domicile ? 

> Domicile is an experimental Linux desktop where Chromium is the Wayland compositor, and the desktop is a web page. A shell is a module that exports `Shell`; Domicile calls it with the page's root element and the desktop. Each window is an `<app app-id>` element: put it where the window goes and style it with CSS.

A shell in React and Tailwind, `shell.tsx`:

```tsx
/// <reference types="@domicile-desktop/react/elements" />
import "@tailwindcss/browser";
import { mount } from "@domicile-desktop/react/mount";
import { useFocusedWindow, useWindows } from "@domicile-desktop/react/windows";

const Desktop = () => {
  const focused = useFocusedWindow();
  // Menus and tooltips have a parent. This shell leaves them out.
  const windows = useWindows().filter((window) => window.parent === undefined);
  return (
    <main className="flex h-screen gap-2 p-2">
      {windows.map((window) => (
        <app
          app-id={window.appId}
          className={window.appId === focused ? "flex-1 ring-2" : "flex-1"}
          key={window.appId}
        />
      ))}
    </main>
  );
};

export const Shell = mount(Desktop);
```

- Run it with `domicile ./shell.tsx`. After each change, `domicile load-shell ./shell.tsx` swaps it in place: windows stay open, and a shell that fails to build or run keeps the running shell.
- `domicile` only transpiles and bundles the file. `@domicile-desktop/*` and React come from Domicile; any other import is installed from npm into the nearest `package.json`.
- Nothing needs a build step: `import "@tailwindcss/browser";` is Tailwind compiled in the page, as a plain npm package. For a desktop you keep, bundle it yourself (your own Vite, Tailwind config and plugins) and run `domicile ./dist/shell.js`.
- React ignores `on…` props on `<app>`. Put handlers on an element around it, such as a title bar.
- `usePiloti()` is the desktop: `windows.focus(appId)`, `windows.close(appId)` and the rest of the typed API.
- `<NestedShell shell={Shell} />` (`@domicile-desktop/react/nested-shell`) runs another shell, such as `runManganese()` from `@domicile-desktop/manganese`, inside this one. Draw windows and bind keys in only one of them.
- A shell's page has `Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'`: no `eval`, `new Function` or inline scripts. WebAssembly compiles, so a shell can be Rust (see examples/dioxus-shell).

## Docs

### Understand it

- [How it works](https://domicile-desktop.com/docs/how-it-works)

### Write a shell

- [Install](https://domicile-desktop.com/docs/install)
- [Quickstart](https://domicile-desktop.com/docs/shells/quickstart)
- [Start from manganese](https://domicile-desktop.com/docs/shells/from-manganese)
- [How a shell works](https://domicile-desktop.com/docs/shells/writing)
- [Build an app](https://domicile-desktop.com/docs/apps/build)

### Guides

- [Browser windows](https://domicile-desktop.com/docs/shells/browser-windows)
- [Extensions](https://domicile-desktop.com/docs/shells/extensions)
- [Displays, theme, tray, notifications](https://domicile-desktop.com/docs/shells/desktop-events)
- [Idle and lock](https://domicile-desktop.com/docs/shells/idle-and-lock)
- [System access](https://domicile-desktop.com/docs/shells/system-access)
- [Dialogs and portals](https://domicile-desktop.com/docs/shells/dialogs)
- [Packaging](https://domicile-desktop.com/docs/shells/packaging)
- [Logs](https://domicile-desktop.com/docs/shells/logs)

### Reference

- [@domicile-desktop/react](https://domicile-desktop.com/docs/reference/react)
- [@domicile-desktop/sdk](https://domicile-desktop.com/docs/reference/sdk)
- [<app> and <webview>](https://domicile-desktop.com/docs/reference/elements)
- [The config file](https://domicile-desktop.com/docs/reference/config)
- [The domicile command](https://domicile-desktop.com/docs/reference/cli)

### What's new

- [Release notes](https://domicile-desktop.com/docs/release-notes)

## Optional

Manganese, Domicile's own shell, for its users:

- [Install](https://domicile-desktop.com/docs/manganese/install)
- [What it runs on](https://domicile-desktop.com/docs/manganese/compatibility)
- [First steps](https://domicile-desktop.com/docs/manganese/first-steps)
- [Keys](https://domicile-desktop.com/docs/manganese/keys)
- [Windows and workspaces](https://domicile-desktop.com/docs/manganese/windows)
- [Browsing and web apps](https://domicile-desktop.com/docs/manganese/browser)
- [Electron apps](https://domicile-desktop.com/docs/manganese/electron-apps)
- [Agents](https://domicile-desktop.com/docs/manganese/agents)
- [The launcher](https://domicile-desktop.com/docs/manganese/launcher)
- [The top bar](https://domicile-desktop.com/docs/manganese/top-bar)
- [Notifications](https://domicile-desktop.com/docs/manganese/notifications)
- [Clipboard](https://domicile-desktop.com/docs/manganese/clipboard)
- [Screenshots and recordings](https://domicile-desktop.com/docs/manganese/screenshots)
- [Locking and sleep](https://domicile-desktop.com/docs/manganese/lock)
- [Monitors and casting](https://domicile-desktop.com/docs/manganese/monitors)
- [Settings and the config file](https://domicile-desktop.com/docs/manganese/settings)
- [Appearance](https://domicile-desktop.com/docs/manganese/appearance)
- [Troubleshooting](https://domicile-desktop.com/docs/manganese/troubleshooting)
- [GPU and display issues](https://domicile-desktop.com/docs/manganese/gpu-and-displays)
- [Release notes](https://domicile-desktop.com/docs/manganese/release-notes)