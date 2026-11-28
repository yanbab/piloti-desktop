// Piloti Showcase Plugin — demonstrates the plugin context (`ctx`) and `ctx.piloti`
export function activate(ctx) {
  let notesCount = Number(ctx.storage.get("focusCount") ?? 0);

  // 1. Menubar Status Item with persisted click counter & notification
  const status = ctx.menubar.addStatusItem({
    id: "focus-counter",
    label: `✦ ${notesCount}`,
    tooltip: "Piloti Showcase Plugin — click to increment focus check-in",
    onClick() {
      notesCount += 1;
      ctx.storage.set("focusCount", notesCount);
      status.update({ label: `✦ ${notesCount}` });
      ctx.notify({
        summary: "Showcase Check-in",
        body: `Recorded ${notesCount} focus session(s).`,
      });
    },
  });

  // 2. Programmatic CSS Animated Wallpaper registration
  ctx.wallpapers.register({
    id: "showcase-teal-pulse",
    name: "Teal Pulse (JS Plugin)",
    subtitle: "Programmatic CSS animated wallpaper",
    kind: "css",
    backgroundCss: "linear-gradient(160deg, #07131a 0%, #0d2b36 100%)",
    cssAnimation: `
      @keyframes piloti-showcase-pulse {
        0%, 100% { transform: scale(1) translate3d(0, 0, 0); opacity: 0.72; }
        50% { transform: scale(1.08) translate3d(2%, -2%, 0); opacity: 1; }
      }
      .piloti-wp-anim {
        background:
          radial-gradient(65% 60% at 30% 35%, rgba(33, 144, 164, 0.45) 0%, transparent 65%),
          radial-gradient(60% 55% at 75% 75%, rgba(53, 132, 228, 0.35) 0%, transparent 70%),
          linear-gradient(170deg, #050b14 0%, #091c28 100%);
        animation: piloti-showcase-pulse 16s ease-in-out infinite;
      }
    `,
  });

  // 3. Custom Launcher Search Provider
  ctx.launcher.registerProvider({
    id: "showcase-tools",
    search(query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const items = [
        {
          id: "inc",
          title: `Showcase: Check-in (${notesCount})`,
          subtitle: "Increment showcase counter and notify",
          keywords: "showcase check-in focus counter plugin",
        },
        {
          id: "files",
          title: "Showcase: Browse Plugins Folder",
          subtitle: "~/.config/piloti/plugins",
          keywords: "showcase plugins folder browse",
        },
      ];
      return items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.keywords.toLowerCase().includes(q)
      );
    },
    onSelect(item) {
      if (item.id === "inc") {
        notesCount += 1;
        ctx.storage.set("focusCount", notesCount);
        status.update({ label: `✦ ${notesCount}` });
        ctx.notify({
          summary: "Showcase Check-in",
          body: `Total check-ins: ${notesCount}`,
        });
      } else if (item.id === "files") {
        ctx.piloti.desktop.apps.launch("nautilus");
      }
    },
  });

  // 4. Command Palette Entry
  ctx.commands.register({
    id: "reset-counter",
    title: "Showcase: Reset Check-in Counter",
    keywords: "showcase reset counter plugin",
    run() {
      notesCount = 0;
      ctx.storage.set("focusCount", 0);
      status.update({ label: "✦ 0" });
      ctx.notify({
        summary: "Showcase Reset",
        body: "Focus check-in counter reset to 0.",
      });
    },
  });

  // 5. Periodic subtle clock/heartbeat timer cleaned up automatically
  const timer = setInterval(() => {
    status.update({
      tooltip: `Piloti Showcase (${notesCount} check-ins) · ${new Date().toLocaleTimeString()}`,
    });
  }, 60_000);

  ctx.onCleanup(() => {
    clearInterval(timer);
  });
}

export function deactivate() {
  // Optional teardown hook when disabled or reloaded
}

