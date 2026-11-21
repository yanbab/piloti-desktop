// Auto-generated from data/files/.
export const DEFAULT_HOME_DIRS: readonly string[] = [
  "/home/user",
  "/home/user/.cache",
  "/home/user/.cache/piloti",
  "/home/user/.config",
  "/home/user/.config/domicile",
  "/home/user/.config/piloti",
  "/home/user/.config/piloti/plugins",
  "/home/user/.local",
  "/home/user/.local/share",
  "/home/user/.local/share/applications",
  "/home/user/.local/share/Trash",
  "/home/user/.local/share/Trash/files",
  "/home/user/.local/state",
  "/home/user/.local/state/piloti",
  "/home/user/Desktop",
  "/home/user/Desktop/Projects",
  "/home/user/Documents",
  "/home/user/Downloads",
  "/home/user/Music",
  "/home/user/Pictures",
  "/home/user/Videos"
];

export const DEFAULT_HOME_FILES: Record<string, string> = {
  "/home/user/.config/mimeapps.list": "[Default Applications]\ninode/directory=nautilus.desktop\ntext/plain=text-editor.desktop\ntext/markdown=text-editor.desktop\ntext/html=browser.desktop\napplication/json=text-editor.desktop\nimage/png=image-viewer.desktop\nimage/jpeg=image-viewer.desktop\nimage/webp=image-viewer.desktop\nimage/gif=image-viewer.desktop\nimage/svg+xml=image-viewer.desktop\n\n[Added Associations]\ninode/directory=nautilus.desktop;terminal.desktop;\ntext/plain=text-editor.desktop;terminal.desktop;\ntext/markdown=text-editor.desktop;browser.desktop;\ntext/html=browser.desktop;text-editor.desktop;\ntext/*=text-editor.desktop;terminal.desktop;\napplication/json=text-editor.desktop;console.desktop;\nimage/*=image-viewer.desktop;browser.desktop;\n",
  "/home/user/.config/user-dirs.dirs": "# Written by xdg-user-dirs-update\nXDG_DESKTOP_DIR=\"$HOME/Desktop\"\nXDG_DOCUMENTS_DIR=\"$HOME/Documents\"\nXDG_DOWNLOAD_DIR=\"$HOME/Downloads\"\nXDG_MUSIC_DIR=\"$HOME/Music\"\nXDG_PICTURES_DIR=\"$HOME/Pictures\"\nXDG_VIDEOS_DIR=\"$HOME/Videos\"\nXDG_PUBLICSHARE_DIR=\"$HOME/Public\"\nXDG_TEMPLATES_DIR=\"$HOME/Templates\"\n",
  "/home/user/.local/share/applications/piloti-applications.desktop": "[Desktop Entry]\nType=Application\nName=Applications\nComment=Browse and install apps and web apps\nExec=piloti-applications\nIcon=system-software-install\nCategories=System;PackageManager;\n",
  "/home/user/.local/share/applications/piloti-calculator.desktop": "[Desktop Entry]\nType=Application\nName=Calculator\nComment=Basic & Scientific Calculator\nExec=piloti-calculator\nIcon=piloti-calculator\nCategories=Utility;Calculator;\n",
  "/home/user/.local/share/applications/piloti-console.desktop": "[Desktop Entry]\nType=Application\nName=Desktop Console\nComment=Desktop Console, live logs, inspector, and JS REPL\nExec=piloti-console\nIcon=piloti-console\nCategories=Development;Debugger;\n",
  "/home/user/.local/share/applications/piloti-files.desktop": "[Desktop Entry]\nType=Application\nName=Folders\nComment=Browse local virtual files and folders\nExec=piloti-files %U\nIcon=system-file-manager\nCategories=System;FileManager;\nMimeType=inode/directory;\n",
  "/home/user/.local/share/applications/piloti-image-viewer.desktop": "[Desktop Entry]\nType=Application\nName=Image Viewer\nComment=Fast image viewer and crop/rotate editor\nExec=piloti-image-viewer %F\nIcon=org.gnome.Loupe\nCategories=Graphics;Viewer;\nMimeType=image/png;image/jpeg;image/webp;image/gif;image/svg+xml;\n",
  "/home/user/.local/share/applications/piloti-notepad.desktop": "[Desktop Entry]\nType=Application\nName=Notepad\nComment=Minimal plain-text notepad with instant VFS save\nExec=piloti-notepad %F\nIcon=piloti-text-editor\nCategories=Utility;TextEditor;\nMimeType=text/plain;text/markdown;application/json;\n",
  "/home/user/.local/share/applications/piloti-settings.desktop": "[Desktop Entry]\nType=Application\nName=Desktop Settings\nComment=Configure appearance, fonts, dock, and wallpaper\nExec=piloti-settings\nIcon=preferences-desktop\nCategories=Settings;DesktopSettings;\n",
  "/home/user/.local/share/applications/piloti-shell.desktop": "[Desktop Entry]\nType=Application\nName=Desktop Shell\nComment=Desktop shell with VFS commands\nExec=piloti-shell\nIcon=utilities-terminal\nCategories=System;TerminalEmulator;Development;\n",
  "/home/user/Desktop/Welcome.html": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Welcome to Piloti Desktop</title>\n    <style>\n      :root {\n        color-scheme: light dark;\n        --bg: #fafafa;\n        --surface: #ffffff;\n        --surface-alt: #f1f1f4;\n        --border: rgba(0, 0, 0, 0.09);\n        --text: #1c1c1e;\n        --muted: #5e5e66;\n        --accent: #3584e4;\n        --accent-soft: rgba(53, 132, 228, 0.12);\n        --kbd-bg: #ececf0;\n        --kbd-border: rgba(0, 0, 0, 0.14);\n        --stage-sky: #e7eef8;\n        --stage-bar: #ffffff;\n        --stage-dock: #ffffff;\n        --stage-tile: #d4e3f7;\n      }\n\n      @media (prefers-color-scheme: dark) {\n        :root {\n          --bg: #202024;\n          --surface: #2c2c31;\n          --surface-alt: #35353b;\n          --border: rgba(255, 255, 255, 0.09);\n          --text: #f4f4f6;\n          --muted: #a8a8b2;\n          --accent: #5294e2;\n          --accent-soft: rgba(82, 148, 226, 0.18);\n          --kbd-bg: #3a3a41;\n          --kbd-border: rgba(255, 255, 255, 0.16);\n          --stage-sky: #252b38;\n          --stage-bar: #1a1a1f;\n          --stage-dock: #1a1a1f;\n          --stage-tile: #33435c;\n        }\n      }\n\n      * {\n        box-sizing: border-box;\n      }\n\n      body {\n        margin: 0;\n        padding: 36px 20px 56px;\n        font-family: \"Cantarell\", \"Inter\", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;\n        background: var(--bg);\n        color: var(--text);\n        line-height: 1.5;\n        -webkit-font-smoothing: antialiased;\n      }\n\n      main {\n        max-width: 820px;\n        margin: 0 auto;\n        display: flex;\n        flex-direction: column;\n        gap: 28px;\n      }\n\n      header {\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        gap: 24px;\n        flex-wrap: wrap;\n        background: var(--surface);\n        border: 1px solid var(--border);\n        border-radius: 16px;\n        padding: 24px 28px;\n      }\n\n      .hero-copy {\n        flex: 1;\n        min-width: 240px;\n      }\n\n      .badge {\n        display: inline-block;\n        padding: 3px 10px;\n        border-radius: 9999px;\n        background: var(--accent-soft);\n        color: var(--accent);\n        font-size: 12px;\n        font-weight: 700;\n        margin-bottom: 10px;\n      }\n\n      h1 {\n        margin: 0 0 6px;\n        font-size: 28px;\n        font-weight: 800;\n        letter-spacing: -0.02em;\n      }\n\n      .subtitle {\n        margin: 0;\n        color: var(--muted);\n        font-size: 14.5px;\n      }\n\n      .hero-diagram {\n        width: 220px;\n        max-width: 100%;\n        height: auto;\n        flex-shrink: 0;\n      }\n\n      section h2 {\n        margin: 0 0 12px;\n        font-size: 15px;\n        font-weight: 700;\n        color: var(--muted);\n        text-transform: uppercase;\n        letter-spacing: 0.04em;\n      }\n\n      .grid {\n        display: grid;\n        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));\n        gap: 12px;\n      }\n\n      .card {\n        background: var(--surface);\n        border: 1px solid var(--border);\n        border-radius: 14px;\n        padding: 16px 18px;\n        display: flex;\n        flex-direction: column;\n        gap: 8px;\n      }\n\n      .card-head {\n        display: flex;\n        align-items: center;\n        gap: 10px;\n      }\n\n      .icon-box {\n        width: 32px;\n        height: 32px;\n        border-radius: 9px;\n        background: var(--accent-soft);\n        color: var(--accent);\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        flex-shrink: 0;\n      }\n\n      .card h3 {\n        margin: 0;\n        font-size: 15px;\n        font-weight: 700;\n      }\n\n      .card p {\n        margin: 0;\n        font-size: 13.5px;\n        color: var(--muted);\n      }\n\n      .shortcuts {\n        background: var(--surface);\n        border: 1px solid var(--border);\n        border-radius: 14px;\n        overflow: hidden;\n      }\n\n      .shortcut-row {\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        gap: 16px;\n        padding: 11px 18px;\n        border-bottom: 1px solid var(--border);\n        font-size: 13.5px;\n      }\n\n      .shortcut-row:last-child {\n        border-bottom: none;\n      }\n\n      .shortcut-keys {\n        display: inline-flex;\n        align-items: center;\n        gap: 4px;\n        flex-shrink: 0;\n      }\n\n      kbd {\n        display: inline-block;\n        padding: 2px 7px;\n        border-radius: 6px;\n        background: var(--kbd-bg);\n        border: 1px solid var(--kbd-border);\n        font-family: \"Adwaita Mono\", ui-monospace, SFMono-Regular, monospace;\n        font-size: 11.5px;\n        font-weight: 600;\n        color: var(--text);\n      }\n\n      @media (max-width: 560px) {\n        header {\n          padding: 20px;\n        }\n        .shortcut-row {\n          flex-direction: column;\n          align-items: flex-start;\n          gap: 6px;\n        }\n      }\n    </style>\n  </head>\n  <body>\n    <main>\n      <header>\n        <div class=\"hero-copy\">\n          <div class=\"badge\">Getting Started</div>\n          <h1>Welcome to Piloti Desktop</h1>\n          <p class=\"subtitle\">\n            A quick guide to the Menu bar, Dock, Desktop icons, and essential shortcuts.\n          </p>\n        </div>\n\n        <!-- Flat vector desktop diagram -->\n        <svg\n          class=\"hero-diagram\"\n          viewBox=\"0 0 240 150\"\n          fill=\"none\"\n          xmlns=\"http://www.w3.org/2000/svg\"\n          aria-hidden=\"true\"\n        >\n          <rect x=\"2\" y=\"2\" width=\"236\" height=\"146\" rx=\"14\" fill=\"var(--stage-sky)\" stroke=\"var(--border)\" stroke-width=\"2\" />\n          <!-- Menu bar -->\n          <rect x=\"8\" y=\"8\" width=\"224\" height=\"16\" rx=\"6\" fill=\"var(--stage-bar)\" stroke=\"var(--border)\" />\n          <circle cx=\"19\" cy=\"16\" r=\"3\" fill=\"var(--accent)\" />\n          <rect x=\"27\" y=\"14\" width=\"26\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n          <rect x=\"108\" y=\"13\" width=\"24\" height=\"6\" rx=\"3\" fill=\"var(--accent)\" opacity=\"0.85\" />\n          <rect x=\"190\" y=\"14\" width=\"32\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n\n          <!-- Desktop icons -->\n          <rect x=\"16\" y=\"34\" width=\"22\" height=\"22\" rx=\"6\" fill=\"var(--accent)\" opacity=\"0.9\" />\n          <rect x=\"14\" y=\"60\" width=\"26\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n          <rect x=\"16\" y=\"74\" width=\"22\" height=\"22\" rx=\"6\" fill=\"var(--stage-tile)\" />\n          <rect x=\"14\" y=\"100\" width=\"26\" height=\"4\" rx=\"2\" fill=\"var(--muted)\" opacity=\"0.55\" />\n\n          <!-- Window -->\n          <rect x=\"64\" y=\"34\" width=\"154\" height=\"82\" rx=\"10\" fill=\"var(--surface)\" stroke=\"var(--border)\" />\n          <rect x=\"64\" y=\"34\" width=\"154\" height=\"20\" rx=\"10\" fill=\"var(--surface-alt)\" />\n          <circle cx=\"77\" cy=\"44\" r=\"3\" fill=\"#e62d42\" opacity=\"0.85\" />\n          <circle cx=\"87\" cy=\"44\" r=\"3\" fill=\"#f5c211\" opacity=\"0.85\" />\n          <circle cx=\"97\" cy=\"44\" r=\"3\" fill=\"#3a944a\" opacity=\"0.85\" />\n          <rect x=\"78\" y=\"66\" width=\"84\" height=\"7\" rx=\"3.5\" fill=\"var(--accent)\" opacity=\"0.28\" />\n          <rect x=\"78\" y=\"80\" width=\"124\" height=\"6\" rx=\"3\" fill=\"var(--muted)\" opacity=\"0.28\" />\n          <rect x=\"78\" y=\"92\" width=\"102\" height=\"6\" rx=\"3\" fill=\"var(--muted)\" opacity=\"0.22\" />\n\n          <!-- Dock -->\n          <rect x=\"64\" y=\"123\" width=\"112\" height=\"19\" rx=\"8\" fill=\"var(--stage-dock)\" stroke=\"var(--border)\" />\n          <rect x=\"73\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--accent)\" />\n          <rect x=\"90\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--stage-tile)\" />\n          <rect x=\"107\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--accent)\" opacity=\"0.65\" />\n          <rect x=\"124\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--stage-tile)\" />\n          <rect x=\"141\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--accent)\" opacity=\"0.45\" />\n          <rect x=\"158\" y=\"127\" width=\"11\" height=\"11\" rx=\"3\" fill=\"var(--stage-tile)\" />\n        </svg>\n      </header>\n\n      <div id=\"shortcuts\"></div>\n\n      <section>\n        <h2>Shell &amp; Navigation</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Open Launcher (search apps, folders, actions, URLs)</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>Space</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Open Piloti system menu</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Ctrl</kbd> + <kbd>Esc</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Navigate open menus &amp; panels</span>\n            <span class=\"shortcut-keys\">\n              <kbd>←</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Toggle Overview (workspaces &amp; window spread)</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Meta</kbd> + <kbd>↑</kbd> / <kbd>F3</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Switch workspace</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Meta</kbd> + <kbd>←</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Toggle Control Panel &amp; Notifications</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>N</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Open Desktop Settings</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>,</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Switch open windows with live previews</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>Tab</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n\n      <section>\n        <h2>Windows</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Tile focused window left / right half</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>[</kbd> / <kbd>Alt</kbd> + <kbd>]</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Maximize / restore focused window</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>F</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Minimize focused window</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>M</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Close focused window</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Alt</kbd> + <kbd>W</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n\n      <section>\n        <h2>Capture &amp; System</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Take screenshot</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Print</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Launch Terminal</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Meta</kbd> + <kbd>Return</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Lock Screen</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Ctrl</kbd> + <kbd>Cmd</kbd> + <kbd>Q</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n\n      <section>\n        <h2>Launcher &amp; App Sidebars</h2>\n        <div class=\"shortcuts\">\n          <div class=\"shortcut-row\">\n            <span>Accept inline autocomplete in Launcher</span>\n            <span class=\"shortcut-keys\">\n              <kbd>Tab</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Browse Launcher search history</span>\n            <span class=\"shortcut-keys\">\n              <kbd>↑</kbd> / <kbd>↓</kbd>\n            </span>\n          </div>\n          <div class=\"shortcut-row\">\n            <span>Navigate sidebar items &amp; move focus to content</span>\n            <span class=\"shortcut-keys\">\n              <kbd>↑</kbd> / <kbd>↓</kbd>, <kbd>Tab</kbd> / <kbd>→</kbd>\n            </span>\n          </div>\n        </div>\n      </section>\n    </main>\n  </body>\n</html>\n",
  "/home/user/Documents/Notes.txt": "Notes\n-----\n- Test Piloti Folders & Desktop VFS\n",
  "/home/user/Downloads/readme.md": "# Downloads\n\nLocal browser VFS folder stored in localStorage.\n"
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
      "name": "piloti-applications",
      "fileType": 0
    },
    {
      "name": "piloti-calculator",
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
      "name": "piloti-image-viewer",
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
  "/usr/share/applications": [
    {
      "name": "piloti-applications.desktop",
      "fileType": 0
    },
    {
      "name": "piloti-calculator.desktop",
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
      "name": "org.gnome.Console.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.DevTools.svg",
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
      "name": "org.gnome.Software.svg",
      "fileType": 0
    },
    {
      "name": "org.gnome.TextEditor.svg",
      "fileType": 0
    },
    {
      "name": "piloti-calculator.svg",
      "fileType": 0
    },
    {
      "name": "piloti-desktop.svg",
      "fileType": 0
    },
    {
      "name": "piloti-image-viewer.svg",
      "fileType": 0
    },
    {
      "name": "piloti-settings.svg",
      "fileType": 0
    },
    {
      "name": "piloti-terminal.svg",
      "fileType": 0
    },
    {
      "name": "piloti-text-editor.svg",
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
      "name": "piloti-console.svg",
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
      "name": "utilities-terminal.svg",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Papirus/64x64/devices": [
    {
      "name": "drive-removable-media-usb.svg",
      "fileType": 0
    },
    {
      "name": "drive-removable-media.svg",
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
      "name": "user-trash.json",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/animated/status": [
    {
      "name": "user-trash-full.json",
      "fileType": 0
    }
  ],
  "/usr/share/icons/Piloti/animated": [
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
  "/usr/share/icons/Piloti/scalable/apps": [],
  "/usr/share/icons/Piloti/scalable/mimetypes": [
    {
      "name": "application-x-zerosize.svg",
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
  "/usr/share/piloti-desktop": [
    {
      "name": "domicile.json",
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
      "name": "icons",
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
