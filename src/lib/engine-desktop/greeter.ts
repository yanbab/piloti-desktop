import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { KeymapChoice } from "@domicile-desktop/sdk/keymap-choice";
import { tokenizeExec } from "@/lib/xdg/xdg-desktop-entry";
import { runText } from "./exec";

export interface GreeterUserAccount {
  id: string;
  name: string;
  username: string;
  uid?: number;
  homeDir?: string;
  role: string;
  initials: string;
  gradient: string;
  avatarUrl?: string;
  isGuest?: boolean;
}

export interface GreeterSessionOption {
  id: string;
  label: string;
  subtitle: string;
  exec: string;
  sessionType: "wayland" | "x11";
  desktopNames?: string;
}

export interface GreeterRuntimeInfo {
  greetdAvailable: boolean;
  greetdSocket: string | null;
  hostname: string | null;
}

export interface GreetdAuthResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const AVATAR_GRADIENTS = [
  "from-teal-400 via-cyan-500 to-sky-600",
  "from-indigo-400 via-blue-500 to-violet-600",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-amber-400 via-orange-500 to-rose-600",
  "from-fuchsia-400 via-purple-500 to-indigo-600",
];

const NON_LOGIN_SHELLS = [
  "nologin",
  "/bin/false",
  "/usr/bin/false",
  "/bin/sync",
  "/sbin/halt",
  "/sbin/shutdown",
];

export function computeUserInitials(displayName: string, username: string): string {
  const source = (displayName || username || "U").trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function pickGradientForUsername(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

/**
 * Parses `/etc/passwd` text and returns human interactive Linux accounts
 * (UID 1000..65533 with an interactive login shell).
 */
export function parsePasswdUsers(
  passwdText: string,
  adminUsernames: ReadonlySet<string> = new Set()
): GreeterUserAccount[] {
  const users: GreeterUserAccount[] = [];
  for (const rawLine of passwdText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const fields = line.split(":");
    if (fields.length < 7) continue;
    const [username, , uidStr, , gecos, homeDir, shell] = fields;
    const uid = Number.parseInt(uidStr, 10);
    if (!Number.isFinite(uid) || uid < 1000 || uid >= 65534) continue;
    if (!username || username === "nobody") continue;
    const lowerShell = (shell || "").toLowerCase();
    if (!lowerShell || NON_LOGIN_SHELLS.some((bad) => lowerShell.endsWith(bad))) {
      continue;
    }

    const fullName = (gecos.split(",")[0] ?? "").trim() || username;
    users.push({
      id: username,
      name: fullName,
      username,
      uid,
      homeDir: homeDir || `/home/${username}`,
      role: adminUsernames.has(username) ? "Administrator" : "Standard",
      initials: computeUserInitials(fullName, username),
      gradient: pickGradientForUsername(username),
    });
  }
  return users;
}

/**
 * Parses a `/etc/group` text and returns usernames belonging to `sudo` or `wheel`.
 */
export function parseAdminUsernames(groupText: string): Set<string> {
  const admins = new Set<string>();
  for (const rawLine of groupText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const fields = line.split(":");
    if (fields.length < 4) continue;
    const [groupName, , , members] = fields;
    if (groupName === "sudo" || groupName === "wheel" || groupName === "adm") {
      for (const m of members.split(",")) {
        const clean = m.trim();
        if (clean) admins.add(clean);
      }
    }
  }
  return admins;
}

/**
 * Parses a `/usr/share/wayland-sessions/*.desktop` or `/usr/share/xsessions/*.desktop`
 * entry into a greeter session choice.
 */
export function parseSessionDesktopEntry(
  filename: string,
  content: string,
  sessionType: "wayland" | "x11"
): GreeterSessionOption | null {
  let inMain = false;
  let name = "";
  let comment = "";
  let exec = "";
  let desktopNames = "";
  let hidden = false;
  let noDisplay = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inMain = line === "[Desktop Entry]";
      continue;
    }
    if (!inMain) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key === "Name" && !name) name = val;
    else if (key === "Comment" && !comment) comment = val;
    else if (key === "Exec" && !exec) exec = val;
    else if (key === "DesktopNames" && !desktopNames) desktopNames = val;
    else if (key === "Hidden") hidden = val.toLowerCase() === "true";
    else if (key === "NoDisplay") noDisplay = val.toLowerCase() === "true";
  }

  if (hidden || noDisplay || !name || !exec) return null;
  const stem = filename.replace(/\.desktop$/i, "");
  return {
    id: `${sessionType}:${stem}`,
    label: name,
    subtitle:
      comment ||
      (sessionType === "wayland" ? "Wayland session" : "X11 session"),
    exec,
    sessionType,
    desktopNames: desktopNames || undefined,
  };
}

/**
 * Converts a session `.desktop` `Exec` command and session metadata into a
 * `greetd` `start_session` payload (`cmd` + `env`).
 */
export function buildGreetdStartSessionPayload(
  session: Pick<GreeterSessionOption, "id" | "exec" | "sessionType" | "desktopNames">
): { cmd: string[]; env: string[] } {
  const tokens = tokenizeExec(session.exec);
  const cmd =
    tokens.length > 0 ? tokens : ["/usr/bin/piloti-session"];
  const stem = session.id.replace(/^(wayland|x11):/, "");
  const env = [
    `XDG_SESSION_TYPE=${session.sessionType}`,
    `XDG_SESSION_DESKTOP=${stem}`,
    `DESKTOP_SESSION=${stem}`,
  ];
  if (session.desktopNames) {
    env.push(`XDG_CURRENT_DESKTOP=${session.desktopNames.replace(/;+$/, "").replace(/;/g, ":")}`);
  }
  return { cmd, env };
}

/**
 * Detects whether the greeter is running inside a live `greetd` DM session
 * (`GREETD_SOCK` set and socket accessible) and reads the machine hostname.
 */
export async function detectGreeterRuntime(
  domicile: Domicile
): Promise<GreeterRuntimeInfo> {
  const out = await runText(domicile, [
    "sh",
    "-c",
    'printf "SOCK=%s\\nHOST=%s\\n" "${GREETD_SOCK:-}" "$(hostname 2>/dev/null || cat /etc/hostname 2>/dev/null || true)"',
  ]);
  const sock = out?.match(/^SOCK=(.*)$/m)?.[1]?.trim() || null;
  const hostname = out?.match(/^HOST=(.*)$/m)?.[1]?.trim() || null;
  return {
    greetdAvailable: Boolean(sock),
    greetdSocket: sock,
    hostname,
  };
}

/**
 * Discovers real Linux user accounts from `/etc/passwd` + `/etc/group`.
 */
export async function discoverGreeterUsers(
  domicile: Domicile
): Promise<GreeterUserAccount[]> {
  try {
    const [passwdRes, groupRes] = await Promise.all([
      domicile.files.readText("/etc/passwd"),
      domicile.files.readText("/etc/group"),
    ]);
    const passwdText = passwdRes.match({ Ok: (t) => t, Err: () => "" });
    if (!passwdText) return [];
    const groupText = groupRes.match({ Ok: (t) => t, Err: () => "" });
    const admins = parseAdminUsernames(groupText);
    return parsePasswdUsers(passwdText, admins);
  } catch {
    return [];
  }
}

/**
 * Discovers installed desktop sessions from `/usr/share/wayland-sessions`
 * and `/usr/share/xsessions`, prioritizing Piloti Desktop first.
 */
export async function discoverGreeterSessions(
  domicile: Domicile
): Promise<GreeterSessionOption[]> {
  const dirs: Array<{ dir: string; type: "wayland" | "x11" }> = [
    { dir: "/usr/share/wayland-sessions", type: "wayland" },
    { dir: "/usr/share/xsessions", type: "x11" },
  ];

  const found: GreeterSessionOption[] = [];
  for (const { dir, type } of dirs) {
    try {
      const dirRes = await domicile.files.readDir(dir);
      const items = dirRes.match({ Ok: (l) => l, Err: () => [] });
      for (const item of items) {
        if (!item.name.endsWith(".desktop")) continue;
        const textRes = await domicile.files.readText(`${dir}/${item.name}`);
        const text = textRes.match({ Ok: (t) => t, Err: () => null });
        if (!text) continue;
        const parsed = parseSessionDesktopEntry(item.name, text, type);
        if (parsed) found.push(parsed);
      }
    } catch {
      // ignore missing session directory
    }
  }

  return found.sort((a, b) => {
    const aPiloti = a.id.toLowerCase().includes("piloti") ? 0 : 1;
    const bPiloti = b.id.toLowerCase().includes("piloti") ? 0 : 1;
    if (aPiloti !== bPiloti) return aPiloti - bPiloti;
    if (a.sessionType !== b.sessionType) {
      return a.sessionType === "wayland" ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
}

const GREETD_HELPER_PATHS = [
  "/usr/libexec/piloti-desktop/piloti-greetd-client",
  "/usr/lib/piloti-desktop/piloti-greetd-client",
];

/**
 * Authenticates `username` + `password` against `greetd` (`GREETD_SOCK`) and
 * starts the selected desktop session via the stdin-fed IPC helper (so the
 * password never appears on argv or process listings).
 */
export async function authenticateAndStartGreetdSession(
  domicile: Domicile,
  params: {
    username: string;
    password: string;
    session: Pick<GreeterSessionOption, "id" | "exec" | "sessionType" | "desktopNames">;
  }
): Promise<GreetdAuthResult> {
  const { cmd, env } = buildGreetdStartSessionPayload(params.session);
  const payload = JSON.stringify({
    username: params.username,
    password: params.password,
    cmd,
    env,
  });

  const helperCmd = [
    "sh",
    "-c",
    `for h in ${GREETD_HELPER_PATHS.join(" ")}; do [ -x "$h" ] && exec "$h"; done; echo '{"ok":false,"error":"piloti-greetd-client helper not installed"}'; exit 127`,
  ];

  try {
    const spawnRes = await domicile.processes.spawn(helperCmd, { stdin: true });
    return await spawnRes.match({
      Ok: async (proc) => {
        proc.write(new TextEncoder().encode(payload));
        proc.closeStdin();
        const [stdout, stderr, exited] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);
        const exitCode = exited.match({
          Ok: (e) => e.code ?? 1,
          Err: () => 1,
        });
        try {
          const parsed = JSON.parse(stdout.trim()) as GreetdAuthResult;
          if (typeof parsed.ok === "boolean") {
            return parsed;
          }
        } catch {
          // fall through to generic error
        }
        return {
          ok: exitCode === 0,
          error:
            exitCode === 0
              ? undefined
              : (stderr.trim() || stdout.trim() || "Authentication failed."),
        };
      },
      Err: async (err) => ({
        ok: false,
        error: err.message || "Could not start greetd authentication helper.",
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Authentication failed.",
    };
  }
}

/**
 * Cleanly terminates the greeter's Domicile compositor after `greetd` accepts
 * `start_session`, handing the VT over to the authenticated user session.
 * Per `greetd-ipc(7)`, the user session starts once the greeter exits.
 */
export async function finishGreetdGreeter(domicile: Domicile): Promise<void> {
  try {
    await domicile.processes.run([
      "sh",
      "-c",
      [
        'sock="${DOMICILE_SOCK:-}"',
        'pid=""',
        'case "$sock" in *domicile-ipc.*.sock) pid="${sock##*domicile-ipc.}"; pid="${pid%.sock}" ;; esac',
        'case "$pid" in ""|*[!0-9]*) pid="$(pgrep -u "$(id -u)" -x domicile 2>/dev/null | head -n 1 || true)" ;; esac',
        'if [ -n "$pid" ]; then kill -TERM "$pid" 2>/dev/null || true; fi',
      ].join("; "),
    ]);
  } catch {
    // Expected if the compositor terminates while the command is in flight
  }
}

/**
 * Triggers a real system power action from Display Manager / Greeter mode via `systemctl`.
 */
export async function runGreeterPowerAction(
  domicile: Domicile,
  action: "suspend" | "reboot" | "poweroff"
): Promise<boolean> {
  try {
    const res = await domicile.processes.run(["systemctl", action]);
    return res.match({
      Ok: (r) => r.code === 0,
      Err: () => false,
    });
  } catch {
    return false;
  }
}

/**
 * Switches the live Domicile compositor keyboard layout when running on native Linux.
 */
export async function switchGreeterKeymap(
  domicile: Domicile,
  layoutId: string
): Promise<boolean> {
  try {
    if (typeof domicile.keyboard?.selectKeymap === "function") {
      const res = await domicile.keyboard.selectKeymap(
        KeymapChoice.Named(layoutId)
      );
      return res.match({ Ok: () => true, Err: () => false });
    }
  } catch {
    // ignore keymap errors if config doesn't define the named layout
  }
  return false;
}
