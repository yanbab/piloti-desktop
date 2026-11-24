// Auto-generated from data/files/.
export const DEFAULT_HOME_DIRS: readonly string[] = [
  "/home/user",
  "/home/user/.cache",
  "/home/user/.cache/piloti",
  "/home/user/.config",
  "/home/user/.config/domicile",
  "/home/user/.config/piloti",
  "/home/user/.config/piloti/plugins",
  "/home/user/.config/piloti/plugins/aurora-drift",
  "/home/user/.config/piloti/plugins/picture-in-picture",
  "/home/user/.config/piloti/plugins/piloti-showcase",
  "/home/user/.local",
  "/home/user/.local/share",
  "/home/user/.local/share/applications",
  "/home/user/.local/share/Trash",
  "/home/user/.local/share/Trash/files",
  "/home/user/.local/state",
  "/home/user/.local/state/piloti",
  "/home/user/Desktop",
  "/home/user/Documents",
  "/home/user/Downloads",
  "/home/user/Music",
  "/home/user/Pictures",
  "/home/user/Templates",
  "/home/user/Videos"
];

export const DEFAULT_HOME_FILES: Record<string, string> = {
  "/home/user/.config/mimeapps.list": "[Default Applications]\ninode/directory=nautilus.desktop\ntext/plain=text-editor.desktop\ntext/markdown=text-editor.desktop\ntext/html=browser.desktop\napplication/json=text-editor.desktop\nimage/png=image-viewer.desktop\nimage/jpeg=image-viewer.desktop\nimage/webp=image-viewer.desktop\nimage/gif=image-viewer.desktop\nimage/svg+xml=image-viewer.desktop\nimage/bmp=image-viewer.desktop\nimage/avif=image-viewer.desktop\napplication/pdf=browser.desktop\napplication/x-desktop=text-editor.desktop\napplication/vnd.debian.binary-package=piloti-appstore.desktop\napplication/vnd.flatpak.ref=piloti-appstore.desktop\nx-scheme-handler/http=browser.desktop\nx-scheme-handler/https=browser.desktop\n\n[Added Associations]\ninode/directory=nautilus.desktop;terminal.desktop;\ntext/plain=text-editor.desktop;terminal.desktop;\ntext/markdown=text-editor.desktop;browser.desktop;\ntext/html=browser.desktop;text-editor.desktop;\ntext/*=text-editor.desktop;terminal.desktop;\napplication/json=text-editor.desktop;console.desktop;\nimage/*=image-viewer.desktop;browser.desktop;\naudio/*=browser.desktop;\nvideo/*=browser.desktop;\napplication/pdf=browser.desktop;\n",
  "/home/user/.config/piloti/plugins/aurora-drift/manifest.json": "{\n  \"id\": \"aurora-drift\",\n  \"name\": \"Aurora Drift Wallpaper\",\n  \"version\": \"1.0.0\",\n  \"description\": \"Subtle CSS-animated gradient wallpaper plugin for Settings → Wallpaper\",\n  \"wallpapers\": [\n    {\n      \"id\": \"aurora-drift\",\n      \"name\": \"Aurora Drift\",\n      \"subtitle\": \"Subtle CSS animated glow\",\n      \"type\": \"css\",\n      \"style\": \"wallpaper.css\",\n      \"darkStyle\": \"wallpaper-dark.css\",\n      \"backgroundCss\": \"linear-gradient(160deg, #dbeafe 0%, #e0f2fe 55%, #ccfbf1 100%)\"\n    }\n  ]\n}\n\n",
  "/home/user/.config/piloti/plugins/aurora-drift/wallpaper-dark.css": "@keyframes piloti-aurora-drift-dark {\n  0%, 100% {\n    background-position: 10% 30%, 90% 70%;\n    filter: hue-rotate(0deg);\n  }\n  50% {\n    background-position: 45% 65%, 55% 35%;\n    filter: hue-rotate(14deg);\n  }\n}\n\n.piloti-wp-anim {\n  background-color: color-mix(in srgb, var(--adw-active-accent, #007aff) 10%, #050811);\n  background-image:\n    radial-gradient(66% 58% at 25% 35%, color-mix(in srgb, var(--adw-active-accent, #007aff) 48%, transparent) 0%, transparent 64%),\n    radial-gradient(62% 56% at 76% 74%, color-mix(in srgb, var(--adw-active-accent, #007aff) 32%, #1d4ed8 14%) 0%, transparent 66%);\n  background-size: 145% 145%, 145% 145%;\n  animation: piloti-aurora-drift-dark 22s ease-in-out infinite;\n}\n\n",
  "/home/user/.config/piloti/plugins/aurora-drift/wallpaper.css": "@keyframes piloti-aurora-drift-light {\n  0%, 100% {\n    background-position: 0% 40%, 100% 60%;\n    filter: hue-rotate(0deg);\n  }\n  50% {\n    background-position: 35% 65%, 65% 30%;\n    filter: hue-rotate(12deg);\n  }\n}\n\n.piloti-wp-anim {\n  background-color: color-mix(in srgb, var(--adw-active-accent, #007aff) 14%, #eef4ff);\n  background-image:\n    radial-gradient(68% 62% at 24% 32%, color-mix(in srgb, var(--adw-active-accent, #007aff) 46%, transparent) 0%, transparent 65%),\n    radial-gradient(62% 58% at 78% 72%, color-mix(in srgb, var(--adw-active-accent, #007aff) 34%, #a855f7 16%) 0%, transparent 68%);\n  background-size: 140% 140%, 140% 140%;\n  animation: piloti-aurora-drift-light 22s ease-in-out infinite;\n}\n\n",
  "/home/user/.config/piloti/plugins/picture-in-picture/index.js": "// Picture in Picture — a window manager feature written as a desktop plugin.\n//\n// The window menu gets a \"Picture in Picture\" entry. The window becomes a\n// floating window: scaled down (like the overview does), kept above the\n// others, moved anywhere by dragging (it snaps to the edges and resists past\n// them) and resized from its borders, which scales it. Its real size and\n// position do not change, so leaving PiP puts it back exactly where it was.\n//\n//   drag             move it\n//   drag a border    resize it\n//   double-click     back to normal\n\nconst WIDTH_RATIO = 0.26; // default width, of the work area width\nconst MIN_WIDTH = 200;\nconst MAX_WIDTH_RATIO = 0.7;\nconst MARGIN = 6; // same gap as the shell's floating windows and menus\n\nexport function activate(ctx) {\n  const pipWindows = new Set();\n\n  const naturalSize = (win, area) =>\n    win.maximized\n      ? { width: area.width, height: area.height }\n      : { width: win.size.width, height: win.size.height };\n\n  // Last place and width the user gave a PiP window, or the bottom-right corner.\n  function initialRect(win) {\n    const area = ctx.windows.getWorkArea();\n    const natural = naturalSize(win, area);\n    const saved = ctx.storage.get(\"rect\");\n    const width = Math.round(\n      Math.min(\n        natural.width,\n        area.width * MAX_WIDTH_RATIO,\n        saved?.width ?? Math.max(MIN_WIDTH, area.width * WIDTH_RATIO)\n      )\n    );\n    const height = (natural.height * width) / natural.width;\n    const maxX = area.x + area.width - width - MARGIN;\n    const maxY = area.y + area.height - height - MARGIN;\n    const clamp = (n, min, max) => Math.round(Math.min(max, Math.max(min, n)));\n    return {\n      width,\n      x: clamp(saved?.x ?? maxX, area.x + MARGIN, maxX),\n      y: clamp(saved?.y ?? maxY, area.y + MARGIN, maxY),\n    };\n  }\n\n  function enter(windowId) {\n    const win = ctx.windows.get(windowId);\n    if (!win) return;\n    const area = ctx.windows.getWorkArea();\n    pipWindows.add(windowId);\n    ctx.windows.setPresentation(windowId, {\n      ...initialRect(win),\n      above: true,\n      floating: {\n        resizable: true,\n        minWidth: MIN_WIDTH,\n        maxWidth: area.width * MAX_WIDTH_RATIO,\n      },\n      onChange: (rect) => ctx.storage.set(\"rect\", rect),\n      onDoubleClick: () => exit(windowId),\n    });\n  }\n\n  function exit(windowId) {\n    pipWindows.delete(windowId);\n    ctx.windows.setPresentation(windowId, null);\n    ctx.windows.focus(windowId);\n  }\n\n  // The shell drops the presentation of a window that closes.\n  const isPip = (windowId) =>\n    pipWindows.has(windowId) && Boolean(ctx.windows.getPresentation(windowId));\n\n  ctx.windows.addMenuItem({\n    id: \"toggle\",\n    label: \"Picture in Picture\",\n    checked: isPip,\n    onSelect: (windowId) => (isPip(windowId) ? exit(windowId) : enter(windowId)),\n  });\n\n  ctx.onCleanup(() => pipWindows.clear());\n}\n",
  "/home/user/.config/piloti/plugins/picture-in-picture/manifest.json": "{\n  \"id\": \"picture-in-picture\",\n  \"name\": \"Picture in Picture\",\n  \"version\": \"1.0.0\",\n  \"description\": \"Adds Picture in Picture to the window menu: the window shrinks to a corner and stays on top.\",\n  \"script\": \"index.js\"\n}\n",
  "/home/user/.config/piloti/plugins/piloti-showcase/gtk3.css": "/* Piloti Showcase GTK 3 style snippet */\nheaderbar {\n  border-bottom: 1px solid alpha(#2190a4, 0.25);\n}\n\n",
  "/home/user/.config/piloti/plugins/piloti-showcase/gtk4.css": "/* Piloti Showcase GTK 4 style snippet */\nheaderbar {\n  box-shadow: inset 0 -1px 0 alpha(@accent_color, 0.25);\n}\n\n",
  "/home/user/.config/piloti/plugins/piloti-showcase/index.js": "// Piloti Showcase Plugin — demonstrates the full PilotiPluginContext API\nexport function activate(ctx) {\n  let notesCount = Number(ctx.storage.get(\"focusCount\") ?? 0);\n\n  // 1. Menubar Status Item with persisted click counter & notification\n  const status = ctx.menubar.addStatusItem({\n    id: \"focus-counter\",\n    label: `✦ ${notesCount}`,\n    tooltip: \"Piloti Showcase Plugin — click to increment focus check-in\",\n    onClick() {\n      notesCount += 1;\n      ctx.storage.set(\"focusCount\", notesCount);\n      status.update({ label: `✦ ${notesCount}` });\n      ctx.notifications.push({\n        summary: \"Showcase Check-in\",\n        body: `Recorded ${notesCount} focus session(s).`,\n      });\n    },\n  });\n\n  // 2. Programmatic CSS Animated Wallpaper registration\n  ctx.wallpapers.register({\n    id: \"showcase-teal-pulse\",\n    name: \"Teal Pulse (JS Plugin)\",\n    subtitle: \"Programmatic CSS animated wallpaper\",\n    kind: \"css\",\n    backgroundCss: \"linear-gradient(160deg, #07131a 0%, #0d2b36 100%)\",\n    cssAnimation: `\n      @keyframes piloti-showcase-pulse {\n        0%, 100% { transform: scale(1) translate3d(0, 0, 0); opacity: 0.72; }\n        50% { transform: scale(1.08) translate3d(2%, -2%, 0); opacity: 1; }\n      }\n      .piloti-wp-anim {\n        background:\n          radial-gradient(65% 60% at 30% 35%, rgba(33, 144, 164, 0.45) 0%, transparent 65%),\n          radial-gradient(60% 55% at 75% 75%, rgba(53, 132, 228, 0.35) 0%, transparent 70%),\n          linear-gradient(170deg, #050b14 0%, #091c28 100%);\n        animation: piloti-showcase-pulse 16s ease-in-out infinite;\n      }\n    `,\n  });\n\n  // 3. Custom Launcher Search Provider\n  ctx.launcher.registerProvider({\n    id: \"showcase-tools\",\n    search(query) {\n      const q = query.trim().toLowerCase();\n      if (!q) return [];\n      const items = [\n        {\n          id: \"inc\",\n          title: `Showcase: Check-in (${notesCount})`,\n          subtitle: \"Increment showcase counter and notify\",\n          keywords: \"showcase check-in focus counter plugin\",\n        },\n        {\n          id: \"files\",\n          title: \"Showcase: Browse Plugins Folder\",\n          subtitle: \"~/.config/piloti/plugins\",\n          keywords: \"showcase plugins folder browse\",\n        },\n      ];\n      return items.filter(\n        (item) =>\n          item.title.toLowerCase().includes(q) ||\n          item.keywords.toLowerCase().includes(q)\n      );\n    },\n    onSelect(item) {\n      if (item.id === \"inc\") {\n        notesCount += 1;\n        ctx.storage.set(\"focusCount\", notesCount);\n        status.update({ label: `✦ ${notesCount}` });\n        ctx.notifications.push({\n          summary: \"Showcase Check-in\",\n          body: `Total check-ins: ${notesCount}`,\n        });\n      } else if (item.id === \"files\") {\n        ctx.windows.launchApp(\"nautilus\");\n      }\n    },\n  });\n\n  // 4. Command Palette Entry\n  ctx.commands.register({\n    id: \"reset-counter\",\n    title: \"Showcase: Reset Check-in Counter\",\n    keywords: \"showcase reset counter plugin\",\n    run() {\n      notesCount = 0;\n      ctx.storage.set(\"focusCount\", 0);\n      status.update({ label: \"✦ 0\" });\n      ctx.notifications.push({\n        summary: \"Showcase Reset\",\n        body: \"Focus check-in counter reset to 0.\",\n      });\n    },\n  });\n\n  // 5. Periodic subtle clock/heartbeat timer cleaned up automatically\n  const timer = setInterval(() => {\n    status.update({\n      tooltip: `Piloti Showcase (${notesCount} check-ins) · ${new Date().toLocaleTimeString()}`,\n    });\n  }, 60_000);\n\n  ctx.onCleanup(() => {\n    clearInterval(timer);\n  });\n}\n\nexport function deactivate() {\n  // Optional teardown hook when disabled or reloaded\n}\n\n",
  "/home/user/.config/piloti/plugins/piloti-showcase/manifest.json": "{\n  \"id\": \"piloti-showcase\",\n  \"name\": \"Piloti Showcase Plugin\",\n  \"version\": \"1.0.0\",\n  \"description\": \"Complete example: menubar indicator, launcher provider, commands, HTML/CSS wallpapers, and shell/GTK styles\",\n  \"style\": \"style.css\",\n  \"gtk4Style\": \"gtk4.css\",\n  \"gtk3Style\": \"gtk3.css\",\n  \"script\": \"index.js\",\n  \"commands\": [\n    {\n      \"id\": \"open-wallpaper-settings\",\n      \"title\": \"Showcase: Open Desktop Settings\",\n      \"keywords\": \"showcase settings wallpaper theme\",\n      \"appId\": \"settings\"\n    }\n  ],\n  \"wallpapers\": [\n    {\n      \"id\": \"showcase-starlight-html\",\n      \"name\": \"Starlight Drift (HTML)\",\n      \"subtitle\": \"Subtle HTML canvas live wallpaper\",\n      \"type\": \"html\",\n      \"html\": \"wallpaper.html\",\n      \"backgroundCss\": \"linear-gradient(175deg, #060913 0%, #0d172a 100%)\"\n    }\n  ]\n}\n\n",
  "/home/user/.config/piloti/plugins/piloti-showcase/style.css": "/* Piloti Showcase CSS — subtle accent highlight on active menubar triggers */\n:root {\n  --piloti-showcase-badge-color: #2190a4;\n}\n\n[data-slot=\"menubar-trigger\"][data-popup-open] {\n  box-shadow: inset 0 -2px 0 var(--piloti-showcase-badge-color);\n}\n\n",
  "/home/user/.config/piloti/plugins/piloti-showcase/wallpaper.html": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <style>\n      html, body {\n        margin: 0;\n        width: 100%;\n        height: 100%;\n        overflow: hidden;\n        background: radial-gradient(80% 70% at 70% 80%, rgba(33, 144, 164, 0.25), transparent 65%),\n                    linear-gradient(175deg, #050811 0%, #0b1426 68%, #0e1c33 100%);\n      }\n      canvas {\n        display: block;\n        width: 100%;\n        height: 100%;\n      }\n    </style>\n  </head>\n  <body>\n    <canvas id=\"c\"></canvas>\n    <script>\n      const canvas = document.getElementById(\"c\");\n      const ctx = canvas.getContext(\"2d\");\n      const reduced = window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches;\n      const dots = Array.from({ length: 36 }, (_, i) => ({\n        x: (i * 0.6180339887) % 1,\n        y: (i * 0.3819660113) % 1,\n        r: 1 + (i % 3) * 0.65,\n        speed: 0.008 + (i % 5) * 0.004,\n        phase: i * 0.7,\n      }));\n      function resize() {\n        const dpr = Math.min(window.devicePixelRatio || 1, 2);\n        canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));\n        canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));\n        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);\n      }\n      resize();\n      window.addEventListener(\"resize\", resize);\n      function draw(ts) {\n        const t = ts * 0.001;\n        const w = window.innerWidth;\n        const h = window.innerHeight;\n        ctx.clearRect(0, 0, w, h);\n        for (const d of dots) {\n          const px = ((d.x + (reduced ? 0 : t * d.speed * 0.2)) % 1) * w;\n          const py = ((d.y - (reduced ? 0 : t * d.speed * 0.12) + 1) % 1) * h;\n          const alpha = 0.2 + 0.28 * Math.sin(d.phase + (reduced ? 0 : t * 0.9));\n          ctx.fillStyle = `rgba(186, 230, 253, ${alpha.toFixed(3)})`;\n          ctx.beginPath();\n          ctx.arc(px, py, d.r, 0, Math.PI * 2);\n          ctx.fill();\n        }\n        if (!reduced) requestAnimationFrame(draw);\n      }\n      requestAnimationFrame(draw);\n    </script>\n  </body>\n</html>\n\n",
  "/home/user/.config/user-dirs.dirs": "# Written by xdg-user-dirs-update\nXDG_DESKTOP_DIR=\"$HOME/Desktop\"\nXDG_DOCUMENTS_DIR=\"$HOME/Documents\"\nXDG_DOWNLOAD_DIR=\"$HOME/Downloads\"\nXDG_MUSIC_DIR=\"$HOME/Music\"\nXDG_PICTURES_DIR=\"$HOME/Pictures\"\nXDG_VIDEOS_DIR=\"$HOME/Videos\"\nXDG_PUBLICSHARE_DIR=\"$HOME/Public\"\nXDG_TEMPLATES_DIR=\"$HOME/Templates\"\n",
  "/home/user/.hidden": "Templates\n\n",
  "/home/user/.local/share/applications/piloti-appstore.desktop": "[Desktop Entry]\nType=Application\nName=App Store\nComment=Browse and install apps and web apps\nExec=piloti-appstore\nIcon=system-software-install\nCategories=System;PackageManager;\nMimeType=application/vnd.debian.binary-package;application/vnd.flatpak.ref;application/vnd.flatpak;\n",
  "/home/user/.local/share/applications/piloti-calculator.desktop": "[Desktop Entry]\nType=Application\nName=Calculator\nComment=Basic & Scientific Calculator\nExec=piloti-calculator\nIcon=accessories-calculator\nCategories=Utility;Calculator;\n",
  "/home/user/.local/share/applications/piloti-console.desktop": "[Desktop Entry]\nType=Application\nName=Desktop Console\nComment=Desktop Console, live logs, inspector, and JS REPL\nExec=piloti-console\nIcon=piloti-console\nCategories=Development;Debugger;\n",
  "/home/user/.local/share/applications/piloti-files.desktop": "[Desktop Entry]\nType=Application\nName=Folders\nComment=Browse local virtual files and folders\nExec=piloti-files %U\nIcon=system-file-manager\nCategories=System;FileManager;\nMimeType=inode/directory;\n",
  "/home/user/.local/share/applications/piloti-image-viewer.desktop": "[Desktop Entry]\nType=Application\nName=Image Viewer\nComment=Fast image viewer and crop/rotate editor\nExec=piloti-image-viewer %F\nIcon=org.gnome.Loupe\nCategories=Graphics;Viewer;\nMimeType=image/png;image/jpeg;image/webp;image/gif;image/svg+xml;image/bmp;image/avif;image/vnd.microsoft.icon;\n",
  "/home/user/.local/share/applications/piloti-login.desktop": "[Desktop Entry]\nType=Application\nName=Login Screen\nComment=Piloti Display Manager (GDM alternative preview)\nExec=piloti-login\nIcon=system-users\nCategories=System;Settings;\n\n",
  "/home/user/.local/share/applications/piloti-notepad.desktop": "[Desktop Entry]\nType=Application\nName=Notepad\nComment=Minimal plain-text notepad with instant VFS save\nExec=piloti-notepad %F\nIcon=accessories-text-editor\nCategories=Utility;TextEditor;\nMimeType=text/plain;text/markdown;text/css;text/csv;application/json;application/xml;application/x-shellscript;application/x-yaml;application/x-desktop;\n",
  "/home/user/.local/share/applications/piloti-settings.desktop": "[Desktop Entry]\nType=Application\nName=Desktop Settings\nComment=Configure appearance, fonts, dock, and wallpaper\nExec=piloti-settings\nIcon=preferences-desktop\nCategories=Settings;DesktopSettings;\n",
  "/home/user/.local/share/applications/piloti-shell.desktop": "[Desktop Entry]\nType=Application\nName=Desktop Shell\nComment=Desktop shell with VFS commands\nExec=piloti-shell\nIcon=utilities-terminal\nCategories=System;TerminalEmulator;Development;\n",
  "/home/user/Desktop/Welcome.html": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Welcome to Piloti Desktop</title>\n    <style>\n      :root {\n        color-scheme: light dark;\n        --bg: #fafafa;\n        --surface: #ffffff;\n        --surface-alt: #f1f1f4;\n        --border: rgba(0, 0, 0, 0.09);\n        --text: #1c1c1e;\n        --muted: #5e5e66;\n        --accent: #3584e4;\n        --accent-soft: rgba(53, 132, 228, 0.12);\n        --kbd-bg: #ececf0;\n        --kbd-border: rgba(0, 0, 0, 0.14);\n        --stage-sky: #e7eef8;\n        --stage-bar: #ffffff;\n        --stage-dock: #ffffff;\n        --stage-tile: #d4e3f7;\n      }\n\n      @media (prefers-color-scheme: dark) {\n        :root {\n          --bg: #202024;\n          --surface: #2c2c31;\n          --surface-alt: #35353b;\n          --border: rgba(255, 255, 255, 0.09);\n          --text: #f4f4f6;\n          --muted: #a8a8b2;\n          --accent: #5294e2;\n          --accent-soft: rgba(82, 148, 226, 0.18);\n          --kbd-bg: #3a3a41;\n          --kbd-border: rgba(255, 255, 255, 0.16);\n          --stage-sky: #252b38;\n          --stage-bar: #1a1a1f;\n          --stage-dock: #1a1a1f;\n          --stage-tile: #33435c;\n        }\n      }\n\n      * {\n        box-sizing: border-box;\n      }\n\n      body {\n        margin: 0;\n        padding: 36px 20px 56px;\n        font-family: \"Cantarell\", \"Inter\", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;\n        background: var(--bg);\n        color: var(--text);\n        line-height: 1.5;\n        -webkit-font-smoothing: antialiased;\n      }\n\n      main {\n        max-width: 820px;\n        margin: 0 auto;\n        display: flex;\n        flex-direction: column;\n        gap: 28px;\n      }\n\n      header {\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        gap: 24px;\n        flex-wrap: wrap;\n        background: var(--surface);\n        border: 1px solid var(--border);\n        border-radius: 16px;\n        padding: 24px 28px;\n      }\n\n      .hero-copy {\n        flex: 1;\n        min-width: 240px;\n      }\n\n      .badge {\n        display: inline-block;\n        padding: 3px 10px;\n        border-radius: 9999px;\n        background: var(--accent-soft);\n        color: var(--accent);\n        font-size: 12px;\n        font-weight: 700;\n        margin-bottom: 10px;\n      }\n\n      h1 {\n        margin: 0 0 6px;\n        font-size: 28px;\n        font-weight: 800;\n        letter-spacing: -0.02em;\n      }\n\n      .subtitle {\n        margin: 0;\n        color: var(--muted);\n        font-size: 14.5px;\n      }\n\n      .hero-diagram {\n        width: 220px;\n        max-width: 100%;\n        height: auto;\n        flex-shrink: 0;\n      }\n\n      section h2 {\n        margin: 0 0 12px;\n        font-size: 15px;\n        font-weight: 700;\n        color: var(--muted);\n        text-transform: uppercase;\n        letter-spacing: 0.04em;\n      }\n\n      .grid {\n        display: grid;\n        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));\n        gap: 12px;\n      }\n\n      .card {\n        background: var(--surface);\n        border: 1px solid var(--border);\n        border-radius: 14px;\n        padding: 16px 18px;\n        display: flex;\n        flex-direction: column;\n        gap: 8px;\n      }\n\n      .card-head {\n        display: flex;\n        align-items: center;\n        gap: 10px;\n      }\n\n      .icon-box {\n        width: 32px;\n        height: 32px;\n        border-radius: 9px;\n        background: var(--accent-soft);\n        color: var(--accent);\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        flex-shrink: 0;\n      }\n\n      .card h3 {\n        margin: 0;\n        font-size: 15px;\n        font-weight: 700;\n      }\n\n      .card p {\n        margin: 0;\n        font-size: 13.5px;\n        color: var(--muted);\n      }\n\n      .shortcuts {\n        background: var(--surface);\n        border: 1px solid var(--border);\n        border-radius: 14px;\n        overflow: hidden;\n      }\n\n      .shortcut-row {\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        gap: 16px;\n        padding: 11px 18px;\n        border-bottom: 1px solid var(--border);\n        font-size: 13.5px;\n      }\n\n      .shortcut-row:last-child {\n        border-bottom: none;\n      }\n\n      .shortcut-keys {\n        display: inline-flex;\n        align-items: center;\n        gap: 4px;\n        flex-shrink: 0;\n      }\n\n      kbd {\n        display: inline-block;\n        padding: 2px 7px;\n        border-radius: 6px;\n        background: var(--kbd-bg);\n        border: 1px solid var(--kbd-border);\n        font-family: \"Adwaita Mono\", ui-monospace, SFMono-Regular, monospace;\n        font-size: 11.5px;\n        font-weight: 600;\n        color: var(--text);\n      }\n\n      @media (max-width: 560px) {\n        header {\n          padding: 20px;\n        }\n        .shortcut-row {\n          flex-direction: column;\n          align-items: flex-start;\n          gap: 6px;\n        }\n      }\n    </style>\n  </head>\n  <body>\n    <main>\n      <header>\n        <div class=\"hero-copy\">\n          <div class=\"badge\">Getting Started</div>\n          <h1>Welcome to Piloti Desktop</h1>\n          <p class=\"subtitle\">\n            A quick guide to the Menu bar, Dock, Desktop icons, and essential shortcuts.\n          </p>\n        </div>\n\n        <!-- Flat vector desktop diagram -->\n        <svg\n          class=\"hero-diagram\"\n          viewBox=\"0 0 240 150\"\n          fill=\"none\"\n          xmlns=\"http://www.w3.org/2000/svg\"\n          aria-hidden=\"true\"\n        >\n          <rect x=\"2\" y=\"2\" width=\"236\" height=\"146\" rx=\"14\" fill=\"var(--stage-sky)\" stroke=\"var(--border)\" stroke-width=\"2\" />\n          <!-- Menu bar -->\n          <rect x=\"8\" y=\"8\" width=\"224\" height=\"16\" rx=\"6\" fill=\"var(--stage-bar)\" stroke=\"var(--border)\" />\n          <circle cx=\"19\" cy=\"16\" r=\"3\" fill=\"var(--accent)\" />\n          <rect x=\"27\" y=\"14\" width=\"26\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n          <rect x=\"108\" y=\"13\" width=\"24\" height=\"6\" rx=\"3\" fill=\"var(--accent)\" opacity=\"0.85\" />\n          <rect x=\"190\" y=\"14\" width=\"32\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n\n          <!-- Desktop icons -->\n          <rect x=\"16\" y=\"34\" width=\"22\" height=\"22\" rx=\"6\" fill=\"var(--accent)\" opacity=\"0.9\" />\n          <rect x=\"14\" y=\"60\" width=\"26\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n          <rect x=\"16\" y=\"74\" width=\"22\" height=\"22\" rx=\"6\" fill=\"var(--stage-tile)\" />\n          <rect x=\"14\" y=\"100\" width=\"26\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n\n          <!-- Window -->\n          <rect x=\"64\" y=\"34\" width=\"154\" height=\"82\" rx=\"10\" fill=\"var(--surface)\" stroke=\"var(--border)\" />\n          <rect x=\"64\" y=\"34\" width=\"154\" height=\"20\" rx=\"10\" fill=\"var(--surface-alt)\" />\n          <circle cx=\"77\" cy=\"44\" r=\"3\" fill=\"#e62d42\" opacity=\"0.85\" />\n          <circle cx=\"87\" cy=\"44\" r=\"3\" fill=\"#f5c211\" opacity=\"0.85\" />\n          <circle cx=\"97\" cy=\"44\" r=\"3\" fill=\"#3a944a\" opacity=\"0.85\" />\n          <rect x=\"78\" y=\"66\" width=\"84\" height=\"7\" rx=\"3.5\" fill=\"var(--accent)\" opacity=\"0.28\" />\n          <rect x=\"78\" y=\"80\" width=\"124\" height=\"6\" rx=\"3\" fill=\"var(--muted)\" opacity=\"0.28\" />\n          <rect x=\"78\" y=\"92\" width=\"102\" height=\"6\" rx=\"3\" fill=\"var(--muted)\" opacity=\"0.22\" />\n\n          <!-- Dock -->\n          <rect x=\"64\" y=\"123\" width=\"112\" height=\"19\" rx=\"8\" fill=\"var(--stage-dock)\" stroke=\"var(--border)\" />\n          <rect x=\"73\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--accent)\" />\n          <rect x=\"90\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--stage-tile)\" />\n          <rect x=\"107\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--accent)\" opacity=\"0.65\" />\n          <rect x=\"124\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--stage-tile)\" />\n          <rect x=\"141\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--accent)\" opacity=\"0.45\" />\n          <rect x=\"158\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--stage-tile)\" />\n        </svg>\n      </header>\n\n      <div id=\"shortcuts\"></div>\n\n      <section>\n        <h2>Shell &amp; Navigation</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Open Launcher (search apps, folders, actions, URLs)</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>Space</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Open Piloti system menu</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Ctrl</kbd> + <kbd>Esc</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Navigate open menus &amp; panels</span>\n            <span class=\"shortcut-keys\">\n              <kbd>←</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Toggle Overview (workspaces &amp; window spread)</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Meta</kbd> + <kbd>↑</kbd> / <kbd>F3</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Switch workspace</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Meta</kbd> + <kbd>←</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Toggle Control Panel &amp; Notifications</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>N</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Open Desktop Settings</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>,</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Switch open windows with live previews</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>Tab</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n\n      <section>\n        <h2>Windows</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Tile focused window left / right half</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>[</kbd> / <kbd>Alt</kbd> + <kbd>]</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Maximize / restore focused window</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>F</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Minimize focused window</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>M</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Close focused window</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>W</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n\n      <section>\n        <h2>Capture &amp; System</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Take screenshot</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Print</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Launch Terminal</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Meta</kbd> + <kbd>Return</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Lock Screen</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Ctrl</kbd> + <kbd>Cmd</kbd> + <kbd>Q</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n\n      <section>\n        <h2>Launcher &amp; App Sidebars</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Accept inline autocomplete in Launcher</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Tab</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Browse Launcher search history</span>\n            <span class=\"shortcut-keys\">\n              <kbd>↑</kbd> / <kbd>↓</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Navigate sidebar items &amp; move focus to content</span>\n            <span class=\"shortcut-keys\">\n              <kbd>↑</kbd> / <kbd>↓</kbd>, <kbd>Tab</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n    </main>\n  </body>\n</html>\n",
  "/home/user/Documents/Notes.txt": "Notes\n-----\n- Test Piloti Folders & Desktop VFS\n",
  "/home/user/Downloads/readme.md": "# Downloads\n\nLocal browser VFS folder stored in localStorage.\n",
  "/home/user/Templates/HTML Page.html": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>Untitled</title>\n  </head>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>\n\n",
  "/home/user/Templates/Markdown Document.md": "# Untitled\n\n\n",
  "/home/user/Templates/Shell Script.sh": "#!/usr/bin/env sh\nset -eu\n\n\n"
};

export const DEFAULT_STATIC_DIR_INDEX: Record<string, readonly { name: string; fileType: 0 | 1 }[]> = {
  "/etc": [
    {
      "name": "issue",
      "fileType": 0
    }
  ],
  "/usr/bin": [
    {
      "name": "piloti",
      "fileType": 0
    },
    {
      "name": "piloti-appstore",
      "fileType": 0
    },
    {
      "name": "piloti-calculator",
      "fileType": 0
    },
    {
      "name": "piloti-camera",
      "fileType": 0
    },
    {
      "name": "piloti-console",
      "fileType": 0
    },
    {
      "name": "piloti-files",
      "fileType": 0
    },
    {
      "name": "piloti-greeter",
      "fileType": 0
    },
    {
      "name": "piloti-image-viewer",
      "fileType": 0
    },
    {
      "name": "piloti-login",
      "fileType": 0
    },
    {
      "name": "piloti-notepad",
      "fileType": 0
    },
    {
      "name": "piloti-session",
      "fileType": 0
    },
    {
      "name": "piloti-settings",
      "fileType": 0
    },
    {
      "name": "piloti-shell",
      "fileType": 0
    },
    {
      "name": "piloti-webapp",
      "fileType": 0
    }
  ],
  "/usr/libexec/piloti-desktop": [
    {
      "name": "piloti-greetd-client",
      "fileType": 0
    }
  ],
  "/usr/libexec": [
    {
      "name": "piloti-desktop",
      "fileType": 1
    }
  ],
  "/usr/share/applications": [
    {
      "name": "piloti-appmodule-test.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-appstore.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-calculator.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-camera.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-console.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-files.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-image-viewer.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-login.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-notepad.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-settings.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-shell.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-text-editor-module.desktop",
      "fileType": 0
    }
  ],
  "/usr/share/backgrounds/piloti": [
    {
      "name": "piloti-waves-d.svg",
      "fileType": 0
    },
    {
      "name": "piloti-waves-l.svg",
      "fileType": 0
    }
  ],
  "/usr/share/backgrounds": [
    {
      "name": "piloti",
      "fileType": 1
    }
  ],
  "/usr/share/gnome-background-properties": [
    {
      "name": "piloti-wallpapers.xml",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Adwaita/scalable/mimetypes": [
    {
      "name": "application-pdf.svg",
      "fileType": 0
    },
    {
      "name": "application-x-executable.svg",
      "fileType": 0
    },
    {
      "name": "audio-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "image-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "package-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "text-html.svg",
      "fileType": 0
    },
    {
      "name": "text-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "text-x-script.svg",
      "fileType": 0
    },
    {
      "name": "video-x-generic.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Adwaita/scalable/places": [
    {
      "name": "folder-documents.svg",
      "fileType": 0
    },
    {
      "name": "folder-download.svg",
      "fileType": 0
    },
    {
      "name": "folder-music.svg",
      "fileType": 0
    },
    {
      "name": "folder-pictures.svg",
      "fileType": 0
    },
    {
      "name": "folder-publicshare.svg",
      "fileType": 0
    },
    {
      "name": "folder-templates.svg",
      "fileType": 0
    },
    {
      "name": "folder-videos.svg",
      "fileType": 0
    },
    {
      "name": "folder.svg",
      "fileType": 0
    },
    {
      "name": "user-desktop.svg",
      "fileType": 0
    },
    {
      "name": "user-home.svg",
      "fileType": 0
    },
    {
      "name": "user-trash.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Adwaita/scalable/status": [
    {
      "name": "user-trash-full.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Adwaita/scalable": [
    {
      "name": "mimetypes",
      "fileType": 1
    },
    {
      "name": "places",
      "fileType": 1
    },
    {
      "name": "status",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Adwaita/symbolic/actions": [
    {
      "name": "view-app-grid-symbolic.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Adwaita/symbolic": [
    {
      "name": "actions",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Adwaita": [
    {
      "name": "index.theme",
      "fileType": 0
    },
    {
      "name": "scalable",
      "fileType": 1
    },
    {
      "name": "symbolic",
      "fileType": 1
    }
  ],
  "/usr/share/icons/hicolor/scalable/apps": [
    {
      "name": "org.gnome.Calculator.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Console.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.DevTools.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Epiphany.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Loupe.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Nautilus.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Settings.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Snapshot.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Software.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.TextEditor.svg",
      "fileType": 0
    },
    {
      "name": "piloti-console.svg",
      "fileType": 0
    },
    {
      "name": "piloti-demo.svg",
      "fileType": 0
    },
    {
      "name": "piloti-desktop.svg",
      "fileType": 0
    },
    {
      "name": "piloti-settings.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/hicolor/scalable": [
    {
      "name": "apps",
      "fileType": 1
    }
  ],
  "/usr/share/icons/hicolor": [
    {
      "name": "index.theme",
      "fileType": 0
    },
    {
      "name": "scalable",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Papirus/24x24/actions": [
    {
      "name": "view-grid.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/24x24": [
    {
      "name": "actions",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Papirus/64x64/apps": [
    {
      "name": "accessories-calculator.svg",
      "fileType": 0
    },
    {
      "name": "accessories-text-editor.svg",
      "fileType": 0
    },
    {
      "name": "applications-development.svg",
      "fileType": 0
    },
    {
      "name": "internet-web-browser.svg",
      "fileType": 0
    },
    {
      "name": "multimedia-photo-viewer.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Loupe.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.Snapshot.svg",
      "fileType": 0
    },
    {
      "name": "preferences-desktop.svg",
      "fileType": 0
    },
    {
      "name": "preferences-system.svg",
      "fileType": 0
    },
    {
      "name": "system-file-manager.svg",
      "fileType": 0
    },
    {
      "name": "system-software-install.svg",
      "fileType": 0
    },
    {
      "name": "system-users.svg",
      "fileType": 0
    },
    {
      "name": "utilities-terminal.svg",
      "fileType": 0
    },
    {
      "name": "view-app-grid.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/64x64/devices": [
    {
      "name": "drive-harddisk-solidstate.svg",
      "fileType": 0
    },
    {
      "name": "drive-harddisk.svg",
      "fileType": 0
    },
    {
      "name": "drive-optical.svg",
      "fileType": 0
    },
    {
      "name": "drive-removable-media-usb.svg",
      "fileType": 0
    },
    {
      "name": "drive-removable-media.svg",
      "fileType": 0
    },
    {
      "name": "media-flash-sd-mmc.svg",
      "fileType": 0
    },
    {
      "name": "media-flash.svg",
      "fileType": 0
    },
    {
      "name": "media-optical.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/64x64/mimetypes": [
    {
      "name": "application-pdf.svg",
      "fileType": 0
    },
    {
      "name": "application-x-executable.svg",
      "fileType": 0
    },
    {
      "name": "application-x-zerosize.svg",
      "fileType": 0
    },
    {
      "name": "audio-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "image-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "package-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "text-html.svg",
      "fileType": 0
    },
    {
      "name": "text-x-generic.svg",
      "fileType": 0
    },
    {
      "name": "text-x-markdown.svg",
      "fileType": 0
    },
    {
      "name": "text-x-script.svg",
      "fileType": 0
    },
    {
      "name": "video-x-generic.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/64x64/places": [
    {
      "name": "folder-code.svg",
      "fileType": 0
    },
    {
      "name": "folder-documents.svg",
      "fileType": 0
    },
    {
      "name": "folder-download.svg",
      "fileType": 0
    },
    {
      "name": "folder-music.svg",
      "fileType": 0
    },
    {
      "name": "folder-open.svg",
      "fileType": 0
    },
    {
      "name": "folder-pictures.svg",
      "fileType": 0
    },
    {
      "name": "folder-publicshare.svg",
      "fileType": 0
    },
    {
      "name": "folder-templates.svg",
      "fileType": 0
    },
    {
      "name": "folder-videos.svg",
      "fileType": 0
    },
    {
      "name": "folder.svg",
      "fileType": 0
    },
    {
      "name": "user-desktop.svg",
      "fileType": 0
    },
    {
      "name": "user-home.svg",
      "fileType": 0
    },
    {
      "name": "user-trash-full.svg",
      "fileType": 0
    },
    {
      "name": "user-trash.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/64x64/status": [
    {
      "name": "user-trash-full.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/64x64": [
    {
      "name": "apps",
      "fileType": 1
    },
    {
      "name": "devices",
      "fileType": 1
    },
    {
      "name": "mimetypes",
      "fileType": 1
    },
    {
      "name": "places",
      "fileType": 1
    },
    {
      "name": "status",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Papirus/symbolic/actions": [
    {
      "name": "view-app-grid-symbolic.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/symbolic": [
    {
      "name": "actions",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Papirus": [
    {
      "name": "24x24",
      "fileType": 1
    },
    {
      "name": "64x64",
      "fileType": 1
    },
    {
      "name": "index.theme",
      "fileType": 0
    },
    {
      "name": "symbolic",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Piloti/animated/apps": [
    {
      "name": "accessories-text-editor.json",
      "fileType": 0
    },
    {
      "name": "system-file-manager.json",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/animated/devices": [
    {
      "name": "drive-removable-media-usb.json",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/animated/mimetypes": [
    {
      "name": "application-x-zerosize.json",
      "fileType": 0
    },
    {
      "name": "text-x-generic.json",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/animated/places": [
    {
      "name": "folder-open.json",
      "fileType": 0
    },
    {
      "name": "folder.json",
      "fileType": 0
    },
    {
      "name": "user-trash-full.json",
      "fileType": 0
    },
    {
      "name": "user-trash.json",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/animated": [
    {
      "name": "apps",
      "fileType": 1
    },
    {
      "name": "devices",
      "fileType": 1
    },
    {
      "name": "mimetypes",
      "fileType": 1
    },
    {
      "name": "places",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Piloti/scalable/apps": [
    {
      "name": "accessories-calculator.svg",
      "fileType": 0
    },
    {
      "name": "system-software-install.svg",
      "fileType": 0
    },
    {
      "name": "utilities-terminal.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/scalable/mimetypes": [
    {
      "name": "application-x-zerosize.svg",
      "fileType": 0
    },
    {
      "name": "text-html.svg",
      "fileType": 0
    },
    {
      "name": "text-x-generic.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/scalable": [
    {
      "name": "apps",
      "fileType": 1
    },
    {
      "name": "mimetypes",
      "fileType": 1
    }
  ],
  "/usr/share/icons/Piloti": [
    {
      "name": "animated",
      "fileType": 1
    },
    {
      "name": "index.theme",
      "fileType": 0
    },
    {
      "name": "scalable",
      "fileType": 1
    }
  ],
  "/usr/share/icons": [
    {
      "name": "Adwaita",
      "fileType": 1
    },
    {
      "name": "hicolor",
      "fileType": 1
    },
    {
      "name": "Papirus",
      "fileType": 1
    },
    {
      "name": "Piloti",
      "fileType": 1
    }
  ],
  "/usr/share/piloti/extensions/piloti-demo": [
    {
      "name": "background.js",
      "fileType": 0
    },
    {
      "name": "manifest.json",
      "fileType": 0
    },
    {
      "name": "popup.html",
      "fileType": 0
    },
    {
      "name": "popup.js",
      "fileType": 0
    }
  ],
  "/usr/share/piloti/extensions": [
    {
      "name": "piloti-demo",
      "fileType": 1
    }
  ],
  "/usr/share/piloti/plugins/app-indicator": [
    {
      "name": "manifest.json",
      "fileType": 0
    }
  ],
  "/usr/share/piloti/plugins": [
    {
      "name": "app-indicator",
      "fileType": 1
    }
  ],
  "/usr/share/piloti": [
    {
      "name": "extensions",
      "fileType": 1
    },
    {
      "name": "plugins",
      "fileType": 1
    }
  ],
  "/usr/share/piloti-desktop": [
    {
      "name": "domicile.json",
      "fileType": 0
    },
    {
      "name": "greetd.toml",
      "fileType": 0
    },
    {
      "name": "greeter-domicile.json",
      "fileType": 0
    }
  ],
  "/usr/share/wayland-sessions": [
    {
      "name": "piloti.desktop",
      "fileType": 0
    }
  ],
  "/usr/share": [
    {
      "name": "applications",
      "fileType": 1
    },
    {
      "name": "backgrounds",
      "fileType": 1
    },
    {
      "name": "gnome-background-properties",
      "fileType": 1
    },
    {
      "name": "icons",
      "fileType": 1
    },
    {
      "name": "piloti",
      "fileType": 1
    },
    {
      "name": "piloti-desktop",
      "fileType": 1
    },
    {
      "name": "wayland-sessions",
      "fileType": 1
    }
  ],
  "/usr": [
    {
      "name": "bin",
      "fileType": 1
    },
    {
      "name": "libexec",
      "fileType": 1
    },
    {
      "name": "share",
      "fileType": 1
    }
  ],
  "/": [
    {
      "name": "etc",
      "fileType": 1
    },
    {
      "name": "usr",
      "fileType": 1
    }
  ]
};
