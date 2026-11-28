import { useAppChrome } from "@/ui/components/elements/app-chrome";
import { VFS_HOME } from "@/platform/shared/vfs-home";
import * as React from "react";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { usePiloti } from "@/platform/shared/piloti";
import { ArrowLeftIcon, ArrowRightIcon, BatteryChargingIcon, BatteryIcon, CheckIcon, ChevronDownIcon, MonitorIcon, PowerIcon, UserIcon, UserPlusIcon, WifiIcon, WifiOffIcon } from "@/ui/components/ui/symbols";
import { SoundVolumeIcon } from "@/ui/components/common/SoundVolumeIcon";
import { AuthPasswordCard } from "@/ui/shell/session/AuthPasswordCard";
import { DesktopBackgroundLayers } from "@/ui/shell/desktop/DesktopBackgroundLayers";
import { KeyboardLayoutSwitcher } from "@/ui/shell/session/KeyboardLayoutSwitcher";
import { WindowMenuButton } from "@/ui/components/common/WindowMenuButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { WindowControls } from "@/ui/components/ui/window";
import { useSystemBackends, useDesktopSettings } from "@/ui/context/DesktopStateContext";
import {
  authenticateAndStartGreetdSession,
  computeUserInitials,
  detectGreeterRuntime,
  discoverGreeterSessions,
  discoverGreeterUsers,
  finishGreetdGreeter,
  runGreeterPowerAction,
  type GreeterSessionOption,
  type GreeterUserAccount,
} from "@/platform/shared/greeter";
import { _, getLocale } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import { batteryTone } from "@/ui/components/common/power-saver";
import { readVfsStateJson, writeVfsStateJson } from "@/platform/shared/vfs-state";

export interface LoginScreenAppProps {
  windowId?: string;
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

const GREETER_STATE_PATH = `${VFS_HOME}/.config/piloti/login-screen.json`;

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
  mode = "preview",
}) => {
  const isCsd = useAppChrome().decorations === "client";
  const piloti = usePiloti();
  const settings = useDesktopSettings(["clock24Hour", "muted", "powerMode", "volume", "wifiEnabled"]);
  const { systemServices } = useCapabilities();
  const { batteryInfo, pushNotification } = useSystemBackends();

  const initialState = React.useMemo(() => loadGreeterState(), []);
  const [users, setUsers] = React.useState<readonly GreeterUserAccount[]>(
    DEMO_GREETER_USERS,
  );
  const [sessions, setSessions] = React.useState<readonly GreeterSessionOption[]>(
    DEMO_SESSION_OPTIONS,
  );
  const [greetdAvailable, setGreetdAvailable] = React.useState(false);

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
  const [authenticating, setAuthenticating] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [shakeTick, setShakeTick] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());

  const passwordInputRef = React.useRef<HTMLInputElement | null>(null);
  const usernameInputRef = React.useRef<HTMLInputElement | null>(null);

  // Discover real Linux accounts (/etc/passwd), Wayland/X11 sessions, and GREETD_SOCK
  React.useEffect(() => {
    if (!systemServices) return;
    let active = true;
    void Promise.all([
      detectGreeterRuntime(piloti),
      discoverGreeterUsers(piloti),
      discoverGreeterSessions(piloti),
    ])
      .then(([runtime, realUsers, realSessions]) => {
        if (!active) return;
        setGreetdAvailable(runtime.greetdAvailable);
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
  }, [piloti, systemServices]);

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
  };

  const handlePowerAction = async (action: "suspend" | "reboot" | "poweroff") => {
    if (systemServices && isLiveDm) {
      const ok = await runGreeterPowerAction(piloti, action);
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
    if (systemServices && greetdAvailable) {
      setAuthenticating(true);
      setAuthError(null);
      const res = await authenticateAndStartGreetdSession(piloti, {
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
        void finishGreetdGreeter(piloti);
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-ui-window text-white select-none">
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

      {/* Desktop Wallpaper + LockScreen-style Blur Veil */}
      <DesktopBackgroundLayers />
      <div className="pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-2xl" />

      {/* Top Greeter Menu Bar (same material & height as Piloti Desktop MenuBar) */}
      <header
        data-window-drag-region={showWindowChrome ? "" : undefined}
        className="relative z-20 grid h-[30px] w-full shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 text-ui-body text-ui-label ui-material-hud dark:text-white"
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
              className="flex h-[24px] items-center gap-1.5 rounded-ui-control px-2 text-ui-body font-medium outline-none transition-colors hover-fill:bg-black/8 active:bg-black/14 data-popup-open:bg-black/12 dark:hover-fill:bg-white/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15"
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
                      <span className="truncate text-ui-small text-ui-label-secondary">
                        {_(sess.subtitle)}
                      </span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Keyboard Layout Picker */}
          <KeyboardLayoutSwitcher
            fallbackLayouts={!systemServices ? keyboardLayouts : undefined}
            value={keyboardLayout}
            onValueChange={handleKeyboardChange}
            align="start"
            triggerClassName="h-[24px]"
          />
        </div>

        {/* Center: Live Clock */}
        <div className="pointer-events-none truncate text-ui-body font-medium tracking-tight tabular-nums">
          {formattedClock}
        </div>

        {/* Right: System Status, Power Menu & Window Controls */}
        <div className="flex items-center justify-end gap-1.5" data-window-no-drag>
          <span className="flex items-center gap-1.5 px-1 text-ui-label/85 dark:text-white/85">
            {settings.wifiEnabled ? (
              <WifiIcon className="size-3.5" />
            ) : (
              <WifiOffIcon className="size-3.5 opacity-50" />
            )}
            <SoundVolumeIcon volume={settings.volume} muted={settings.muted} className="size-3.5" />
            {batteryInfo.present && (
              <span className={batteryTone(settings.powerMode)}>
                {batteryInfo.charging ? (
                  <BatteryChargingIcon className="size-3.5" />
                ) : (
                  <BatteryIcon className="size-3.5" />
                )}
              </span>
            )}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={_("Power")}
              className="flex size-6 items-center justify-center rounded-ui-control outline-none transition-colors hover-fill:bg-black/8 active:bg-black/14 data-popup-open:bg-black/12 dark:hover-fill:bg-white/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15"
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
          <div className="flex w-[320px] max-w-[calc(100vw-32px)] flex-col gap-2 animate-in fade-in-0 zoom-in-95 duration-150">
            {users.map((user) => {
              const displayName = user.name?.trim()
                ? _(user.name)
                : user.username;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user.id)}
                  className="flex w-full items-center gap-3 rounded-[16px] bg-white/10 px-3.5 py-2.5 text-left text-white shadow-lg ring-1 ring-white/20 transition-colors outline-none hover-fill:bg-white/16 active:bg-white/20"
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-ui-body font-medium text-white shadow-sm",
                      user.gradient,
                    )}
                  >
                    {user.initials}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-ui-body font-medium">
                    {displayName}
                  </span>
                  <ArrowRightIcon className="size-4 shrink-0 text-white/60" />
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
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-white/8 px-3 py-2 text-ui-body font-medium text-white/85 ring-1 ring-white/15 transition-colors hover-fill:bg-white/14"
            >
              <UserPlusIcon className="size-3.5" />
              <span>{_("Not listed?")}</span>
            </button>
          </div>
        )}

        {view === "other-user" && (
          <form
            onSubmit={handleSubmitOtherUser}
            className="relative flex w-[320px] max-w-[calc(100vw-32px)] flex-col items-center gap-3.5 rounded-[22px] bg-white/10 p-6 text-white shadow-2xl ring-1 ring-white/20 animate-in fade-in-0 zoom-in-95 duration-150"
          >
            <button
              type="button"
              aria-label={_("Switch User")}
              title={_("Switch User")}
              onClick={() => setView("users")}
              className="absolute top-3.5 left-3.5 flex size-7 items-center justify-center rounded-full text-white/75 transition-colors hover-fill:bg-white/14 hover-fill:text-white"
            >
              <ArrowLeftIcon className="size-4" />
            </button>

            <div className="flex size-14 items-center justify-center rounded-full bg-white/12 text-white/85 shadow-md">
              <UserIcon className="size-6" />
            </div>

            <div className="relative flex w-full items-center">
              <input
                ref={usernameInputRef}
                type="text"
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder={_("Username")}
                aria-label={_("Username")}
                className="h-9 w-full rounded-[10px] border border-white/20 bg-black/30 pr-9 pl-3 text-ui-body text-white placeholder:text-white/45 focus:border-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!manualUsername.trim()}
                aria-label={_("Next")}
                className="absolute right-1.5 flex size-6 items-center justify-center rounded-ui-control bg-ui-accent text-white transition-all hover-fill:brightness-110 active:scale-95 disabled:opacity-40"
              >
                <ArrowRightIcon className="size-3.5" />
              </button>
            </div>
          </form>
        )}

        {view === "password" && (
          <AuthPasswordCard
            key={`pw-${selectedUser.id}-${shakeTick}`}
            avatar={selectedUser.initials}
            avatarClassName={selectedUser.gradient}
            title={
              selectedUser.name?.trim()
                ? _(selectedUser.name)
                : selectedUser.username
            }
            password={password}
            onPasswordChange={(next) => {
              setPassword(next);
              if (authError) setAuthError(null);
            }}
            onSubmit={(e) => void handleSignIn(e)}
            placeholder={
              selectedUser.isGuest
                ? _("Press Enter to start guest session…")
                : _("Password")
            }
            submitLabel={_("Sign In")}
            loading={authenticating}
            error={authError}
            shakeTick={shakeTick}
            onBack={() => {
              setAuthError(null);
              setPassword("");
              setView("users");
            }}
            backLabel={_("Switch User")}
            inputRef={passwordInputRef}
          />
        )}

        {view === "authenticated" && (
          <div className="flex w-[320px] max-w-[calc(100vw-32px)] flex-col items-center gap-3.5 rounded-[22px] bg-white/10 p-6 text-center text-white shadow-2xl ring-1 ring-white/20 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40">
              <CheckIcon className="size-7" />
            </div>
            <div className="text-ui-body font-medium">
              {greetdAvailable
                ? _(
                    "Starting session for %s…",
                    selectedUser.name?.trim()
                      ? _(selectedUser.name)
                      : selectedUser.username,
                  )
                : _(
                    "Signed in as %s",
                    selectedUser.name?.trim()
                      ? _(selectedUser.name)
                      : selectedUser.username,
                  )}
            </div>
            {!greetdAvailable && (
              <button
                type="button"
                aria-label={_("Return to Greeter")}
                title={_("Return to Greeter")}
                onClick={() => setView("password")}
                className="flex size-8 items-center justify-center rounded-full bg-white/12 text-white transition-colors hover-fill:bg-white/20"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
