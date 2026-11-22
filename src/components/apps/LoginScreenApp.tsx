import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BatteryChargingIcon,
  BatteryIcon,
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  KeyboardIcon,
  Loader2Icon,
  LockIcon,
  MonitorIcon,
  PowerIcon,
  UserIcon,
  UserPlusIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { DesktopBackgroundLayers } from "@/components/shell/DesktopBackgroundLayers";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WindowControls } from "@/components/ui/window";
import {
  useSettings,
  useSystemBackends,
} from "@/context/DesktopStateContext";
import {
  authenticateAndStartGreetdSession,
  computeUserInitials,
  detectGreeterRuntime,
  discoverGreeterSessions,
  discoverGreeterUsers,
  finishGreetdGreeter,
  runGreeterPowerAction,
  switchGreeterKeymap,
  type GreeterSessionOption,
  type GreeterUserAccount,
} from "@/lib/engine-desktop";
import { _, getLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { readVfsStateJson, writeVfsStateJson } from "@/lib/vfs-state";

export interface LoginScreenAppProps {
  windowId?: string;
  isCsd?: boolean;
  /**
   * `"greeter"` runs fullscreen as a Display Manager replacement (e.g. under `greetd`),
   * authenticating via `GREETD_SOCK` and using real `systemctl` power controls.
   * `"preview"` renders inside an active desktop window (auto-upgrades to live DM
   * behavior if `GREETD_SOCK` is present).
   */
  mode?: "preview" | "greeter";
}

interface SavedGreeterState {
  lastLoggedUserId: string;
  keyboardLayout: string;
  sessionId: string;
}

const GREETER_STATE_PATH = "/home/user/.config/piloti/login-screen.json";

const DEMO_GREETER_USERS: readonly GreeterUserAccount[] = [
  {
    id: "user",
    name: "Piloti User",
    username: "user",
    role: "Administrator",
    initials: "PU",
    gradient: "from-teal-400 via-cyan-500 to-sky-600",
  },
  {
    id: "alex",
    name: "Alex Martin",
    username: "alex",
    role: "Developer",
    initials: "AM",
    gradient: "from-indigo-400 via-blue-500 to-violet-600",
  },
  {
    id: "guest",
    name: "Guest Session",
    username: "guest",
    role: "Standard",
    initials: "GS",
    gradient: "from-amber-400 via-orange-500 to-rose-600",
    isGuest: true,
  },
];

const KEYBOARD_LAYOUTS: ReadonlyArray<{ id: string; short: string; label: string }> = [
  { id: "us", short: "en", label: "English (US)" },
  { id: "fr", short: "fr", label: "Français (AZERTY)" },
  { id: "es", short: "es", label: "Español" },
  { id: "de", short: "de", label: "Deutsch (QWERTZ)" },
];

const DEMO_SESSION_OPTIONS: readonly GreeterSessionOption[] = [
  {
    id: "wayland:piloti",
    label: "Piloti Desktop",
    subtitle: "Domicile Wayland session",
    exec: "/usr/bin/piloti-session",
    sessionType: "wayland",
    desktopNames: "Piloti;GNOME;",
  },
  {
    id: "wayland:gnome",
    label: "GNOME",
    subtitle: "GNOME Shell Wayland",
    exec: "gnome-session",
    sessionType: "wayland",
    desktopNames: "GNOME;",
  },
  {
    id: "wayland:weston",
    label: "Weston",
    subtitle: "Reference Wayland compositor",
    exec: "weston",
    sessionType: "wayland",
  },
];

function loadGreeterState(): SavedGreeterState {
  const saved = readVfsStateJson<Partial<SavedGreeterState>>(
    GREETER_STATE_PATH,
    "piloti.login-screen.state.v1",
  );
  const validKb = KEYBOARD_LAYOUTS.some((k) => k.id === saved?.keyboardLayout)
    ? (saved!.keyboardLayout as string)
    : getLocale() === "fr"
      ? "fr"
      : getLocale() === "es"
        ? "es"
        : "us";
  return {
    lastLoggedUserId:
      typeof saved?.lastLoggedUserId === "string" && saved.lastLoggedUserId
        ? saved.lastLoggedUserId
        : DEMO_GREETER_USERS[0].id,
    keyboardLayout: validKb,
    sessionId:
      typeof saved?.sessionId === "string" && saved.sessionId
        ? saved.sessionId
        : DEMO_SESSION_OPTIONS[0].id,
  };
}

export const LoginScreenApp: React.FC<LoginScreenAppProps> = ({
  windowId,
  isCsd = true,
  mode = "preview",
}) => {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings } = useSettings();
  const { batteryInfo, pushNotification } = useSystemBackends();

  const initialState = React.useMemo(() => loadGreeterState(), []);
  const [users, setUsers] = React.useState<readonly GreeterUserAccount[]>(
    DEMO_GREETER_USERS,
  );
  const [sessions, setSessions] = React.useState<readonly GreeterSessionOption[]>(
    DEMO_SESSION_OPTIONS,
  );
  const [greetdAvailable, setGreetdAvailable] = React.useState(false);
  const [hostname, setHostname] = React.useState<string | null>(null);

  const isLiveDm = mode === "greeter" || greetdAvailable;
  const showWindowChrome = !isLiveDm && isCsd && Boolean(windowId);

  const [lastLoggedUserId, setLastLoggedUserId] = React.useState(
    initialState.lastLoggedUserId,
  );
  const [selectedUserId, setSelectedUserId] = React.useState(
    initialState.lastLoggedUserId,
  );
  const [manualUsername, setManualUsername] = React.useState("");
  const [view, setView] = React.useState<
    "password" | "users" | "other-user" | "authenticated"
  >("password");
  const [keyboardLayout, setKeyboardLayout] = React.useState(
    initialState.keyboardLayout,
  );
  const [sessionId, setSessionId] = React.useState(initialState.sessionId);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [authenticating, setAuthenticating] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [shakeTick, setShakeTick] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());

  const passwordInputRef = React.useRef<HTMLInputElement | null>(null);
  const usernameInputRef = React.useRef<HTMLInputElement | null>(null);

  // Discover real Linux accounts (/etc/passwd), Wayland/X11 sessions, and GREETD_SOCK
  React.useEffect(() => {
    if (isBrowserRuntime) return;
    let active = true;
    void Promise.all([
      detectGreeterRuntime(domicile),
      discoverGreeterUsers(domicile),
      discoverGreeterSessions(domicile),
    ])
      .then(([runtime, realUsers, realSessions]) => {
        if (!active) return;
        setGreetdAvailable(runtime.greetdAvailable);
        setHostname(runtime.hostname);
        if (runtime.defaultKeymap) {
          setKeyboardLayout(runtime.defaultKeymap);
        }

        if (realUsers.length > 0) {
          setUsers(realUsers);
          setSelectedUserId((prev) =>
            realUsers.some((u) => u.id === prev) ? prev : realUsers[0].id,
          );
          setLastLoggedUserId((prev) =>
            realUsers.some((u) => u.id === prev) ? prev : realUsers[0].id,
          );
        }
        if (realSessions.length > 0) {
          setSessions(realSessions);
          setSessionId((prev) =>
            realSessions.some((s) => s.id === prev) ? prev : realSessions[0].id,
          );
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [domicile, isBrowserRuntime]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    try {
      writeVfsStateJson(GREETER_STATE_PATH, {
        lastLoggedUserId,
        keyboardLayout,
        sessionId,
      } satisfies SavedGreeterState);
    } catch {
      // ignore storage errors
    }
  }, [keyboardLayout, lastLoggedUserId, sessionId]);

  React.useEffect(() => {
    if (view === "password") {
      const raf = requestAnimationFrame(() => passwordInputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    if (view === "other-user") {
      const raf = requestAnimationFrame(() => usernameInputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [selectedUserId, view]);

  const selectedUser: GreeterUserAccount = React.useMemo(() => {
    const found = users.find((u) => u.id === selectedUserId);
    if (found) return found;
    if (manualUsername.trim()) {
      const clean = manualUsername.trim();
      return {
        id: clean,
        name: clean,
        username: clean,
        role: "Account",
        initials: computeUserInitials(clean, clean),
        gradient: "from-sky-400 via-blue-500 to-indigo-600",
      };
    }
    return users[0] ?? DEMO_GREETER_USERS[0];
  }, [manualUsername, selectedUserId, users]);

  const keyboardLayouts = React.useMemo(() => {
    if (KEYBOARD_LAYOUTS.some((k) => k.id === keyboardLayout)) {
      return KEYBOARD_LAYOUTS;
    }
    return [
      {
        id: keyboardLayout,
        short: keyboardLayout.slice(0, 2).toLowerCase(),
        label: keyboardLayout.toUpperCase(),
      },
      ...KEYBOARD_LAYOUTS,
    ];
  }, [keyboardLayout]);

  const activeKeyboard =
    keyboardLayouts.find((k) => k.id === keyboardLayout) ?? keyboardLayouts[0];
  const activeSession =
    sessions.find((s) => s.id === sessionId) ??
    sessions[0] ??
    DEMO_SESSION_OPTIONS[0];

  const localeTag =
    getLocale() === "fr" ? "fr-FR" : getLocale() === "es" ? "es-ES" : "en-US";
  const formattedClock = React.useMemo(() => {
    const datePart = now.toLocaleDateString(localeTag, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timePart = now.toLocaleTimeString(localeTag, {
      hour12: !settings.clock24Hour,
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart}  ${timePart}`;
  }, [localeTag, now, settings.clock24Hour]);

  const triggerBadPassword = (message?: string) => {
    setAuthError(message || _("Authentication failed. Please try again."));
    setShakeTick((n) => n + 1);
    setPassword("");
    requestAnimationFrame(() => passwordInputRef.current?.focus());
  };

  const handleKeyboardChange = (nextLayout: string) => {
    setKeyboardLayout(nextLayout);
    if (!isBrowserRuntime) {
      void switchGreeterKeymap(domicile, nextLayout);
    }
  };

  const handlePowerAction = async (action: "suspend" | "reboot" | "poweroff") => {
    if (!isBrowserRuntime && isLiveDm) {
      const ok = await runGreeterPowerAction(domicile, action);
      if (!ok) {
        setAuthError(_("Unable to execute system power action."));
      }
      return;
    }
    const labels = {
      suspend: {
        summary: _("Suspend"),
        body: _("Greeter preview: system suspend requested."),
      },
      reboot: {
        summary: _("Restart"),
        body: _("Greeter preview: system restart requested."),
      },
      poweroff: {
        summary: _("Power Off"),
        body: _("Greeter preview: system power-off requested."),
      },
    }[action];
    pushNotification({
      appName: _("Login Screen"),
      summary: labels.summary,
      body: labels.body,
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authenticating) return;

    // Live Display Manager authentication over greetd IPC (GREETD_SOCK)
    if (!isBrowserRuntime && greetdAvailable) {
      setAuthenticating(true);
      setAuthError(null);
      const res = await authenticateAndStartGreetdSession(domicile, {
        username: selectedUser.username,
        password,
        session: activeSession,
      });
      setAuthenticating(false);
      if (!res.ok) {
        triggerBadPassword(res.error);
        return;
      }
      setPassword("");
      setLastLoggedUserId(selectedUser.id);
      setView("authenticated");
      // Per greetd-ipc(7), the user session starts once the greeter exits.
      window.setTimeout(() => {
        void finishGreetdGreeter(domicile);
      }, 120);
      return;
    }

    // Preview / Browser Dev Mode fallback authentication
    const isGuest = Boolean(selectedUser.isGuest || selectedUser.id === "guest");
    const trimmed = password.trim();
    const isValid =
      isGuest ||
      trimmed === "piloti" ||
      trimmed === selectedUser.username ||
      trimmed === "1234";

    if (!isValid) {
      triggerBadPassword();
      return;
    }

    setAuthError(null);
    setPassword("");
    setLastLoggedUserId(selectedUser.id);
    setView("authenticated");
  };

  const handleSelectUser = (userId: string) => {
    setManualUsername("");
    setSelectedUserId(userId);
    setAuthError(null);
    setPassword("");
    setView("password");
  };

  const handleSubmitOtherUser = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualUsername.trim();
    if (!clean) return;
    setSelectedUserId(clean);
    setAuthError(null);
    setPassword("");
    setView("password");
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-adw-window text-white select-none">
      <style>{`
        @keyframes piloti-gdm-shake {
          0%, 100% { transform: translate3d(0, 0, 0); }
          16% { transform: translate3d(-11px, 0, 0); }
          33% { transform: translate3d(10px, 0, 0); }
          50% { transform: translate3d(-8px, 0, 0); }
          66% { transform: translate3d(6px, 0, 0); }
          83% { transform: translate3d(-3px, 0, 0); }
        }
      `}</style>

      {/* Desktop Wallpaper + Soft GDM Blur Veil */}
      <DesktopBackgroundLayers />
      <div className="pointer-events-none absolute inset-0 bg-black/32 backdrop-blur-lg" />

      {/* Top Greeter Menu Bar (same material & height as Piloti Desktop MenuBar) */}
      <header
        data-window-drag-region={showWindowChrome ? "" : undefined}
        className="relative z-20 flex h-[30px] w-full shrink-0 items-center justify-between gap-2 px-2 text-adw-body text-adw-label adw-material-hud dark:text-white"
      >
        {/* Left: Window menu (preview only), Session & Keyboard selectors */}
        <div className="flex items-center gap-1" data-window-no-drag>
          {showWindowChrome && windowId && (
            <>
              <WindowControls side="left" />
              <WindowMenuButton
                side="left"
                windowId={windowId}
                appId="login-screen"
                iconName="lock"
              />
            </>
          )}

          {/* Session Picker (GDM gear/monitor selector) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={_("Session")}
              className="flex h-[24px] items-center gap-1.5 rounded-md px-2 text-[12px] font-medium outline-none transition-colors hover:bg-black/8 active:bg-black/14 data-popup-open:bg-black/12 dark:hover:bg-white/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15"
            >
              <MonitorIcon className="size-3.5 opacity-85" />
              <span className="max-w-[160px] truncate">
                {_(activeSession.label)}
              </span>
              <ChevronDownIcon className="size-3 opacity-65" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>{_("Desktop Session")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sessionId}
                onValueChange={(val) => setSessionId(val)}
              >
                {sessions.map((sess) => (
                  <DropdownMenuRadioItem key={sess.id} value={sess.id}>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{_(sess.label)}</span>
                      <span className="truncate text-[11px] text-adw-label-secondary">
                        {_(sess.subtitle)}
                      </span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Keyboard Layout Picker */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={_("Keyboard Layout")}
              className="flex h-[24px] items-center gap-1 rounded-md px-2 text-[12px] font-medium uppercase outline-none transition-colors hover:bg-black/8 active:bg-black/14 data-popup-open:bg-black/12 dark:hover:bg-white/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15"
            >
              <KeyboardIcon className="size-3.5 opacity-85" />
              <span>{activeKeyboard.short}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>{_("Keyboard Layout")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={keyboardLayout}
                onValueChange={handleKeyboardChange}
              >
                {keyboardLayouts.map((kb) => (
                  <DropdownMenuRadioItem key={kb.id} value={kb.id}>
                    {kb.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center: Live Clock */}
        <div className="pointer-events-none truncate text-[12.5px] font-medium tracking-tight tabular-nums">
          {formattedClock}
        </div>

        {/* Right: System Status, Power Menu & Window Controls */}
        <div className="flex items-center gap-1.5" data-window-no-drag>
          <span className="flex items-center gap-1.5 px-1 text-adw-label/85 dark:text-white/85">
            {settings.wifiEnabled ? (
              <WifiIcon className="size-3.5" />
            ) : (
              <WifiOffIcon className="size-3.5 opacity-50" />
            )}
            {settings.muted || settings.volume === 0 ? (
              <VolumeXIcon className="size-3.5 opacity-60" />
            ) : (
              <Volume2Icon className="size-3.5" />
            )}
            {batteryInfo.present &&
              (batteryInfo.charging ? (
                <BatteryChargingIcon className="size-3.5" />
              ) : (
                <BatteryIcon className="size-3.5" />
              ))}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={_("Power")}
              className="flex size-6 items-center justify-center rounded-md outline-none transition-colors hover:bg-black/8 active:bg-black/14 data-popup-open:bg-black/12 dark:hover:bg-white/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15"
            >
              <PowerIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => void handlePowerAction("suspend")}>
                {_("Suspend")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handlePowerAction("reboot")}>
                {_("Restart…")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void handlePowerAction("poweroff")}
              >
                {_("Power Off…")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {showWindowChrome && windowId && (
            <>
              <WindowMenuButton
                side="right"
                windowId={windowId}
                appId="login-screen"
                iconName="lock"
              />
              <WindowControls side="right" />
            </>
          )}
        </div>
      </header>

      {/* Main GDM Greeter Stage */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        {view === "users" && (
          <div className="flex w-[320px] max-w-full flex-col items-center gap-3 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="mb-1 text-center">
              <h2 className="text-[16px] font-medium tracking-tight text-white">
                {_("Select User")}
              </h2>
            </div>

            <div className="flex max-h-[60vh] w-full flex-col gap-2 overflow-y-auto">
              {users.map((user) => {
                const isLast = user.id === lastLoggedUserId;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[16px] p-3 text-left text-adw-label shadow-adw-menu adw-material-menu transition-all outline-none hover:brightness-105 active:scale-[0.99] dark:text-white",
                      isLast && "ring-1 ring-adw-accent/70",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[14px] font-medium text-white shadow-sm",
                        user.gradient,
                      )}
                    >
                      {user.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium">
                          {_(user.name)}
                        </span>
                        {isLast && (
                          <span className="rounded-full bg-adw-accent/20 px-2 py-0.5 text-[10px] font-medium text-adw-accent">
                            {_("Last used")}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11.5px] text-adw-label-secondary">
                        @{user.username} · {_(user.role)}
                      </div>
                    </div>
                    <ArrowRightIcon className="size-4 shrink-0 opacity-60" />
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setManualUsername("");
                  setView("other-user");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-black/25 px-3 py-2.5 text-[12.5px] font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/35"
              >
                <UserPlusIcon className="size-3.5" />
                <span>{_("Not listed?")}</span>
              </button>
            </div>
          </div>
        )}

        {view === "other-user" && (
          <form
            onSubmit={handleSubmitOtherUser}
            className="flex w-[320px] max-w-full flex-col items-center gap-4 rounded-[22px] p-6 text-adw-label shadow-adw-menu adw-material-menu animate-in fade-in-0 zoom-in-95 duration-150 dark:text-white"
          >
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => setView("users")}
                className="inline-flex items-center gap-1 rounded-full bg-black/8 px-2.5 py-1 text-[11.5px] font-medium text-adw-label-secondary transition-colors hover:bg-black/14 hover:text-adw-label dark:bg-white/10 dark:hover:bg-white/18 dark:hover:text-white"
              >
                <ArrowLeftIcon className="size-3" />
                <span>{_("Back")}</span>
              </button>
            </div>

            <div className="flex size-16 items-center justify-center rounded-full bg-black/10 text-adw-label-secondary dark:bg-white/12 dark:text-white/80">
              <UserIcon className="size-7" />
            </div>

            <div className="w-full space-y-2">
              <input
                ref={usernameInputRef}
                type="text"
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder={_("Username")}
                aria-label={_("Username")}
                className="h-9 w-full rounded-[10px] border border-adw-separator bg-black/8 px-3 text-[13px] text-adw-label placeholder:text-adw-label-secondary focus:border-adw-accent focus:ring-2 focus:ring-adw-accent/35 focus:outline-none dark:bg-white/10 dark:text-white"
              />
              <button
                type="submit"
                disabled={!manualUsername.trim()}
                className="w-full rounded-lg bg-adw-accent px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-xs transition-all hover:brightness-110 disabled:opacity-50"
              >
                {_("Next")}
              </button>
            </div>
          </form>
        )}

        {view === "password" && (
          <div
            key={`pw-${selectedUser.id}-${shakeTick}`}
            style={
              shakeTick > 0
                ? {
                    animation:
                      "piloti-gdm-shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97)",
                  }
                : undefined
            }
            className="flex w-[320px] max-w-full flex-col items-center gap-4 rounded-[22px] p-6 text-adw-label shadow-adw-menu adw-material-menu dark:text-white"
          >
            {/* Top row: Switch user button & Last logged badge */}
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                disabled={authenticating}
                onClick={() => {
                  setAuthError(null);
                  setPassword("");
                  setView("users");
                }}
                className="inline-flex items-center gap-1 rounded-full bg-black/8 px-2.5 py-1 text-[11.5px] font-medium text-adw-label-secondary transition-colors hover:bg-black/14 hover:text-adw-label disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/18 dark:hover:text-white"
              >
                <ArrowLeftIcon className="size-3" />
                <span>{_("Switch User")}</span>
              </button>

              {selectedUser.id === lastLoggedUserId && (
                <span className="rounded-full bg-black/8 px-2.5 py-1 text-[10.5px] font-medium text-adw-label-secondary dark:bg-white/10">
                  {_("Last logged in")}
                </span>
              )}
            </div>

            {/* User Avatar & Name */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div
                className={cn(
                  "flex size-20 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-medium text-white shadow-lg ring-2 ring-white/25",
                  selectedUser.gradient,
                )}
              >
                {selectedUser.initials}
              </div>
              <div>
                <div className="text-[17px] font-medium tracking-tight">
                  {_(selectedUser.name)}
                </div>
                <div className="text-[12px] text-adw-label-secondary">
                  @{selectedUser.username} · {_(activeSession.label)}
                </div>
              </div>
            </div>

            {/* Password Input Form */}
            <form
              onSubmit={(e) => void handleSignIn(e)}
              className="flex w-full flex-col gap-2.5"
            >
              <div className="relative flex w-full items-center">
                <LockIcon className="pointer-events-none absolute left-3 size-3.5 text-adw-label-secondary" />
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  disabled={authenticating}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder={
                    selectedUser.isGuest
                      ? _("Press Enter to start guest session…")
                      : _("Password")
                  }
                  aria-label={_("Password")}
                  className={cn(
                    "h-9 w-full rounded-[10px] border bg-black/8 pr-16 pl-9 text-[13px] text-adw-label placeholder:text-adw-label-secondary focus:outline-none disabled:opacity-60 dark:bg-white/10 dark:text-white",
                    authError
                      ? "border-rose-500/80 ring-2 ring-rose-500/30"
                      : "border-adw-separator focus:border-adw-accent focus:ring-2 focus:ring-adw-accent/35",
                  )}
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={
                      showPassword ? _("Hide password") : _("Show password")
                    }
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex size-6 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/10 hover:text-adw-label dark:hover:bg-white/14 dark:hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-3.5" />
                    ) : (
                      <EyeIcon className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="submit"
                    disabled={authenticating}
                    aria-label={_("Sign In")}
                    className="flex size-6 items-center justify-center rounded-md bg-adw-accent text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                  >
                    {authenticating ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <ArrowRightIcon className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-lg bg-rose-500/18 px-2.5 py-1.5 text-center text-[11.5px] font-medium text-rose-600 ring-1 ring-rose-500/30 dark:text-rose-200"
                >
                  {authError}
                </div>
              )}

              <div className="mt-0.5 flex items-center justify-between gap-2">
                {!isLiveDm ? (
                  <button
                    type="button"
                    onClick={() => triggerBadPassword()}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {_("Test Wrong Password")}
                  </button>
                ) : (
                  <span className="text-[11px] text-adw-label-secondary">
                    {activeSession.sessionType === "wayland"
                      ? "Wayland"
                      : "X11"}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={authenticating}
                  className="rounded-lg bg-adw-accent px-3.5 py-1.5 text-[12px] font-medium text-white shadow-xs transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  {authenticating ? _("Signing in…") : _("Sign In")}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === "authenticated" && (
          <div className="flex w-[320px] max-w-full flex-col items-center gap-4 rounded-[22px] p-6 text-center text-adw-label shadow-adw-menu adw-material-menu animate-in fade-in-0 zoom-in-95 duration-150 dark:text-white">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40">
              <CheckIcon className="size-8" />
            </div>
            <div>
              <div className="text-[16px] font-medium">
                {greetdAvailable
                  ? _("Starting session for %s…", _(selectedUser.name))
                  : _("Signed in as %s", _(selectedUser.name))}
              </div>
              <div className="mt-1 text-[12px] text-adw-label-secondary">
                {_(activeSession.label)} · {activeKeyboard.label}
              </div>
            </div>
            {!greetdAvailable && (
              <button
                type="button"
                onClick={() => setView("password")}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-black/10 px-4 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-black/16 dark:bg-white/12 dark:hover:bg-white/20"
              >
                <UserIcon className="size-3.5" />
                <span>{_("Return to Greeter")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom GDM Branding / Hostname Footer */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between px-4 py-2 text-[11px] text-white/75">
        <span>
          {hostname ? `Piloti Display Manager · ${hostname}` : "Piloti Display Manager"}
        </span>
        <span>
          {isLiveDm
            ? greetdAvailable
              ? "greetd · PAM"
              : "Wayland Greeter"
            : _('Password: "piloti"')}
        </span>
      </footer>
    </div>
  );
};
