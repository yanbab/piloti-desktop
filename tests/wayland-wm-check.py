#!/usr/bin/env python3
"""
Wayland WM & Toolkit Matrix Check (`tests/wayland-wm-check.py`)

If not running inside a Wayland session ($WAYLAND_DISPLAY unset), connects over
SSH to the Debian Domicile VM (default: debian@192.168.162.236), runs the
check inside its live Wayland session, and writes the report to:
  tests/wayland-wm-report.txt

Checks for each app:
  - GTK2: pcmanfm (expected SSD)
  - GTK3: gnome-disks, firefox, chromium (expected CSD)
  - GTK4: nautilus (expected CSD)

For each app:
  1. Launches under WAYLAND_DEBUG=1 and detects window bounds via screenshot diff.
  2. Verifies decoration mode (SSD vs CSD) from Wayland protocol + headerbar.
  3. Tests dragging the window titlebar/headerbar via /dev/uinput pointer.
  4. Tests closing the window via its close button.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import time
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class AppSpec:
    app_id: str
    toolkit: str
    expected_mode: str  # "SSD" | "CSD"
    cmd: list[str]
    env_extra: dict[str, str]
    launch_wait_s: float = 2.8


APPS: list[AppSpec] = [
    AppSpec(
        app_id="pcmanfm",
        toolkit="GTK2",
        expected_mode="SSD",
        cmd=["pcmanfm"],
        env_extra={"GDK_BACKEND": "wayland,x11"},
        launch_wait_s=2.5,
    ),
    AppSpec(
        app_id="gnome-disks",
        toolkit="GTK3",
        expected_mode="CSD",
        cmd=["gnome-disks"],
        env_extra={"GDK_BACKEND": "wayland"},
        launch_wait_s=2.8,
    ),
    AppSpec(
        app_id="firefox",
        toolkit="GTK3",
        expected_mode="CSD",
        cmd=["firefox", "--no-remote"],
        env_extra={"MOZ_ENABLE_WAYLAND": "1"},
        launch_wait_s=4.5,
    ),
    AppSpec(
        app_id="chromium",
        toolkit="GTK3/Ozone",
        expected_mode="CSD",
        cmd=["chromium", "--ozone-platform=wayland", "--no-first-run"],
        env_extra={},
        launch_wait_s=4.0,
    ),
    AppSpec(
        app_id="nautilus",
        toolkit="GTK4",
        expected_mode="CSD",
        cmd=["nautilus", "--new-window"],
        env_extra={"GDK_BACKEND": "wayland"},
        launch_wait_s=3.0,
    ),
]


# ---------------------------------------------------------------------------
# Pure-Python PNG reader & pixel diff (zero external dependencies)
# ---------------------------------------------------------------------------

def read_png_rgb(path: str) -> tuple[int, int, bytes]:
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    pos = 8
    width = height = 0
    bit_depth = color_type = 0
    idat = bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(
                ">IIBBBBB", chunk
            )
        elif ctype == b"IDAT":
            idat.extend(chunk)
        elif ctype == b"IEND":
            break

    if bit_depth != 8 or color_type not in (2, 6):
        raise ValueError(f"Unsupported PNG format depth={bit_depth} type={color_type}")

    bpp = 3 if color_type == 2 else 4
    stride = width * bpp
    raw = zlib.decompress(bytes(idat))
    out = bytearray(width * height * 3)

    prev_row = bytes(stride)
    idx = 0
    for y in range(height):
        ftype = raw[idx]
        idx += 1
        row = bytearray(raw[idx : idx + stride])
        idx += stride
        if ftype == 1:  # Sub
            for i in range(bpp, stride):
                row[i] = (row[i] + row[i - bpp]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                row[i] = (row[i] + prev_row[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                left = row[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + ((left + prev_row[i]) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                a = row[i - bpp] if i >= bpp else 0
                b = prev_row[i]
                c = prev_row[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                row[i] = (row[i] + pr) & 0xFF
        prev_row = bytes(row)

        out_off = y * width * 3
        if bpp == 3:
            out[out_off : out_off + width * 3] = row
        else:
            for x in range(width):
                s = x * 4
                d = out_off + x * 3
                out[d : d + 3] = row[s : s + 3]

    return width, height, bytes(out)


def diff_bbox(
    base: tuple[int, int, bytes],
    curr: tuple[int, int, bytes],
    threshold: int = 18,
    step: int = 2,
) -> Optional[tuple[int, int, int, int, int]]:
    w, h, b_buf = base
    _, _, c_buf = curr
    min_x, min_y = w, h
    max_x, max_y = -1, -1
    changed = 0
    # Exclude top bar (y < 28) & bottom dock area (y > h - 90) only if needed?
    # Keep full screen except top 28px menubar to avoid clock tick diffs.
    for y in range(28, h, step):
        row_off = y * w * 3
        for x in range(0, w, step):
            o = row_off + x * 3
            if (
                abs(b_buf[o] - c_buf[o]) > threshold
                or abs(b_buf[o + 1] - c_buf[o + 1]) > threshold
                or abs(b_buf[o + 2] - c_buf[o + 2]) > threshold
            ):
                changed += 1
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
    if changed < 150 or max_x <= min_x or max_y <= min_y:
        return None
    return (min_x, min_y, max_x, max_y, changed)


# ---------------------------------------------------------------------------
# /dev/uinput virtual absolute pointer
# ---------------------------------------------------------------------------

class VirtualPointer:
    UI_SET_EVBIT = 0x40045564
    UI_SET_KEYBIT = 0x40045565
    UI_SET_ABSBIT = 0x40045567
    UI_DEV_SETUP = 0x405C5503
    UI_ABS_SETUP = 0x401C5504
    UI_DEV_CREATE = 0x5501
    UI_DEV_DESTROY = 0x5502

    EV_SYN = 0x00
    EV_KEY = 0x01
    EV_ABS = 0x03
    SYN_REPORT = 0
    BTN_LEFT = 0x110
    ABS_X = 0x00
    ABS_Y = 0x01
    BUS_USB = 0x03

    def __init__(self, width: int, height: int):
        import fcntl

        self.fcntl = fcntl
        self.width = width
        self.height = height
        self.fd = os.open("/dev/uinput", os.O_WRONLY | os.O_NONBLOCK)
        fcntl.ioctl(self.fd, self.UI_SET_EVBIT, self.EV_KEY)
        fcntl.ioctl(self.fd, self.UI_SET_KEYBIT, self.BTN_LEFT)
        fcntl.ioctl(self.fd, self.UI_SET_EVBIT, self.EV_ABS)
        fcntl.ioctl(self.fd, self.UI_SET_ABSBIT, self.ABS_X)
        fcntl.ioctl(self.fd, self.UI_SET_ABSBIT, self.ABS_Y)

        # struct uinput_abs_setup { __u16 code; struct input_absinfo absinfo; }
        # input_absinfo: value, minimum, maximum, fuzz, flat, resolution (6 x i32)
        abs_x = struct.pack("<Hxxiiiiii", self.ABS_X, 0, 0, width - 1, 0, 0, 1)
        abs_y = struct.pack("<Hxxiiiiii", self.ABS_Y, 0, 0, height - 1, 0, 0, 1)
        fcntl.ioctl(self.fd, self.UI_ABS_SETUP, abs_x)
        fcntl.ioctl(self.fd, self.UI_ABS_SETUP, abs_y)

        # struct uinput_setup { struct input_id id (4 x u16); char name[80]; __u32 ff_effects_max; }
        usetup = struct.pack(
            "<HHHH80sI", self.BUS_USB, 0x1234, 0x5678, 1, b"piloti-vm-pointer", 0
        )
        fcntl.ioctl(self.fd, self.UI_DEV_SETUP, usetup)
        fcntl.ioctl(self.fd, self.UI_DEV_CREATE)
        time.sleep(0.35)

    def _emit(self, etype: int, code: int, value: int) -> None:
        sec = int(time.time())
        usec = int((time.time() - sec) * 1_000_000)
        ev = struct.pack("<qqHHi", sec, usec, etype, code, value)
        os.write(self.fd, ev)

    def _sync(self) -> None:
        self._emit(self.EV_SYN, self.SYN_REPORT, 0)

    def move(self, x: int, y: int) -> None:
        x = max(0, min(self.width - 1, int(x)))
        y = max(0, min(self.height - 1, int(y)))
        self._emit(self.EV_ABS, self.ABS_X, x)
        self._emit(self.EV_ABS, self.ABS_Y, y)
        self._sync()

    def drag(self, x0: int, y0: int, x1: int, y1: int, steps: int = 12) -> None:
        self.move(x0, y0)
        time.sleep(0.08)
        self._emit(self.EV_KEY, self.BTN_LEFT, 1)
        self._sync()
        time.sleep(0.08)
        for i in range(1, steps + 1):
            nx = round(x0 + (x1 - x0) * i / steps)
            ny = round(y0 + (y1 - y0) * i / steps)
            self.move(nx, ny)
            time.sleep(0.025)
        time.sleep(0.08)
        self._emit(self.EV_KEY, self.BTN_LEFT, 0)
        self._sync()

    def click(self, x: int, y: int) -> None:
        self.move(x, y)
        time.sleep(0.08)
        self._emit(self.EV_KEY, self.BTN_LEFT, 1)
        self._sync()
        time.sleep(0.06)
        self._emit(self.EV_KEY, self.BTN_LEFT, 0)
        self._sync()

    def close(self) -> None:
        try:
            self.fcntl.ioctl(self.fd, self.UI_DEV_DESTROY)
        finally:
            os.close(self.fd)


# ---------------------------------------------------------------------------
# Domicile session helpers (local inside Wayland VM)
# ---------------------------------------------------------------------------

def discover_domicile_env() -> tuple[dict[str, str], Optional[int], Optional[int]]:
    sudo_uid = os.environ.get("SUDO_UID")
    sudo_gid = os.environ.get("SUDO_GID")
    uid = int(sudo_uid) if sudo_uid else os.getuid()
    gid = int(sudo_gid) if sudo_gid else os.getgid()
    runtime_dir = os.environ.get("XDG_RUNTIME_DIR") or f"/run/user/{uid}"
    env = dict(os.environ)
    env["XDG_RUNTIME_DIR"] = runtime_dir
    env["XDG_SESSION_TYPE"] = "wayland"
    bus_path = f"{runtime_dir}/bus"
    if "DBUS_SESSION_BUS_ADDRESS" not in env and os.path.exists(bus_path):
        env["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path={bus_path}"
    if sudo_uid:
        import pwd
        pw = pwd.getpwuid(uid)
        env["HOME"] = pw.pw_dir
        env["USER"] = pw.pw_name
        env["LOGNAME"] = pw.pw_name
    for ipc_sock in sorted(glob.glob(f"{runtime_dir}/domicile-ipc.*.sock")):
        env["DOMICILE_SOCK"] = ipc_sock
        break
    for session_file in sorted(glob.glob(f"{runtime_dir}/domicile-*/session.json")):
        try:
            with open(session_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "DOMICILE_SOCK" not in env:
                sock_dir = os.path.dirname(session_file)
                cmd_sock = os.path.join(sock_dir, "command.sock")
                if os.path.exists(cmd_sock):
                    env["DOMICILE_SOCK"] = cmd_sock
            if data.get("wayland_display"):
                env["WAYLAND_DISPLAY"] = data["wayland_display"]
            break
        except Exception:
            continue
    return env, (uid if sudo_uid else None), (gid if sudo_gid else None)


def take_screenshot(
    env: dict[str, str], out_path: str, preexec_fn=None
) -> tuple[int, int, bytes]:
    subprocess.run(
        ["domicile", "screenshot", out_path],
        env=env,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        preexec_fn=preexec_fn,
    )
    return read_png_rgb(out_path)


def parse_wayland_decorations(log_path: str) -> dict[str, object]:
    if not os.path.exists(log_path):
        return {"detected": "UNKNOWN", "detail": "no wayland log"}
    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    kde_modes = re.findall(r"org_kde_kwin_server_decoration#\d+\.mode\((\d+)\)", text)
    kde_reqs = re.findall(
        r"org_kde_kwin_server_decoration#\d+\.request_mode\((\d+)\)", text
    )
    xdg_confs = re.findall(
        r"zxdg_toplevel_decoration_v1#\d+\.configure\((\d+)\)", text
    )
    xdg_sets = re.findall(
        r"zxdg_toplevel_decoration_v1#\d+\.set_mode\((\d+)\)", text
    )
    moves = len(re.findall(r"xdg_toplevel#\d+\.move\(", text))
    unset_fs = len(re.findall(r"xdg_toplevel#\d+\.unset_fullscreen\(", text))

    # Mode 2 = Server (SSD), Mode 1 = Client (CSD)
    if xdg_confs:
        last = xdg_confs[-1]
        detected = "SSD" if last == "2" else "CSD"
    elif kde_modes:
        last = kde_modes[-1]
        if kde_reqs and kde_reqs[-1] == "1" and last == "2":
            # GTK3 client requested CSD (1) while compositor sent Server (2)
            detected = "CSD (loop: req=1, srv=2)"
        else:
            detected = "SSD" if last == "2" else "CSD"
    else:
        detected = "CSD (no SSD protocol)"

    return {
        "detected": detected,
        "kde_req_count": len(kde_reqs),
        "kde_last_mode": kde_modes[-1] if kde_modes else None,
        "xdg_last_conf": xdg_confs[-1] if xdg_confs else None,
        "xdg_set_count": len(xdg_sets),
        "moves": moves,
        "unset_fullscreen": unset_fs,
    }


def run_wayland_suite(report_path: str) -> int:
    if os.geteuid() != 0 and not os.access("/dev/uinput", os.W_OK):
        # Re-exec via sudo -n / sudo if passwordless or warn
        print("Need write access to /dev/uinput (run with sudo).", file=sys.stderr)
        return 2

    env, drop_uid, drop_gid = discover_domicile_env()
    if "DOMICILE_SOCK" not in env or "WAYLAND_DISPLAY" not in env:
        print("Could not find running Domicile session.", file=sys.stderr)
        return 2

    def drop_privs() -> None:
        os.setsid()
        if drop_gid is not None:
            os.setgid(drop_gid)
        if drop_uid is not None:
            os.setuid(drop_uid)

    tmp_dir = "/tmp/piloti-wm-check"
    os.makedirs(tmp_dir, exist_ok=True)
    if drop_uid is not None and drop_gid is not None:
        os.chown(tmp_dir, drop_uid, drop_gid)
    target_uid = drop_uid if drop_uid is not None else os.getuid()
    for spec in APPS:
        subprocess.run(
            ["pkill", "-u", str(target_uid), "-f", spec.app_id],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    time.sleep(0.5)
    clean_png = os.path.join(tmp_dir, "clean.png")
    base_img = take_screenshot(env, clean_png, preexec_fn=drop_privs)
    width, height, _ = base_img

    pointer = VirtualPointer(width, height)
    lines: list[str] = [
        "Piloti Wayland WM & Toolkit Matrix Report",
        f"Screen: {width}x{height} | WAYLAND_DISPLAY={env['WAYLAND_DISPLAY']}",
        "=" * 72,
        "",
    ]
    all_ok = True

    try:
        for spec in APPS:
            app_env = dict(env)
            app_env["WAYLAND_DEBUG"] = "1"
            app_env.update(spec.env_extra)
            log_path = os.path.join(tmp_dir, f"{spec.app_id}.wayland.log")
            open_png = os.path.join(tmp_dir, f"{spec.app_id}.open.png")
            drag_png = os.path.join(tmp_dir, f"{spec.app_id}.drag.png")
            close_png = os.path.join(tmp_dir, f"{spec.app_id}.close.png")

            with open(log_path, "wb") as logf:
                proc = subprocess.Popen(
                    spec.cmd,
                    env=app_env,
                    stdout=subprocess.DEVNULL,
                    stderr=logf,
                    preexec_fn=drop_privs,
                )

            bbox = None
            deadline = time.time() + max(18.0, spec.launch_wait_s + 14.0)
            time.sleep(spec.launch_wait_s)
            while time.time() < deadline:
                img = take_screenshot(env, open_png, preexec_fn=drop_privs)
                bbox = diff_bbox(base_img, img)
                if bbox and (bbox[2] - bbox[0]) >= 120 and (bbox[3] - bbox[1]) >= 80:
                    break
                time.sleep(0.75)

            proto = parse_wayland_decorations(log_path)
            dec_ok = spec.expected_mode in str(proto["detected"])

            drag_ok = False
            drag_detail = "window not detected"
            close_ok = False
            close_detail = "window not detected"

            if bbox:
                x0, y0, x1, y1, _ = bbox
                win_w = x1 - x0
                win_h = y1 - y0
                # Drag from center of titlebar/headerbar (y0 + 20)
                drag_start_x = x0 + win_w // 2
                drag_start_y = y0 + 20
                drag_target_x = min(width - 60, drag_start_x + 120)
                drag_target_y = min(height - 120, drag_start_y + 60)
                pointer.drag(drag_start_x, drag_start_y, drag_target_x, drag_target_y)
                time.sleep(0.6)

                drag_img = take_screenshot(env, drag_png, preexec_fn=drop_privs)
                new_bbox = diff_bbox(base_img, drag_img)
                if new_bbox:
                    nx0, ny0, nx1, ny1, _ = new_bbox
                    dx = nx0 - x0
                    dy = ny0 - y0
                    drag_ok = (dx * dx + dy * dy) ** 0.5 >= 50
                    drag_detail = (
                        f"start=({x0},{y0},{win_w}x{win_h}) -> "
                        f"after=({nx0},{ny0}) delta=({dx:+d},{dy:+d})"
                    )
                    close_x = nx1 - 22
                    close_y = ny0 + 22
                else:
                    drag_detail = f"start=({x0},{y0},{win_w}x{win_h}) -> disappeared"
                    close_x = x1 - 22
                    close_y = y0 + 22

                # Close via top-right close button
                pointer.click(close_x, close_y)
                for _ in range(8):
                    time.sleep(0.4)
                    if proc.poll() is not None:
                        break
                    c_img = take_screenshot(env, close_png, preexec_fn=drop_privs)
                    if diff_bbox(base_img, c_img) is None:
                        break

                c_img = take_screenshot(env, close_png, preexec_fn=drop_privs)
                rem_bbox = diff_bbox(base_img, c_img)
                close_ok = rem_bbox is None or proc.poll() is not None
                close_detail = (
                    f"clicked ({close_x},{close_y}) -> "
                    + ("closed" if close_ok else f"still visible at {rem_bbox[:4]}")
                )

            # Cleanup process if still alive
            if proc.poll() is None:
                try:
                    os.killpg(proc.pid, signal.SIGTERM)
                    proc.wait(timeout=2.0)
                except Exception:
                    try:
                        os.killpg(proc.pid, signal.SIGKILL)
                    except Exception:
                        pass
            # Also kill stray children of firefox/chromium/nautilus/pcmanfm
            target_uid = drop_uid if drop_uid is not None else os.getuid()
            subprocess.run(
                ["pkill", "-u", str(target_uid), "-f", spec.app_id],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            time.sleep(0.8)

            # Refresh baseline if anything shifted
            app_ok = dec_ok and drag_ok and close_ok
            if not app_ok:
                all_ok = False

            lines.extend(
                [
                    f"[{spec.app_id}] ({spec.toolkit}) — {'PASS' if app_ok else 'FAIL'}",
                    f"  Decorations : {'PASS' if dec_ok else 'FAIL'} | expected={spec.expected_mode}, observed={proto['detected']} (kde_req={proto['kde_req_count']}, kde_mode={proto['kde_last_mode']}, xdg_conf={proto['xdg_last_conf']})",
                    f"  Drag        : {'PASS' if drag_ok else 'FAIL'} | {drag_detail} (wl_move={proto['moves']}, unset_fs={proto['unset_fullscreen']})",
                    f"  Close       : {'PASS' if close_ok else 'FAIL'} | {close_detail}",
                    "",
                ]
            )
    finally:
        pointer.close()

    lines.append(f"OVERALL: {'PASS' if all_ok else 'FAIL (see details above)'}")
    report_text = "\n".join(lines) + "\n"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(report_text)
    return 0 if all_ok else 1


# ---------------------------------------------------------------------------
# SSH runner when invoked outside Wayland (e.g. macOS host)
# ---------------------------------------------------------------------------

def run_with_ssh_password(cmd: list[str], password: str) -> tuple[int, str]:
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(cmd[0], cmd)
    out = bytearray()
    sent_pw = False
    while True:
        r, _, _ = select.select([fd], [], [], 180.0)
        if not r:
            break
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            break
        if not chunk:
            break
        out.extend(chunk)
        if not sent_pw and b"password:" in out.lower():
            os.write(fd, (password + "\n").encode("utf-8"))
            sent_pw = True
    _, status = os.waitpid(pid, 0)
    code = os.waitstatus_to_exitcode(status)
    return code, out.decode("utf-8", errors="replace")


def run_remote_vm(report_path: str) -> int:
    host = os.environ.get("PILOTI_VM_HOST", "192.168.162.236")
    user = os.environ.get("PILOTI_VM_USER", "debian")
    password = os.environ.get("PILOTI_VM_PASS", "debian")
    target = f"{user}@{host}"

    local_script = Path(__file__).resolve()
    remote_script = "/tmp/wayland-wm-check.py"
    remote_report = "/tmp/wayland-wm-report.txt"

    print(f"Not in Wayland ($WAYLAND_DISPLAY unset). Connecting to Debian VM {target}...")
    code, out = run_with_ssh_password(
        [
            "scp",
            "-o",
            "StrictHostKeyChecking=no",
            str(local_script),
            f"{target}:{remote_script}",
        ],
        password,
    )
    if code != 0:
        print(out, file=sys.stderr)
        return code

    remote_cmd = (
        f"echo {password} | sudo -S python3 {remote_script} --local --out {remote_report}"
    )
    code, out = run_with_ssh_password(
        [
            "ssh",
            "-t",
            "-o",
            "StrictHostKeyChecking=no",
            target,
            remote_cmd,
        ],
        password,
    )
    print(out)

    scp_code, scp_out = run_with_ssh_password(
        [
            "scp",
            "-o",
            "StrictHostKeyChecking=no",
            f"{target}:{remote_report}",
            report_path,
        ],
        password,
    )
    if scp_code != 0:
        print(scp_out, file=sys.stderr)
        return scp_code
    print(f"Report written to {report_path}")
    return code


def main() -> int:
    parser = argparse.ArgumentParser(description="Wayland VM WM & Toolkit matrix check")
    parser.add_argument(
        "--local",
        action="store_true",
        help="Force running locally in the current Wayland session",
    )
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent / "wayland-wm-report.txt"),
        help="Path to write the .txt report",
    )
    args = parser.parse_args()

    in_wayland = bool(os.environ.get("WAYLAND_DISPLAY"))
    if args.local or in_wayland:
        return run_wayland_suite(args.out)
    return run_remote_vm(args.out)


if __name__ == "__main__":
    sys.exit(main())
