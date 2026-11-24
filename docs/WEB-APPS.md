# Web Apps & PWAs for Domicile Windows

Curated list of standalone web apps and Progressive Web Apps (PWAs) suited for running in Domicile windows (`domicile.browser.openApp(url, { id, reuse })` or `domicile.browser.open(url)`, or via Piloti's Command Palette with `Alt+Space`).

Apps are grouped with **iframe-friendly** entries first so the web/iframe version of Piloti can render them directly without cross-origin framing errors (`X-Frame-Options` / `CSP frame-ancestors`), followed by apps that work only in Domicile's native `<webview>` windows.

---

## Iframe-Friendly (Works in Web Version & Domicile)

All entries below are verified to have no `X-Frame-Options: DENY/SAMEORIGIN` header and no restrictive `frame-ancestors` CSP policy *(except CryptPad, which requires an `https:` parent origin in iframe mode)*.

### Graphics & 3D

- **[Excalidraw](https://excalidraw.com/)** — Hand-drawn virtual whiteboard with local storage, SVG/PNG export, and offline PWA support *(PWA · No login)*
- **[tldraw](https://tldraw.com/)** — Infinite-canvas drawing, diagramming, and wireframing app *(No login)*
- **[Diagrams.net (Embed)](https://embed.diagrams.net/)** — Full Draw.io flowchart, UML, architecture, and network diagram editor *(No login)*
- **[Mermaid Live Editor](https://mermaid.live/)** — Live text-to-diagram editor for flowcharts, sequence, Gantt, and ER diagrams *(No login)*
- **[Photopea](https://www.photopea.com/)** — Full raster and vector editor supporting PSD, XCF, Sketch, and Figma files *(PWA · No login)*
- **[JS Paint](https://jspaint.app/)** — Modern web recreation of classic MS Paint *(PWA · No login)*
- **[Sketchpad](https://sketch.io/sketchpad/)** — Digital drawing, painting, and vector illustration studio *(No login)*
- **[Draw.chat](https://draw.chat/)** — Collaborative whiteboard and image/PDF annotation *(No login)*
- **[WBO (Whitebophir)](https://wbo.ophir.dev/)** — Lightweight real-time collaborative vector whiteboard *(No login)*
- **[Squoosh](https://squoosh.app/)** — Local client-side image compression and codec comparison (WebP, AVIF, MozJPEG) *(PWA · No login)*
- **[SVGOMG](https://svgomg.net/)** — Visual SVGO frontend for cleaning and optimizing SVG assets *(PWA · No login)*
- **[Three.js Editor](https://threejs.org/editor/)** — Interactive 3D scene, geometry, material, and lighting editor *(No login)*
- **[SculptGL](https://stephaneginier.com/sculptgl/)** — WebGL 3D digital sculpting studio *(No login)*

### Utilities & Math

- **[Calculator](https://notse.github.io/Calculator/)** — Minimalist calculator utility *(No login)*
- **[Desmos Graphing Calculator](https://www.desmos.com/calculator)** — Interactive graphing calculator and function plotter *(PWA · No login)*
- **[GeoGebra Classic](https://www.geogebra.org/classic)** — Geometry, algebra, spreadsheets, calculus, and 3D math suite *(No login)*
- **[PairDrop](https://pairdrop.net/)** — Cross-platform local-network WebRTC file and text sharing *(PWA · No login · `X-Frame-Options: ALLOW`)*
- **[CyberChef](https://gchq.github.io/CyberChef/)** — Client-side encoding, hashing, encryption, compression, and data analysis toolkit *(No login)*
- **[Pomofocus](https://pomofocus.io/)** — Minimalist Pomodoro focus timer and task list *(No login)*
- **[Time.is](https://time.is/)** — Atomic-precision clock and timezone reference *(No login)*

### Developer Tools

- **[DevDocs](https://devdocs.io/)** — Unified, searchable offline API documentation reader across languages and frameworks *(PWA · No login)*
- **[IT-Tools](https://it-tools.tech/)** — 70+ local developer utilities (JWT, UUID, hash, Base64, diff, crontab, regex, color) *(PWA · No login)*
- **[Transform Tools](https://transform.tools/)** — Code/schema converter (JSON ↔ TypeScript/Zod/GraphQL, SVG → JSX, CSS → Tailwind) *(PWA · No login)*
- **[JSON Crack](https://jsoncrack.com/editor)** — Interactive graph and tree visualizer for JSON, YAML, XML, and CSV *(No login)*
- **[SQLite Viewer](https://sqliteviewer.app/)** — Local `.sqlite`/`.db` file inspector via File System Access / Wasm *(No login)*
- **[Omatsuri](https://omatsuri.app/)** — Open-source frontend generators (CSS shapes, SVG waves, color converters) *(PWA · No login)*
- **[Strudel REPL](https://strudel.cc/)** — Browser live-coding algorithmic music and pattern REPL *(No login)*

### Productivity & Writing

- **[StackEdit](https://stackedit.io/)** — Open-source Markdown editor with live HTML/LaTeX preview and local storage *(PWA · No login)*
- **[Dillinger](https://dillinger.io/)** — Clean split-pane Markdown editor with HTML/PDF export *(No login)*
- **[CryptPad](https://cryptpad.fr/)** — End-to-end encrypted collaborative docs, sheets, slides, whiteboard, and kanban *(No login · `frame-ancestors https:`, requires HTTPS parent host in iframe)*

### Audio & Media

- **[AudioMass](https://audiomass.co/)** — Browser waveform audio editor (trim, normalize, EQ, effects) *(No login)*
- **[Chrome Music Lab](https://musiclab.chromeexperiments.com/)** — Interactive Web Audio experiments (Song Maker, Rhythm, Spectrogram) *(No login)*
- **[A Soft Murmur](https://asoftmurmur.com/)** — Ambient soundscape mixer for focus (rain, thunder, waves, wind) *(No login)*
- **[Radio Garden](https://radio.garden/)** — Interactive 3D globe for streaming live radio stations worldwide *(No login)*
- **[BitMidi](https://bitmidi.com/)** — Lightweight PWA player for classic MIDI tracks *(PWA · No login)*

### Maps, Weather & Astronomy

- **[Earth Nullschool](https://earth.nullschool.net/)** — Real-time animated 3D global wind, weather, and ocean currents map *(No login)*
- **[Ventusky](https://www.ventusky.com/)** — Interactive global weather, precipitation, radar, and temperature map *(No login)*
- **[Stellarium Web](https://stellarium-web.org/)** — Real-time 3D browser planetarium and star map *(No login)*

### Communication & Creation

- **[Jitsi Meet](https://meet.jit.si/)** — Instant open-source WebRTC video conferencing *(No login)*
- **[VDO.Ninja](https://vdo.ninja/)** — Low-latency WebRTC audio/video room and camera routing tool *(No login)*
- **[GDevelop Editor](https://editor.gdevelop.io/)** — Full browser 2D/3D visual game engine and scene editor *(No login to build/preview)*

---

## Native Domicile `<webview>` Only (Blocked in `<iframe>`)

These apps enforce `X-Frame-Options` (`DENY`/`SAMEORIGIN`) or restrictive `CSP frame-ancestors` headers, so they require native Domicile `<webview>` windows rather than web-version `<iframe>` windows:

- [Diagrams.net (app.diagrams.net)](https://app.diagrams.net/) — `frame-ancestors` restricted to Teams/SharePoint *(use `embed.diagrams.net` above for iframe)*
- [Kleki](https://kleki.com/) — Painting studio *(PWA · No login · `frame-ancestors 'self'`)*
- [Piskel](https://www.piskelapp.com/) — Pixel art and animated sprite sheet editor *(No login · `frame-ancestors 'none'`)*
- [VS Code for the Web](https://vscode.dev/) — Browser Visual Studio Code *(No login · `frame-ancestors 'none'`)*
- [Hoppscotch](https://hoppscotch.io/) — REST/GraphQL/WebSocket API client *(PWA · No login · `frame-ancestors 'self'`)*
- [Regex101](https://regex101.com/) — Regular expression tester and debugger *(PWA · No login · `X-Frame-Options: SAMEORIGIN`)*
- [StackBlitz](https://stackblitz.com/) — WebContainers Node.js/Vite IDE *(No login · `SAMEORIGIN` / `frame-ancestors 'self'`)*
- [CodePen](https://codepen.io/) — Live HTML/CSS/JS playground *(No login · `X-Frame-Options: SAMEORIGIN`)*
- [Wavacity](https://wavacity.com/) — WebAssembly Audacity port *(No login · `DENY` / `frame-ancestors 'none'`)*
- [Ableton Learning Music](https://learningmusic.ableton.com/) — Interactive music-making lessons *(No login · `X-Frame-Options: SAMEORIGIN`)*
- [Ableton Learning Synths](https://learningsynths.ableton.com/) — Interactive synthesizer playground *(No login · `frame-ancestors 'self'`)*
- [YouTube Music](https://music.youtube.com/) — Standalone music streaming player *(PWA · Account optional · `X-Frame-Options: SAMEORIGIN`)*
- [Spotify Web Player](https://open.spotify.com/) — Standalone music & podcast player *(PWA · Account required · `frame-ancestors` allowlist)*
- [OpenStreetMap](https://www.openstreetmap.org/) — Open collaborative world map *(No login · `SAMEORIGIN` / `frame-ancestors 'self'`)*
- [Windy](https://windy.com/) — Global weather, radar & wind layers *(PWA · No login · `frame-ancestors 'self' *.windy.com`)*
- [Lichess](https://lichess.org/) — Free chess platform *(PWA · No login required · `X-Frame-Options: DENY`)*
- [DOS.Zone](https://dos.zone/) — Browser MS-DOS emulator & game archive *(No login · `frame-ancestors` allowlist)*
- [Construct 3 Editor](https://editor.construct.net/) — 2D game engine *(No login for free tier · `frame-ancestors 'none'`)*

---

## Testing in Domicile

From the Piloti Console (`domicile.browser`) or a launcher script:

```ts
import { AppReuse } from "@domicile-desktop/sdk/desktop/browser";

// Open in an isolated standalone app window (no browser chrome)
domicile.browser.openApp("https://excalidraw.com/", {
  id: "excalidraw",
  reuse: AppReuse.Focus,
});
```

Or open interactively with `Alt+Space` → type any `https://...` URL and press `Enter`.
