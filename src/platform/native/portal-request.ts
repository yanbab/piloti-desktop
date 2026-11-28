import type { Piloti } from "@/platform/shared/piloti";

/**
 * Asks `xdg-desktop-portal` for a dialog, as an application would, so the
 * shell's own can be tried. It stays until the answer: the portal drops a
 * request whose caller leaves the bus. Needs `python3-gi`.
 */
const SCRIPT = `
import glob, sys, gi
from gi.repository import Gio, GLib

kind = sys.argv[1]
bus = Gio.bus_get_sync(Gio.BusType.SESSION)
loop = GLib.MainLoop()
NAME = "org.freedesktop.portal.Desktop"
sender = bus.get_unique_name()[1:].replace(".", "_")
count = [0]

def s(value): return GLib.Variant("s", value)
def u(value): return GLib.Variant("u", value)
def b(value): return GLib.Variant("b", value)

def request(interface, method, signature, args, options={}):
    count[0] += 1
    token = "piloti%d" % count[0]
    path = "/org/freedesktop/portal/desktop/request/%s/%s" % (sender, token)
    answer = []
    def answered(*signal):
        answer.append(signal[5].unpack())
        loop.quit()
    sub = bus.signal_subscribe(NAME, "org.freedesktop.portal.Request", "Response", path, None,
                               Gio.DBusSignalFlags.NONE, answered)
    options = dict(options, handle_token=s(token))
    bus.call_sync(NAME, "/org/freedesktop/portal/desktop", "org.freedesktop.portal." + interface,
                  method, GLib.Variant(signature, tuple(args) + (options,)), None, 0, -1, None)
    GLib.timeout_add_seconds(300, loop.quit)
    loop.run()
    bus.signal_unsubscribe(sub)
    if not answer or answer[0][0] != 0:
        sys.exit(0)
    return answer[0][1]

def session(interface, signature="(a{sv})", args=(), options={}):
    options = dict(options, session_handle_token=s("pilotisession"))
    return request(interface, "CreateSession", signature, args, options)["session_handle"]

if kind == "file-open":
    request("FileChooser", "OpenFile", "(ssa{sv})", ["", "Open File"], {"multiple": b(True)})
elif kind == "file-save":
    request("FileChooser", "SaveFile", "(ssa{sv})", ["", "Save File"], {"current_name": s("Untitled.txt")})
elif kind == "app-chooser":
    request("OpenURI", "OpenURI", "(ssa{sv})", ["", "https://example.com"], {"ask": b(True)})
elif kind == "screenshot":
    request("Screenshot", "Screenshot", "(sa{sv})", [""], {"interactive": b(True)})
elif kind == "pick-color":
    request("Screenshot", "PickColor", "(sa{sv})", [""])
elif kind == "account":
    request("Account", "GetUserInformation", "(sa{sv})", [""], {"reason": s("Testing the account dialog.")})
elif kind == "access":
    request("Camera", "AccessCamera", "(a{sv})", [])
elif kind == "print":
    request("Print", "PreparePrint", "(ssa{sv}a{sv}a{sv})", ["", "Print Document", {}, {}])
elif kind == "wallpaper":
    found = sorted(glob.glob("/usr/share/backgrounds/**/*.[jp][pn]g", recursive=True))
    if not found:
        sys.exit("No picture in /usr/share/backgrounds")
    uri = GLib.filename_to_uri(found[0], None)
    request("Wallpaper", "SetWallpaperURI", "(ssa{sv})", ["", uri], {"show-preview": b(True)})
elif kind == "launcher":
    found = sorted(glob.glob("/usr/share/icons/hicolor/*/apps/*.png"))
    if not found:
        sys.exit("No icon in /usr/share/icons/hicolor")
    icon = Gio.BytesIcon.new(GLib.Bytes.new(open(found[-1], "rb").read())).serialize()
    request("DynamicLauncher", "PrepareInstall", "(ssva{sv})", ["", "Piloti Test", icon])
elif kind == "screen-cast":
    handle = session("ScreenCast")
    request("ScreenCast", "SelectSources", "(oa{sv})", [handle], {"types": u(3), "multiple": b(True)})
    request("ScreenCast", "Start", "(osa{sv})", [handle, ""])
elif kind == "remote-desktop":
    handle = session("RemoteDesktop")
    request("RemoteDesktop", "SelectDevices", "(oa{sv})", [handle], {"types": u(3)})
    request("RemoteDesktop", "Start", "(osa{sv})", [handle, ""])
elif kind == "global-shortcuts":
    handle = session("GlobalShortcuts")
    shortcuts = [("test", {"description": s("Test shortcut"), "preferred_trigger": s("CTRL+ALT+t")})]
    request("GlobalShortcuts", "BindShortcuts", "(oa(sa{sv})sa{sv})", [handle, shortcuts, ""])
elif kind == "input-capture":
    session("InputCapture", "(sa{sv})", [""], {"capabilities": u(3)})
else:
    sys.exit("Unknown portal request: " + kind)
`;

/** Resolves once the dialog is answered: `null`, or why it could not be shown. */
export async function runPortalRequest(
  piloti: Pick<Piloti, "processes">,
  kind: string,
): Promise<string | null> {
  const fail = (message: string) => message.trim().split("\n").pop() || "python3";
  try {
    const result = await piloti.processes.run(["python3", "-c", SCRIPT, kind]);
    return result.match({
      Ok: (ran) => (ran.code === 0 ? null : fail(ran.stderr)),
      Err: (error) => fail(error.message),
    });
  } catch (error) {
    return fail(String(error));
  }
}
