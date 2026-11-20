const T=`<!doctype html>
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
`,v="piloti.web.vfs.v1",S="piloti:web-vfs-changed",y="/home/user",k="/home/user/.local/share/Trash/files",C=`Piloti Desktop Web VFS (localStorage)
Type 'help' for shell commands, 'piloti help' for desktop controls, or 'cat ~/Documents/Notes.txt'.
`,z=`[Default Applications]
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
`,N=["/etc","/home/user","/home/user/Desktop","/home/user/Documents","/home/user/Downloads","/home/user/Music","/home/user/Pictures","/home/user/Videos","/home/user/.config","/home/user/.local","/home/user/.local/share","/home/user/.local/share/applications","/home/user/.local/share/Trash",k];function F(s){const t=s.split("/").filter(Boolean);return t[t.length-1]??"/"}function E(s){const t=p(s);if(t==="/")return"/";const n=t.lastIndexOf("/");return n<=0?"/":t.slice(0,n)}function p(s){if(!s||s==="~"||s==="~/")return y;let t=s.trim();return t.startsWith("~/")?t=`${y}/${t.slice(2)}`:t.startsWith("/")||(t=`${y}/${t}`),t.replace(/\/+/g,"/").replace(/\/+$/,"")||"/"}function nt(s,t){const n=p(s);if(!t||!t.trim())return n;const e=t.trim();if(e==="~")return y;const r=e.startsWith("~/")?`${y}/${e.slice(2)}`:e.startsWith("/")?e:`${n==="/"?"":n}/${e}`,a=[];for(const o of r.split("/"))!o||o==="."||(o===".."?a.pop():a.push(o));return`/${a.join("/")}`}function W(){const s=Date.now(),t=N.map(n=>({id:n,name:F(n),kind:"directory",path:n,parentPath:E(n),updatedAt:s}));return t.push({id:"/home/user/Desktop/Welcome.html",name:"Welcome.html",kind:"file",path:"/home/user/Desktop/Welcome.html",parentPath:"/home/user/Desktop",content:T,updatedAt:s},{id:"/home/user/Desktop/Projects",name:"Projects",kind:"directory",path:"/home/user/Desktop/Projects",parentPath:"/home/user/Desktop",updatedAt:s},{id:"/home/user/Documents/Notes.txt",name:"Notes.txt",kind:"file",path:"/home/user/Documents/Notes.txt",parentPath:"/home/user/Documents",content:`Notes
-----
- Test Piloti Files & Desktop VFS
`,updatedAt:s},{id:"/home/user/Downloads/readme.md",name:"readme.md",kind:"file",path:"/home/user/Downloads/readme.md",parentPath:"/home/user/Downloads",content:`# Downloads

Local browser VFS folder stored in localStorage.
`,updatedAt:s},{id:"/etc/issue",name:"issue",kind:"file",path:"/etc/issue",parentPath:"/etc",content:C,updatedAt:s},{id:"/home/user/.config/mimeapps.list",name:"mimeapps.list",kind:"file",path:"/home/user/.config/mimeapps.list",parentPath:"/home/user/.config",content:z,updatedAt:s}),t}function m(){if(typeof localStorage>"u")return W();try{const t=localStorage.getItem(v);if(!t){const e=W();return localStorage.setItem(v,JSON.stringify(e)),e}const n=JSON.parse(t);if(Array.isArray(n)){const e=n,r="piloti.web.vfs.welcome.v1";localStorage.getItem(r)||(localStorage.setItem(r,"1"),e.some(l=>l.path==="/home/user/Desktop/Welcome.html"||l.path===`${k}/Welcome.html`)||(e.push({id:"/home/user/Desktop/Welcome.html",name:"Welcome.html",kind:"file",path:"/home/user/Desktop/Welcome.html",parentPath:"/home/user/Desktop",content:T,updatedAt:Date.now()}),localStorage.setItem(v,JSON.stringify(e))));let a=!1;const o=Date.now();return e.some(i=>i.path==="/etc/issue")||(e.some(i=>i.path==="/etc")||e.push({id:"/etc",name:"etc",kind:"directory",path:"/etc",parentPath:"/",updatedAt:o}),e.push({id:"/etc/issue",name:"issue",kind:"file",path:"/etc/issue",parentPath:"/etc",content:C,updatedAt:o}),a=!0),e.some(i=>i.path==="/home/user/.config/mimeapps.list")||(e.some(i=>i.path==="/home/user/.config")||e.push({id:"/home/user/.config",name:".config",kind:"directory",path:"/home/user/.config",parentPath:"/home/user",updatedAt:o}),e.push({id:"/home/user/.config/mimeapps.list",name:"mimeapps.list",kind:"file",path:"/home/user/.config/mimeapps.list",parentPath:"/home/user/.config",content:z,updatedAt:o}),a=!0),a&&localStorage.setItem(v,JSON.stringify(e)),e}}catch{}const s=W();try{localStorage.setItem(v,JSON.stringify(s))}catch{}return s}function u(s){if(typeof localStorage<"u")try{localStorage.setItem(v,JSON.stringify(s))}catch{}typeof window<"u"&&window.dispatchEvent(new CustomEvent(S))}function w(s,t,n,e=""){const r=new Set(s.filter(i=>i.parentPath===t).map(i=>i.name.toLowerCase())),a=`${n}${e}`;if(!r.has(a.toLowerCase()))return a;let o=2;for(;r.has(`${n} ${o}${e}`.toLowerCase());)o+=1;return`${n} ${o}${e}`}function I(s,t){const n=p(s),e=m(),r=!!(t!=null&&t.includeHidden),a=e.filter(o=>o.parentPath===n&&(r||!o.name.startsWith(".")));return n==="/"&&!a.some(o=>o.path==="/home")&&a.unshift({id:"/home",name:"home",kind:"directory",path:"/home",parentPath:"/",updatedAt:0}),a}function O(s){const t=p(s),n=m().find(e=>e.path===t);if(n)return n;if(t==="/"||t==="/home")return{id:t,name:F(t),kind:"directory",path:t,parentPath:"/",updatedAt:0}}function M(s,t="New Folder"){const n=p(s),e=m(),r=w(e,n,t),a=`${n==="/"?"":n}/${r}`,o={id:a,name:r,kind:"directory",path:a,parentPath:n,updatedAt:Date.now()};return u([...e,o]),o}function U(s,t="Untitled",n=""){const e=p(s),r=m(),a=/\.[a-z0-9]+$/i.test(t),o=a?t.replace(/\.[a-z0-9]+$/i,""):t,i=a?t.slice(o.length):".txt",l=w(r,e,o,i),c=`${e==="/"?"":e}/${l}`,h={id:c,name:l,kind:"file",path:c,parentPath:e,content:n,updatedAt:Date.now()};return u([...r,h]),h}function st(s,t){const n=p(s),e=m(),r=e.find(o=>o.path===n);if(r){const o=e.map(i=>i.path===n?{...i,content:t,updatedAt:Date.now()}:i);return u(o),{...r,content:t,updatedAt:Date.now()}}const a={id:n,name:F(n),kind:"file",path:n,parentPath:E(n),content:t,updatedAt:Date.now()};return u([...e,a]),a}const _="piloti.web.vfs.emblems.v1",j="piloti.web.vfs.favorites.v1",at="piloti://favorites",rt="piloti://recents",ot={favorite:{label:"Favorite",colorClass:"text-rose-500",badgeBgClass:"bg-rose-500/90 text-white"},important:{label:"Important",colorClass:"text-amber-500",badgeBgClass:"bg-amber-500/90 text-white"},work:{label:"Work",colorClass:"text-sky-500",badgeBgClass:"bg-sky-500/90 text-white"},personal:{label:"Personal",colorClass:"text-emerald-500",badgeBgClass:"bg-emerald-500/90 text-white"}},J=new Set(["favorite","important","work","personal"]);function H(s){if(!Array.isArray(s))return[];const t=[];for(const n of s)typeof n=="string"&&J.has(n)&&!t.includes(n)&&t.push(n);return t}function D(){if(typeof localStorage>"u")return{};try{const s=localStorage.getItem(_);if(s){const n=JSON.parse(s);if(n&&typeof n=="object"&&!Array.isArray(n)){const e={};for(const[r,a]of Object.entries(n)){const o=H(a);o.length>0&&(e[p(r)]=o)}return e}}const t=localStorage.getItem(j);if(t){const n=JSON.parse(t);if(Array.isArray(n)){const e={};for(const r of n)typeof r=="string"&&(e[p(r)]=["favorite"]);return e}}}catch{}return{}}function R(s,t=!0){if(typeof localStorage<"u")try{const n={},e=[];for(const[r,a]of Object.entries(s))a.length>0&&(n[r]=a,a.includes("favorite")&&e.push(r));localStorage.setItem(_,JSON.stringify(n)),localStorage.setItem(j,JSON.stringify(e))}catch{}t&&typeof window<"u"&&window.dispatchEvent(new CustomEvent(S))}function $(s,t){const n=p(s),e=t?p(t):null,r=D();if(Object.keys(r).length===0)return;const a=`${n}/`,o={};let i=!1;for(const[l,c]of Object.entries(r))if(l===n)i=!0,e&&(o[e]=Array.from(new Set([...o[e]??[],...c])));else if(l.startsWith(a)){if(i=!0,e){const h=l.slice(a.length),d=`${e}/${h}`;o[d]=Array.from(new Set([...o[d]??[],...c]))}}else o[l]=c;i&&R(o,!1)}function G(s){const t=p(s);return D()[t]??[]}function q(s,t){return G(s).includes(t)}function K(s,t,n){const e=p(s),r=D(),a=r[e]??[],o=n?a.includes(t)?a:[...a,t]:a.filter(i=>i!==t);return o.length>0?r[e]=o:delete r[e],R(r,!0),o}function it(s,t){return K(s,t,!q(s,t))}function ct(s,t){const n=p(s),e=t.trim().replace(/[/\\]/g,"");if(!e)return null;const r=m(),a=r.find(c=>c.path===n);if(!a||a.name===e)return null;const o=`${a.parentPath==="/"?"":a.parentPath}/${e}`;if(r.some(c=>c.path===o))return null;const i=`${n}/`,l=r.map(c=>{if(c.path===n)return{...c,id:o,name:e,path:o,updatedAt:Date.now()};if(c.path.startsWith(i)){const h=c.path.slice(i.length),d=`${o}/${h}`;return{...c,id:d,path:d,parentPath:E(d)}}return c});return $(n,o),u(l),typeof window<"u"&&window.dispatchEvent(new CustomEvent("piloti:vfs-renamed",{detail:{oldPath:n,newPath:o}})),l.find(c=>c.path===o)??null}function dt(s){const t=p(s),n=m();if(!n.find(a=>a.path===t))return!1;const r=`${t}/`;return $(t,null),u(n.filter(a=>a.path!==t&&!a.path.startsWith(r))),!0}function X(s){const t=p(s),n=m(),e=n.find(d=>d.path===t);if(!e)return;const r=`${t}/`;if(e.parentPath===k||t.startsWith(`${k}/`)){$(t,null),u(n.filter(d=>d.path!==t&&!d.path.startsWith(r)));return}const a=e.kind==="file"&&/\.[a-z0-9]+$/i.test(e.name),o=a?e.name.replace(/\.[a-z0-9]+$/i,""):e.name,i=a?e.name.slice(o.length):"",l=w(n,k,o,i),c=`${k}/${l}`,h=n.map(d=>{if(d.path===t)return{...d,id:c,name:l,path:c,parentPath:k,trashedFromPath:d.path,updatedAt:Date.now()};if(d.path.startsWith(r)){const g=d.path.slice(r.length),f=`${c}/${g}`;return{...d,id:f,path:f,parentPath:E(f)}}return d});$(t,c),u(h)}function lt(s){const t=p(s),n=m(),e=n.find(b=>b.path===t);if(!e)return null;const r=e.trashedFromPath||`${y}/Desktop/${e.name}`;let a=E(r);n.some(b=>b.path===a&&b.kind==="directory")||(a=`${y}/Desktop`);const o=e.kind==="file"&&/\.[a-z0-9]+$/i.test(e.name),i=o?e.name.replace(/\.[a-z0-9]+$/i,""):e.name,l=o?e.name.slice(i.length):"",c=w(n,a,i,l),h=`${a==="/"?"":a}/${c}`,d=`${t}/`;let g=null;const f=n.map(b=>{if(b.path===t){const x={...b,id:h,name:c,path:h,parentPath:a,trashedFromPath:void 0,updatedAt:Date.now()};return g=x,x}if(b.path.startsWith(d)){const x=b.path.slice(d.length),V=`${h}/${x}`;return{...b,id:V,path:V,parentPath:E(V)}}return b});return $(t,h),u(f),g}function pt(){const s=m(),t=`${k}/`;for(const n of s)n.parentPath===k&&$(n.path,null);u(s.filter(n=>!n.path.startsWith(t)))}function ht(s,t){const n=p(s),e=p(t);if(n===e||e.startsWith(`${n}/`))return null;const r=m(),a=r.find(f=>f.path===n);if(!a||a.parentPath===e)return null;if(e===k)return X(n),null;const o=a.kind==="file"&&/\.[a-z0-9]+$/i.test(a.name),i=o?a.name.replace(/\.[a-z0-9]+$/i,""):a.name,l=o?a.name.slice(i.length):"",c=w(r,e,i,l),h=`${e==="/"?"":e}/${c}`,d=`${n}/`,g=r.map(f=>{if(f.path===n)return{...f,id:h,name:c,path:h,parentPath:e,updatedAt:Date.now()};if(f.path.startsWith(d)){const b=f.path.slice(d.length),x=`${h}/${b}`;return{...f,id:x,path:x,parentPath:E(x)}}return f});return $(n,h),u(g),g.find(f=>f.path===h)??null}function ft(s){if(typeof window>"u")return()=>{};const t=n=>{(n.key===v||n.key===_||n.key===j)&&s()};return window.addEventListener(S,s),window.addEventListener("storage",t),()=>{window.removeEventListener(S,s),window.removeEventListener("storage",t)}}function P(s){return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function mt(s){const t=s.name.toLowerCase(),n=s.content??"";if(/\.(html|htm)$/.test(t))return URL.createObjectURL(new Blob([n],{type:"text/html;charset=utf-8"}));if(/\.svg$/.test(t))return URL.createObjectURL(new Blob([n],{type:"image/svg+xml;charset=utf-8"}));if(/\.(png|jpe?g|gif|webp|bmp|ico|avif)$/.test(t)){const e=n.trim();if(/^(data:image\/|blob:|https?:\/\/)/i.test(e)){const r=`<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#141414"><img src="${P(e)}" alt="${P(s.name)}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`;return URL.createObjectURL(new Blob([r],{type:"text/html;charset=utf-8"}))}}if(/\.(mp4|webm|ogg|mov)$/.test(t)){const e=n.trim();if(/^(data:|blob:|https?:\/\/)/i.test(e)){const r=`<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000"><video controls autoplay src="${P(e)}" style="max-width:100%;max-height:100vh"></video></body></html>`;return URL.createObjectURL(new Blob([r],{type:"text/html;charset=utf-8"}))}}if(/\.(mp3|wav|flac|m4a)$/.test(t)){const e=n.trim();if(/^(data:|blob:|https?:\/\/)/i.test(e)){const r=`<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#181818;color:#fff;font-family:system-ui"><audio controls autoplay src="${P(e)}"></audio></body></html>`;return URL.createObjectURL(new Blob([r],{type:"text/html;charset=utf-8"}))}}if(/\.pdf$/.test(t)){const e=n.trim();if(/^(data:application\/pdf|blob:|https?:\/\/)/i.test(e))return e}return URL.createObjectURL(new Blob([n],{type:"text/plain;charset=utf-8"}))}const Y=/\.(txt|md|markdown|json|css|scss|less|js|mjs|cjs|ts|tsx|jsx|xml|csv|tsv|ya?ml|toml|ini|conf|cfg|log|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|sql)$/i;function ut(s){const t=s.toLowerCase();return/\.(html?|svg|png|jpe?g|gif|webp|bmp|ico|avif|mp4|webm|mkv|mov|avi|m4v|mp3|wav|flac|m4a|ogg|aac|pdf|zip|tar|gz|bz2|xz|7z|rar)$/i.test(t)?!1:Y.test(t)||!/\.[a-z0-9]+$/i.test(t)}const Q=/\.(txt|md|markdown|json|html?|css|scss|less|js|mjs|cjs|ts|tsx|jsx|svg|xml|csv|tsv|ya?ml|toml|ini|conf|cfg|log|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|sql)$/i;function Z(s){return new Promise((t,n)=>{const e=new FileReader;e.onload=()=>t(typeof e.result=="string"?e.result:""),e.onerror=()=>n(e.error??new Error("Failed to read file")),e.readAsDataURL(s)})}async function gt(s,t){const n=Array.from(t);if(n.length===0)return[];const e=p(s),r=[];for(const a of n){const o=a.name||"Imported",l=a.type.startsWith("text/")||a.type==="application/json"||a.type==="application/xml"||a.type==="image/svg+xml"||Q.test(o)?await a.text():await Z(a);r.push(U(e,o,l))}return r}function tt(){const s=D();return Object.entries(s).filter(([,t])=>t.includes("favorite")).map(([t])=>t)}function bt(){const s=new Set(tt());return m().filter(t=>s.has(t.path))}function kt(s=30){return m().filter(t=>t.kind==="file"&&!t.path.startsWith("/home/user/.local/")&&t.updatedAt>0).sort((t,n)=>n.updatedAt-t.updatedAt).slice(0,s)}function B(s,t){const n=p(s),e=p(t),r=O(n);if(!r)return null;if(r.kind==="file"){const i=m(),l=/\.[a-z0-9]+$/i.test(r.name),c=l?r.name.replace(/\.[a-z0-9]+$/i,""):r.name,h=l?r.name.slice(c.length):"",d=w(i,e,c,h),g=`${e==="/"?"":e}/${d}`,f={id:g,name:d,kind:"file",path:g,parentPath:e,content:r.content??"",updatedAt:Date.now()};return u([...i,f]),f}if(e===n||e.startsWith(`${n}/`))return null;const a=M(e,r.name),o=I(r.path);for(const i of o)B(i.path,a.path);return a}function xt(s){const t=p(s),n=O(t);if(!n)return null;const e=n.parentPath,r=m();if(n.kind==="file"){const l=/\.[a-z0-9]+$/i.test(n.name),c=l?n.name.replace(/\.[a-z0-9]+$/i,""):n.name,h=l?n.name.slice(c.length):"",d=w(r,e,`${c} Copy`,h),g=`${e==="/"?"":e}/${d}`,f={id:g,name:d,kind:"file",path:g,parentPath:e,content:n.content??"",updatedAt:Date.now()};return u([...r,f]),f}const a=w(r,e,`${n.name} Copy`),o=`${e==="/"?"":e}/${a}`,i={id:o,name:a,kind:"directory",path:o,parentPath:e,updatedAt:Date.now()};u([...r,i]);for(const l of I(n.path))B(l.path,i.path);return i}const L="piloti:vfs-clipboard-changed";let A=null;function wt(){return A?{mode:A.mode,paths:[...A.paths]}:null}function vt(s){A=s&&s.paths.length>0?{mode:s.mode,paths:Array.from(new Set(s.paths.map(n=>p(n))))}:null,typeof window<"u"&&window.dispatchEvent(new CustomEvent(L))}function yt(s){return typeof window>"u"?()=>{}:(window.addEventListener(L,s),()=>{window.removeEventListener(L,s)})}const et=/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;function Et(s,t){return et.test(s)?!0:!!(t&&t.startsWith("data:image/"))}function $t(s,t){if(t){if(t.startsWith("data:image/"))return t;if(s.toLowerCase().endsWith(".svg")&&t.includes("<svg"))return`data:image/svg+xml;utf8,${encodeURIComponent(t)}`}}export{gt as A,B,v as C,z as D,at as E,bt as F,rt as G,kt as H,nt as I,ot as V,y as W,k as a,lt as b,M as c,U as d,pt as e,dt as f,O as g,S as h,mt as i,D as j,$t as k,I as l,ht as m,p as n,wt as o,yt as p,Et as q,ct as r,ft as s,X as t,ut as u,xt as v,st as w,it as x,G as y,vt as z};
