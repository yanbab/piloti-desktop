const O=`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Piloti Desktop</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #fafafa;
        --surface: #ffffff;
        --surface-alt: #f1f1f4;
        --border: rgba(0, 0, 0, 0.09);
        --text: #1c1c1e;
        --muted: #5e5e66;
        --accent: #3584e4;
        --accent-soft: rgba(53, 132, 228, 0.12);
        --kbd-bg: #ececf0;
        --kbd-border: rgba(0, 0, 0, 0.14);
        --stage-sky: #e7eef8;
        --stage-bar: #ffffff;
        --stage-dock: #ffffff;
        --stage-tile: #d4e3f7;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #202024;
          --surface: #2c2c31;
          --surface-alt: #35353b;
          --border: rgba(255, 255, 255, 0.09);
          --text: #f4f4f6;
          --muted: #a8a8b2;
          --accent: #5294e2;
          --accent-soft: rgba(82, 148, 226, 0.18);
          --kbd-bg: #3a3a41;
          --kbd-border: rgba(255, 255, 255, 0.16);
          --stage-sky: #252b38;
          --stage-bar: #1a1a1f;
          --stage-dock: #1a1a1f;
          --stage-tile: #33435c;
        }
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 36px 20px 56px;
        font-family: "Cantarell", "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }

      main {
        max-width: 820px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 28px;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px 28px;
      }

      .hero-copy {
        flex: 1;
        min-width: 240px;
      }

      .badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 9999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 10px;
      }

      h1 {
        margin: 0 0 6px;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .subtitle {
        margin: 0;
        color: var(--muted);
        font-size: 14.5px;
      }

      .hero-diagram {
        width: 220px;
        max-width: 100%;
        height: auto;
        flex-shrink: 0;
      }

      section h2 {
        margin: 0 0 12px;
        font-size: 15px;
        font-weight: 700;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 12px;
      }

      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .card-head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .icon-box {
        width: 32px;
        height: 32px;
        border-radius: 9px;
        background: var(--accent-soft);
        color: var(--accent);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .card h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
      }

      .card p {
        margin: 0;
        font-size: 13.5px;
        color: var(--muted);
      }

      .shortcuts {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
      }

      .shortcut-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 11px 18px;
        border-bottom: 1px solid var(--border);
        font-size: 13.5px;
      }

      .shortcut-row:last-child {
        border-bottom: none;
      }

      .shortcut-keys {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      kbd {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 6px;
        background: var(--kbd-bg);
        border: 1px solid var(--kbd-border);
        font-family: "Adwaita Mono", ui-monospace, SFMono-Regular, monospace;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--text);
      }

      @media (max-width: 560px) {
        header {
          padding: 20px;
        }
        .shortcut-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="hero-copy">
          <div class="badge">Getting Started</div>
          <h1>Welcome to Piloti Desktop</h1>
          <p class="subtitle">
            A quick guide to the Menu bar, Dock, Desktop icons, and essential shortcuts.
          </p>
        </div>

        <!-- Flat vector desktop diagram -->
        <svg
          class="hero-diagram"
          viewBox="0 0 240 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="236" height="146" rx="14" fill="var(--stage-sky)" stroke="var(--border)" stroke-width="2" />
          <!-- Menu bar -->
          <rect x="8" y="8" width="224" height="16" rx="6" fill="var(--stage-bar)" stroke="var(--border)" />
          <circle cx="19" cy="16" r="3" fill="var(--accent)" />
          <rect x="27" y="14" width="26" height="4" rx="2" fill="var(--muted)" opacity="0.55" />
          <rect x="108" y="13" width="24" height="6" rx="3" fill="var(--accent)" opacity="0.85" />
          <rect x="190" y="14" width="32" height="4" rx="2" fill="var(--muted)" opacity="0.55" />

          <!-- Desktop icons -->
          <rect x="16" y="34" width="22" height="22" rx="6" fill="var(--accent)" opacity="0.9" />
          <rect x="14" y="60" width="26" height="4" rx="2" fill="var(--muted)" opacity="0.55" />
          <rect x="16" y="74" width="22" height="22" rx="6" fill="var(--stage-tile)" />
          <rect x="14" y="100" width="26" height="4" rx="2" fill="var(--muted)" opacity="0.55" />

          <!-- Window -->
          <rect x="64" y="34" width="154" height="82" rx="10" fill="var(--surface)" stroke="var(--border)" />
          <rect x="64" y="34" width="154" height="20" rx="10" fill="var(--surface-alt)" />
          <circle cx="77" cy="44" r="3" fill="#e62d42" opacity="0.85" />
          <circle cx="87" cy="44" r="3" fill="#f5c211" opacity="0.85" />
          <circle cx="97" cy="44" r="3" fill="#3a944a" opacity="0.85" />
          <rect x="78" y="66" width="84" height="7" rx="3.5" fill="var(--accent)" opacity="0.28" />
          <rect x="78" y="80" width="124" height="6" rx="3" fill="var(--muted)" opacity="0.28" />
          <rect x="78" y="92" width="102" height="6" rx="3" fill="var(--muted)" opacity="0.22" />

          <!-- Dock -->
          <rect x="64" y="123" width="112" height="19" rx="8" fill="var(--stage-dock)" stroke="var(--border)" />
          <rect x="73" y="127" width="11" height="11" rx="3" fill="var(--accent)" />
          <rect x="90" y="127" width="11" height="11" rx="3" fill="var(--stage-tile)" />
          <rect x="107" y="127" width="11" height="11" rx="3" fill="var(--accent)" opacity="0.65" />
          <rect x="124" y="127" width="11" height="11" rx="3" fill="var(--stage-tile)" />
          <rect x="141" y="127" width="11" height="11" rx="3" fill="var(--accent)" opacity="0.45" />
          <rect x="158" y="127" width="11" height="11" rx="3" fill="var(--stage-tile)" />
        </svg>
      </header>

      <div id="shortcuts"></div>

      <section>
        <h2>Shell &amp; Navigation</h2>
        <div class="shortcuts">
          <div class="shortcut-row">
            <span>Open Launcher (search apps, folders, actions, URLs)</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>Space</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Open Piloti system menu</span>
            <span class="shortcut-keys">
              <kbd>Ctrl</kbd> + <kbd>Esc</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Navigate open menus &amp; panels</span>
            <span class="shortcut-keys">
              <kbd>←</kbd> / <kbd>→</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Toggle Overview (workspaces &amp; window spread)</span>
            <span class="shortcut-keys">
              <kbd>Meta</kbd> + <kbd>↑</kbd> / <kbd>F3</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Switch workspace</span>
            <span class="shortcut-keys">
              <kbd>Meta</kbd> + <kbd>←</kbd> / <kbd>→</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Toggle Control Panel &amp; Notifications</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>N</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Open Desktop Settings</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>,</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Switch open windows with live previews</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>Tab</kbd>
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2>Windows</h2>
        <div class="shortcuts">
          <div class="shortcut-row">
            <span>Tile focused window left / right half</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>[</kbd> / <kbd>Alt</kbd> + <kbd>]</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Maximize / restore focused window</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>F</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Minimize focused window</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>M</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Close focused window</span>
            <span class="shortcut-keys">
              <kbd>Alt</kbd> + <kbd>W</kbd>
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2>Capture &amp; System</h2>
        <div class="shortcuts">
          <div class="shortcut-row">
            <span>Take screenshot</span>
            <span class="shortcut-keys">
              <kbd>Print</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Launch Terminal</span>
            <span class="shortcut-keys">
              <kbd>Meta</kbd> + <kbd>Return</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Lock Screen</span>
            <span class="shortcut-keys">
              <kbd>Ctrl</kbd> + <kbd>Cmd</kbd> + <kbd>Q</kbd>
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2>Launcher &amp; App Sidebars</h2>
        <div class="shortcuts">
          <div class="shortcut-row">
            <span>Accept inline autocomplete in Launcher</span>
            <span class="shortcut-keys">
              <kbd>Tab</kbd> / <kbd>→</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Browse Launcher search history</span>
            <span class="shortcut-keys">
              <kbd>↑</kbd> / <kbd>↓</kbd>
            </span>
          </div>
          <div class="shortcut-row">
            <span>Navigate sidebar items &amp; move focus to content</span>
            <span class="shortcut-keys">
              <kbd>↑</kbd> / <kbd>↓</kbd>, <kbd>Tab</kbd> / <kbd>→</kbd>
            </span>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
`,x="piloti.web.vfs.v1",L="piloti:web-vfs-changed",E="/home/user",k="/home/user/.local/share/Trash/files",z=`Piloti Desktop Web VFS (localStorage)
Type 'help' for shell commands, 'piloti help' for desktop controls, or 'cat ~/Documents/Notes.txt'.
`,B=`[Default Applications]
inode/directory=nautilus.desktop
text/plain=text-editor.desktop
text/markdown=text-editor.desktop
text/html=browser.desktop
application/json=text-editor.desktop
image/png=image-viewer.desktop
image/jpeg=image-viewer.desktop
image/webp=image-viewer.desktop
image/gif=image-viewer.desktop
image/svg+xml=image-viewer.desktop

[Added Associations]
inode/directory=nautilus.desktop;terminal.desktop;
text/plain=text-editor.desktop;terminal.desktop;
text/markdown=text-editor.desktop;browser.desktop;
text/html=browser.desktop;text-editor.desktop;
text/*=text-editor.desktop;terminal.desktop;
application/json=text-editor.desktop;console.desktop;
image/*=image-viewer.desktop;browser.desktop;
`,R=["/etc","/home/user","/home/user/Desktop","/home/user/Documents","/home/user/Downloads","/home/user/Music","/home/user/Pictures","/home/user/Videos","/home/user/.config","/home/user/.config/piloti","/home/user/.config/piloti/plugins","/home/user/.config/Piloti","/home/user/.config/domicile","/home/user/.local","/home/user/.local/share","/home/user/.local/share/applications","/home/user/.local/share/Trash",k],U={"piloti-files.desktop":`[Desktop Entry]
Type=Application
Name=Files
Comment=Browse local virtual files and folders
Exec=piloti-files %U
Icon=system-file-manager
Categories=System;FileManager;
MimeType=inode/directory;
`,"piloti-terminal.desktop":`[Desktop Entry]
Type=Application
Name=Web Terminal
Comment=Web shell with VFS commands
Exec=piloti-terminal
Icon=piloti-terminal
Categories=System;TerminalEmulator;Development;
`,"piloti-notepad.desktop":`[Desktop Entry]
Type=Application
Name=Notepad
Comment=Minimal plain-text notepad with instant VFS save
Exec=piloti-notepad %F
Icon=piloti-text-editor
Categories=Utility;TextEditor;
MimeType=text/plain;text/markdown;application/json;
`,"piloti-calculator.desktop":`[Desktop Entry]
Type=Application
Name=Calculator
Comment=Basic & Scientific Calculator
Exec=piloti-calculator
Icon=piloti-calculator
Categories=Utility;Calculator;
`,"piloti-image-viewer.desktop":`[Desktop Entry]
Type=Application
Name=Image Viewer
Comment=Fast image viewer and crop/rotate editor
Exec=piloti-image-viewer %F
Icon=piloti-image-viewer
Categories=Graphics;Viewer;
MimeType=image/png;image/jpeg;image/webp;image/gif;image/svg+xml;
`,"piloti-app-store.desktop":`[Desktop Entry]
Type=Application
Name=App Store
Comment=Browse and install apps and web apps
Exec=piloti-app-store
Icon=org.gnome.Software
Categories=System;PackageManager;
`,"piloti-devtools.desktop":`[Desktop Entry]
Type=Application
Name=DevTools
Comment=Shell DevTools, live logs, inspector, and JS console
Exec=piloti-devtools
Icon=org.gnome.DevTools
Categories=Development;Debugger;
`,"piloti-settings.desktop":`[Desktop Entry]
Type=Application
Name=Desktop Settings
Comment=Configure appearance, fonts, dock, and wallpaper
Exec=piloti-settings
Icon=piloti-settings
Categories=Settings;DesktopSettings;
`};function D(s){const t=s.split("/").filter(Boolean);return t[t.length-1]??"/"}function w(s){const t=m(s);if(t==="/")return"/";const n=t.lastIndexOf("/");return n<=0?"/":t.slice(0,n)}function m(s){if(!s||s==="~"||s==="~/")return E;let t=s.trim();return t.startsWith("~/")?t=`${E}/${t.slice(2)}`:t.startsWith("/")||(t=`${E}/${t}`),t.replace(/\/+/g,"/").replace(/\/+$/,"")||"/"}function ht(s,t){const n=m(s);if(!t||!t.trim())return n;const e=t.trim();if(e==="~")return E;const o=e.startsWith("~/")?`${E}/${e.slice(2)}`:e.startsWith("/")?e:`${n==="/"?"":n}/${e}`,a=[];for(const i of o.split("/"))!i||i==="."||(i===".."?a.pop():a.push(i));return`/${a.join("/")}`}function _(){const s=Date.now(),t=R.map(n=>({id:n,name:D(n),kind:"directory",path:n,parentPath:w(n),updatedAt:s}));t.push({id:"/home/user/Desktop/Welcome.html",name:"Welcome.html",kind:"file",path:"/home/user/Desktop/Welcome.html",parentPath:"/home/user/Desktop",content:O,updatedAt:s},{id:"/home/user/Desktop/Projects",name:"Projects",kind:"directory",path:"/home/user/Desktop/Projects",parentPath:"/home/user/Desktop",updatedAt:s},{id:"/home/user/Documents/Notes.txt",name:"Notes.txt",kind:"file",path:"/home/user/Documents/Notes.txt",parentPath:"/home/user/Documents",content:`Notes
-----
- Test Piloti Files & Desktop VFS
`,updatedAt:s},{id:"/home/user/Downloads/readme.md",name:"readme.md",kind:"file",path:"/home/user/Downloads/readme.md",parentPath:"/home/user/Downloads",content:`# Downloads

Local browser VFS folder stored in localStorage.
`,updatedAt:s},{id:"/etc/issue",name:"issue",kind:"file",path:"/etc/issue",parentPath:"/etc",content:z,updatedAt:s},{id:"/home/user/.config/mimeapps.list",name:"mimeapps.list",kind:"file",path:"/home/user/.config/mimeapps.list",parentPath:"/home/user/.config",content:B,updatedAt:s});for(const[n,e]of Object.entries(U)){const o=`/home/user/.local/share/applications/${n}`;t.push({id:o,name:n,kind:"file",path:o,parentPath:"/home/user/.local/share/applications",content:e,updatedAt:s})}return t}let $=null,S=null;function u(){if(typeof localStorage>"u")return _();try{const t=localStorage.getItem(x);if(t&&$!==null&&t===S)return $;if(!t){const e=_(),o=JSON.stringify(e);return localStorage.setItem(x,o),$=e,S=o,e}const n=JSON.parse(t);if(Array.isArray(n)){const e=n,o="piloti.web.vfs.welcome.v1";localStorage.getItem(o)||(localStorage.setItem(o,"1"),e.some(l=>l.path==="/home/user/Desktop/Welcome.html"||l.path===`${k}/Welcome.html`)||(e.push({id:"/home/user/Desktop/Welcome.html",name:"Welcome.html",kind:"file",path:"/home/user/Desktop/Welcome.html",parentPath:"/home/user/Desktop",content:O,updatedAt:Date.now()}),localStorage.setItem(x,JSON.stringify(e))));let a=!1;const i=Date.now();e.some(r=>r.path==="/etc/issue")||(e.some(r=>r.path==="/etc")||e.push({id:"/etc",name:"etc",kind:"directory",path:"/etc",parentPath:"/",updatedAt:i}),e.push({id:"/etc/issue",name:"issue",kind:"file",path:"/etc/issue",parentPath:"/etc",content:z,updatedAt:i}),a=!0),e.some(r=>r.path==="/home/user/.config/mimeapps.list")||(e.some(r=>r.path==="/home/user/.config")||e.push({id:"/home/user/.config",name:".config",kind:"directory",path:"/home/user/.config",parentPath:"/home/user",updatedAt:i}),e.push({id:"/home/user/.config/mimeapps.list",name:"mimeapps.list",kind:"file",path:"/home/user/.config/mimeapps.list",parentPath:"/home/user/.config",content:B,updatedAt:i}),a=!0);for(const r of R)e.some(l=>l.path===r)||(e.push({id:r,name:D(r),kind:"directory",path:r,parentPath:w(r),updatedAt:i}),a=!0);for(const[r,l]of Object.entries(U)){const c=`/home/user/.local/share/applications/${r}`;e.some(p=>p.path===c)||(e.push({id:c,name:r,kind:"file",path:c,parentPath:"/home/user/.local/share/applications",content:l,updatedAt:i}),a=!0)}if(a){const r=JSON.stringify(e);localStorage.setItem(x,r),$=e,S=r}else $=e,S=t;return e}}catch{}const s=_();try{localStorage.setItem(x,JSON.stringify(s))}catch{}return s}let A;function j(){if(A!==void 0)return A;if(typeof BroadcastChannel>"u")return A=null,null;try{A=new BroadcastChannel("piloti-vfs")}catch{A=null}return A}function J(s){var t;try{(t=j())==null||t.postMessage(s)}catch{}}function b(s){if(typeof localStorage<"u")try{const t=JSON.stringify(s);localStorage.setItem(x,t),$=s,S=t}catch{}typeof window<"u"&&window.dispatchEvent(new CustomEvent(L)),J({type:"vfs-changed"})}function y(s,t,n,e=""){const o=new Set(s.filter(r=>r.parentPath===t).map(r=>r.name.toLowerCase())),a=`${n}${e}`;if(!o.has(a.toLowerCase()))return a;let i=2;for(;o.has(`${n} ${i}${e}`.toLowerCase());)i+=1;return`${n} ${i}${e}`}function G(s,t){const n=m(s),e=u(),o=!!(t!=null&&t.includeHidden),a=e.filter(i=>i.parentPath===n&&(o||!i.name.startsWith(".")));return n==="/"&&!a.some(i=>i.path==="/home")&&a.unshift({id:"/home",name:"home",kind:"directory",path:"/home",parentPath:"/",updatedAt:0}),a}function H(s){const t=m(s),n=u().find(e=>e.path===t);if(n)return n;if(t==="/"||t==="/home")return{id:t,name:D(t),kind:"directory",path:t,parentPath:"/",updatedAt:0}}function X(s,t="New Folder"){const n=m(s),e=u(),o=y(e,n,t),a=`${n==="/"?"":n}/${o}`,i={id:a,name:o,kind:"directory",path:a,parentPath:n,updatedAt:Date.now()};return b([...e,i]),i}function Y(s,t="Untitled",n=""){const e=m(s),o=u(),a=/\.[a-z0-9]+$/i.test(t),i=a?t.replace(/\.[a-z0-9]+$/i,""):t,r=a?t.slice(i.length):".txt",l=y(o,e,i,r),c=`${e==="/"?"":e}/${l}`,p={id:c,name:l,kind:"file",path:c,parentPath:e,content:n,updatedAt:Date.now()};return b([...o,p]),p}function Q(s){const t=m(s);let n=u();const e=n.find(c=>c.path===t);if(e)return e;const o=t.split("/").filter(Boolean);let a="";const i=Date.now();let r,l=!1;for(const c of o){const p=a||"/";a=`${a}/${c}`;const d=n.find(f=>f.path===a);if(d)r=d;else{const f={id:a,name:c,kind:"directory",path:a,parentPath:p,updatedAt:i};n=[...n,f],r=f,l=!0}}return l&&b(n),r??{id:t,name:D(t),kind:"directory",path:t,parentPath:w(t),updatedAt:i}}function ft(s,t){const n=m(s);Q(w(n));const e=u(),o=e.find(i=>i.path===n);if(o){const i=e.map(r=>r.path===n?{...r,content:t,updatedAt:Date.now()}:r);return b(i),{...o,content:t,updatedAt:Date.now()}}const a={id:n,name:D(n),kind:"file",path:n,parentPath:w(n),content:t,updatedAt:Date.now()};return b([...e,a]),a}const I="piloti.web.vfs.emblems.v1",M="piloti.web.vfs.favorites.v1",ut="piloti://favorites",gt="piloti://recents",bt={favorite:{label:"Favorite",colorClass:"text-rose-500",badgeBgClass:"bg-rose-500/90 text-white"},important:{label:"Important",colorClass:"text-amber-500",badgeBgClass:"bg-amber-500/90 text-white"},work:{label:"Work",colorClass:"text-sky-500",badgeBgClass:"bg-sky-500/90 text-white"},personal:{label:"Personal",colorClass:"text-emerald-500",badgeBgClass:"bg-emerald-500/90 text-white"}},Z=new Set(["favorite","important","work","personal"]),tt={favorite:"emblem-favorite",important:"emblem-important",work:"emblem-work",personal:"emblem-personal"},et={"emblem-favorite":"favorite","emblem-important":"important","emblem-work":"work","emblem-personal":"personal"};function nt(s){return tt[s]}function st(s){const t=s.trim().toLowerCase();return Z.has(t)?t:et[t]??null}function N(s){if(!Array.isArray(s))return[];const t=[];for(const n of s){if(typeof n!="string")continue;const e=st(n);e&&!t.includes(e)&&t.push(e)}return t}function T(){var t;if(typeof localStorage>"u")return{};const s={};try{const n=u();for(const e of n){const o=(t=e.metadata)==null?void 0:t["metadata::emblems"],a=N(o);a.length>0&&(s[m(e.path)]=a)}}catch{}try{const n=localStorage.getItem(I);if(n){const o=JSON.parse(n);if(o&&typeof o=="object"&&!Array.isArray(o)){for(const[a,i]of Object.entries(o)){const r=m(a);if(!s[r]){const l=N(i);l.length>0&&(s[r]=l)}}return s}}const e=localStorage.getItem(M);if(e){const o=JSON.parse(e);if(Array.isArray(o)){for(const a of o)if(typeof a=="string"){const i=m(a);s[i]||(s[i]=["favorite"])}return s}}}catch{}return s}function K(s,t=!0){if(typeof localStorage<"u")try{const n={},e=[];for(const[r,l]of Object.entries(s))l.length>0&&(n[r]=l,l.includes("favorite")&&e.push(r));const o=u();let a=!1;const i=o.map(r=>{var h;const l=m(r.path),c=n[l],p=c==null?void 0:c.map(nt),d=(h=r.metadata)==null?void 0:h["metadata::emblems"];if(JSON.stringify(d??null)===JSON.stringify(p??null))return r;if(a=!0,!p||p.length===0){if(!r.metadata)return r;const g={...r.metadata};return delete g["metadata::emblems"],{...r,metadata:Object.keys(g).length>0?g:void 0}}return{...r,metadata:{...r.metadata??{},"metadata::emblems":p}}});a&&localStorage.setItem(x,JSON.stringify(i)),localStorage.setItem(I,JSON.stringify(n)),localStorage.setItem(M,JSON.stringify(e))}catch{}t&&typeof window<"u"&&window.dispatchEvent(new CustomEvent(L))}function P(s,t){const n=m(s),e=t?m(t):null,o=T();if(Object.keys(o).length===0)return;const a=`${n}/`,i={};let r=!1;for(const[l,c]of Object.entries(o))if(l===n)r=!0,e&&(i[e]=Array.from(new Set([...i[e]??[],...c])));else if(l.startsWith(a)){if(r=!0,e){const p=l.slice(a.length),d=`${e}/${p}`;i[d]=Array.from(new Set([...i[d]??[],...c]))}}else i[l]=c;r&&K(i,!1)}function at(s){const t=m(s);return T()[t]??[]}function ot(s,t){return at(s).includes(t)}function it(s,t,n){const e=m(s),o=T(),a=o[e]??[],i=n?a.includes(t)?a:[...a,t]:a.filter(r=>r!==t);return i.length>0?o[e]=i:delete o[e],K(o,!0),i}function kt(s,t){return it(s,t,!ot(s,t))}function wt(s,t){const n=m(s),e=t.trim().replace(/[/\\]/g,"");if(!e)return null;const o=u(),a=o.find(c=>c.path===n);if(!a||a.name===e)return null;const i=`${a.parentPath==="/"?"":a.parentPath}/${e}`;if(o.some(c=>c.path===i))return null;const r=`${n}/`,l=o.map(c=>{if(c.path===n)return{...c,id:i,name:e,path:i,updatedAt:Date.now()};if(c.path.startsWith(r)){const p=c.path.slice(r.length),d=`${i}/${p}`;return{...c,id:d,path:d,parentPath:w(d)}}return c});return P(n,i),b(l),typeof window<"u"&&window.dispatchEvent(new CustomEvent("piloti:vfs-renamed",{detail:{oldPath:n,newPath:i}})),J({type:"vfs-renamed",oldPath:n,newPath:i}),l.find(c=>c.path===i)??null}function vt(s){const t=m(s),n=u();if(!n.find(a=>a.path===t))return!1;const o=`${t}/`;return P(t,null),b(n.filter(a=>a.path!==t&&!a.path.startsWith(o))),!0}function rt(s){const t=m(s),n=u(),e=n.find(d=>d.path===t);if(!e)return;const o=`${t}/`;if(e.parentPath===k||t.startsWith(`${k}/`)){P(t,null),b(n.filter(d=>d.path!==t&&!d.path.startsWith(o)));return}const a=e.kind==="file"&&/\.[a-z0-9]+$/i.test(e.name),i=a?e.name.replace(/\.[a-z0-9]+$/i,""):e.name,r=a?e.name.slice(i.length):"",l=y(n,k,i,r),c=`${k}/${l}`,p=n.map(d=>{if(d.path===t)return{...d,id:c,name:l,path:c,parentPath:k,trashedFromPath:d.path,updatedAt:Date.now()};if(d.path.startsWith(o)){const f=d.path.slice(o.length),h=`${c}/${f}`;return{...d,id:h,path:h,parentPath:w(h)}}return d});P(t,c),b(p)}function xt(s){const t=m(s),n=u(),e=n.find(g=>g.path===t);if(!e)return null;const o=e.trashedFromPath||`${E}/Desktop/${e.name}`;let a=w(o);n.some(g=>g.path===a&&g.kind==="directory")||(a=`${E}/Desktop`);const i=e.kind==="file"&&/\.[a-z0-9]+$/i.test(e.name),r=i?e.name.replace(/\.[a-z0-9]+$/i,""):e.name,l=i?e.name.slice(r.length):"",c=y(n,a,r,l),p=`${a==="/"?"":a}/${c}`,d=`${t}/`;let f=null;const h=n.map(g=>{if(g.path===t){const v={...g,id:p,name:c,path:p,parentPath:a,trashedFromPath:void 0,updatedAt:Date.now()};return f=v,v}if(g.path.startsWith(d)){const v=g.path.slice(d.length),F=`${p}/${v}`;return{...g,id:F,path:F,parentPath:w(F)}}return g});return P(t,p),b(h),f}function yt(){const s=u(),t=`${k}/`;for(const n of s)n.parentPath===k&&P(n.path,null);b(s.filter(n=>!n.path.startsWith(t)))}function Et(s,t){const n=m(s),e=m(t);if(n===e||e.startsWith(`${n}/`))return null;const o=u(),a=o.find(h=>h.path===n);if(!a||a.parentPath===e)return null;if(e===k)return rt(n),null;const i=a.kind==="file"&&/\.[a-z0-9]+$/i.test(a.name),r=i?a.name.replace(/\.[a-z0-9]+$/i,""):a.name,l=i?a.name.slice(r.length):"",c=y(o,e,r,l),p=`${e==="/"?"":e}/${c}`,d=`${n}/`,f=o.map(h=>{if(h.path===n)return{...h,id:p,name:c,path:p,parentPath:e,updatedAt:Date.now()};if(h.path.startsWith(d)){const g=h.path.slice(d.length),v=`${p}/${g}`;return{...h,id:v,path:v,parentPath:w(v)}}return h});return P(n,p),b(f),f.find(h=>h.path===p)??null}function Pt(s){if(typeof window>"u")return()=>{};const t=o=>{(o.key===x||o.key===I||o.key===M)&&s()};window.addEventListener(L,s),window.addEventListener("storage",t);const n=j(),e=o=>{var a,i;(((a=o.data)==null?void 0:a.type)==="vfs-changed"||((i=o.data)==null?void 0:i.type)==="vfs-renamed")&&s()};return n==null||n.addEventListener("message",e),()=>{window.removeEventListener(L,s),window.removeEventListener("storage",t),n==null||n.removeEventListener("message",e)}}function At(s){if(typeof window>"u")return()=>{};const t=o=>{const a=o.detail;a!=null&&a.oldPath&&(a!=null&&a.newPath)&&s({oldPath:a.oldPath,newPath:a.newPath})},n=j(),e=o=>{var a;((a=o.data)==null?void 0:a.type)==="vfs-renamed"&&o.data.oldPath&&o.data.newPath&&s({oldPath:o.data.oldPath,newPath:o.data.newPath})};return window.addEventListener("piloti:vfs-renamed",t),n==null||n.addEventListener("message",e),()=>{window.removeEventListener("piloti:vfs-renamed",t),n==null||n.removeEventListener("message",e)}}function C(s){return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function $t(s){const t=s.name.toLowerCase(),n=s.content??"";if(/\.(html|htm)$/.test(t))return URL.createObjectURL(new Blob([n],{type:"text/html;charset=utf-8"}));if(/\.svg$/.test(t))return URL.createObjectURL(new Blob([n],{type:"image/svg+xml;charset=utf-8"}));if(/\.(png|jpe?g|gif|webp|bmp|ico|avif)$/.test(t)){const e=n.trim();if(/^(data:image\/|blob:|https?:\/\/)/i.test(e)){const o=`<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#141414"><img src="${C(e)}" alt="${C(s.name)}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`;return URL.createObjectURL(new Blob([o],{type:"text/html;charset=utf-8"}))}}if(/\.(mp4|webm|ogg|mov)$/.test(t)){const e=n.trim();if(/^(data:|blob:|https?:\/\/)/i.test(e)){const o=`<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000"><video controls autoplay src="${C(e)}" style="max-width:100%;max-height:100vh"></video></body></html>`;return URL.createObjectURL(new Blob([o],{type:"text/html;charset=utf-8"}))}}if(/\.(mp3|wav|flac|m4a)$/.test(t)){const e=n.trim();if(/^(data:|blob:|https?:\/\/)/i.test(e)){const o=`<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#181818;color:#fff;font-family:system-ui"><audio controls autoplay src="${C(e)}"></audio></body></html>`;return URL.createObjectURL(new Blob([o],{type:"text/html;charset=utf-8"}))}}if(/\.pdf$/.test(t)){const e=n.trim();if(/^(data:application\/pdf|blob:|https?:\/\/)/i.test(e))return e}return URL.createObjectURL(new Blob([n],{type:"text/plain;charset=utf-8"}))}const ct=/\.(txt|md|markdown|json|css|scss|less|js|mjs|cjs|ts|tsx|jsx|xml|csv|tsv|ya?ml|toml|ini|conf|cfg|log|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|sql)$/i;function St(s){const t=s.toLowerCase();return/\.(html?|svg|png|jpe?g|gif|webp|bmp|ico|avif|mp4|webm|mkv|mov|avi|m4v|mp3|wav|flac|m4a|ogg|aac|pdf|zip|tar|gz|bz2|xz|7z|rar)$/i.test(t)?!1:ct.test(t)||!/\.[a-z0-9]+$/i.test(t)}const lt=/\.(txt|md|markdown|json|html?|css|scss|less|js|mjs|cjs|ts|tsx|jsx|svg|xml|csv|tsv|ya?ml|toml|ini|conf|cfg|log|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|sql)$/i;function dt(s){return new Promise((t,n)=>{const e=new FileReader;e.onload=()=>t(typeof e.result=="string"?e.result:""),e.onerror=()=>n(e.error??new Error("Failed to read file")),e.readAsDataURL(s)})}async function Dt(s,t){const n=Array.from(t);if(n.length===0)return[];const e=m(s),o=[];for(const a of n){const i=a.name||"Imported",l=a.type.startsWith("text/")||a.type==="application/json"||a.type==="application/xml"||a.type==="image/svg+xml"||lt.test(i)?await a.text():await dt(a);o.push(Y(e,i,l))}return o}function pt(){const s=T();return Object.entries(s).filter(([,t])=>t.includes("favorite")).map(([t])=>t)}function Ct(){const s=new Set(pt());return u().filter(t=>s.has(t.path))}function Vt(s=30){return u().filter(t=>t.kind==="file"&&!t.path.startsWith("/home/user/.local/")&&t.updatedAt>0).sort((t,n)=>n.updatedAt-t.updatedAt).slice(0,s)}function q(s,t){const n=m(s),e=m(t),o=H(n);if(!o)return null;if(o.kind==="file"){const r=u(),l=/\.[a-z0-9]+$/i.test(o.name),c=l?o.name.replace(/\.[a-z0-9]+$/i,""):o.name,p=l?o.name.slice(c.length):"",d=y(r,e,c,p),f=`${e==="/"?"":e}/${d}`,h={id:f,name:d,kind:"file",path:f,parentPath:e,content:o.content??"",updatedAt:Date.now()};return b([...r,h]),h}if(e===n||e.startsWith(`${n}/`))return null;const a=X(e,o.name),i=G(o.path);for(const r of i)q(r.path,a.path);return a}function Lt(s){const t=m(s),n=H(t);if(!n)return null;const e=n.parentPath,o=u();if(n.kind==="file"){const l=/\.[a-z0-9]+$/i.test(n.name),c=l?n.name.replace(/\.[a-z0-9]+$/i,""):n.name,p=l?n.name.slice(c.length):"",d=y(o,e,`${c} Copy`,p),f=`${e==="/"?"":e}/${d}`,h={id:f,name:d,kind:"file",path:f,parentPath:e,content:n.content??"",updatedAt:Date.now()};return b([...o,h]),h}const a=y(o,e,`${n.name} Copy`),i=`${e==="/"?"":e}/${a}`,r={id:i,name:a,kind:"directory",path:i,parentPath:e,updatedAt:Date.now()};b([...o,r]);for(const l of G(n.path))q(l.path,r.path);return r}const W="piloti:vfs-clipboard-changed";let V=null;function Tt(){return V?{mode:V.mode,paths:[...V.paths]}:null}function Ft(s){V=s&&s.paths.length>0?{mode:s.mode,paths:Array.from(new Set(s.paths.map(n=>m(n))))}:null,typeof window<"u"&&window.dispatchEvent(new CustomEvent(W))}function _t(s){return typeof window>"u"?()=>{}:(window.addEventListener(W,s),()=>{window.removeEventListener(W,s)})}const mt=/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;function Wt(s,t){return mt.test(s)?!0:!!(t&&t.startsWith("data:image/"))}function jt(s,t){if(t){if(t.startsWith("data:image/"))return t;if(s.toLowerCase().endsWith(".svg")&&t.includes("<svg"))return`data:image/svg+xml;utf8,${encodeURIComponent(t)}`}}export{xt as A,vt as B,L as C,B as D,Q as E,x as F,ut as G,Ct as H,gt as I,Vt as J,ht as K,bt as V,k as W,Pt as a,$t as b,E as c,T as d,yt as e,jt as f,H as g,Tt as h,_t as i,X as j,Y as k,G as l,Wt as m,m as n,St as o,Lt as p,Et as q,wt as r,At as s,rt as t,kt as u,at as v,ft as w,Ft as x,Dt as y,q as z};
