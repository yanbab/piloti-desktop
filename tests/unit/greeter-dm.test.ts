import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {
  buildGreetdStartSessionPayload,
  parseAdminUsernames,
  parsePasswdUsers,
  parseSessionDesktopEntry,
} from "@/lib/engine-desktop/greeter";

describe("Display Manager / greetd greeter backend", () => {
  test("parses /etc/passwd human accounts and /etc/group admin roles cleanly", () => {
    const groupText = [
      "root:x:0:",
      "sudo:x:27:debian,alice",
      "wheel:x:10:bob",
      "users:x:100:charlie",
    ].join("\n");

    const passwdText = [
      "root:x:0:0:root:/root:/bin/bash",
      "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
      "debian:x:1000:1000:Debian User,,,:/home/debian:/bin/bash",
      "alice:x:1001:1001:Alice Martin:/home/alice:/usr/bin/zsh",
      "svc:x:1002:1002:Service Account:/var/lib/svc:/usr/sbin/nologin",
      "charlie:x:1003:1003::/home/charlie:/bin/sh",
      "nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin",
    ].join("\n");

    const admins = parseAdminUsernames(groupText);
    const users = parsePasswdUsers(passwdText, admins);

    expect(users.map((u) => u.username)).toEqual(["debian", "alice", "charlie"]);
    expect(users[0]).toMatchObject({
      name: "Debian User",
      role: "Administrator",
      initials: "DU",
      uid: 1000,
    });
    expect(users[1]).toMatchObject({
      name: "Alice Martin",
      role: "Administrator",
      initials: "AM",
    });
    expect(users[2]).toMatchObject({
      name: "charlie",
      role: "Standard",
      initials: "CH",
    });
  });

  test("parses wayland-sessions and xsessions .desktop entries and builds greetd start_session payload", () => {
    const pilotiDesktop = [
      "[Desktop Entry]",
      "Name=Piloti Desktop",
      "Comment=Hybrid Web/Linux Wayland desktop shell built on Domicile",
      "Exec=/usr/bin/piloti-session",
      "Type=Application",
      "DesktopNames=Piloti;GNOME;",
    ].join("\n");

    const hiddenDesktop = [
      "[Desktop Entry]",
      "Name=Hidden Session",
      "Exec=/usr/bin/foo",
      "NoDisplay=true",
    ].join("\n");

    const parsed = parseSessionDesktopEntry("piloti.desktop", pilotiDesktop, "wayland");
    expect(parsed).toEqual({
      id: "wayland:piloti",
      label: "Piloti Desktop",
      subtitle: "Hybrid Web/Linux Wayland desktop shell built on Domicile",
      exec: "/usr/bin/piloti-session",
      sessionType: "wayland",
      desktopNames: "Piloti;GNOME;",
    });
    expect(parseSessionDesktopEntry("hidden.desktop", hiddenDesktop, "x11")).toBeNull();

    const payload = buildGreetdStartSessionPayload(parsed!);
    expect(payload.cmd).toEqual(["/usr/bin/piloti-session"]);
    expect(payload.env).toEqual([
      "XDG_SESSION_TYPE=wayland",
      "XDG_SESSION_DESKTOP=piloti",
      "DESKTOP_SESSION=piloti",
      "XDG_CURRENT_DESKTOP=Piloti:GNOME",
    ]);
  });

  test("piloti-greetd-client performs length-prefixed greetd-ipc handshake over Unix socket", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piloti-greetd-test-"));
    const sockPath = path.join(tmpDir, "greetd.sock");
    const received: unknown[] = [];

    const writeFrame = (socket: net.Socket, obj: unknown) => {
      const body = Buffer.from(JSON.stringify(obj), "utf8");
      const header = Buffer.alloc(4);
      header.writeUInt32LE(body.length, 0);
      socket.write(Buffer.concat([header, body]));
    };

    const server = net.createServer((socket) => {
      let buf = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 4) {
          const len = buf.readUInt32LE(0);
          if (buf.length < 4 + len) break;
          const msg = JSON.parse(buf.subarray(4, 4 + len).toString("utf8")) as Record<
            string,
            unknown
          >;
          buf = buf.subarray(4 + len);
          received.push(msg);

          if (msg.type === "create_session") {
            writeFrame(socket, {
              type: "auth_message",
              auth_message_type: "secret",
              auth_message: "Password:",
            });
          } else if (msg.type === "post_auth_message_response") {
            if (msg.response === "correct-pass") {
              writeFrame(socket, { type: "success" });
            } else {
              writeFrame(socket, {
                type: "error",
                error_type: "auth_error",
                description: "Invalid password",
              });
            }
          } else if (msg.type === "start_session") {
            writeFrame(socket, { type: "success" });
          } else if (msg.type === "cancel_session") {
            writeFrame(socket, { type: "success" });
          }
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(sockPath, resolve));
    const helperPath = path.resolve(
      process.cwd(),
      "data/files/usr/libexec/piloti-desktop/piloti-greetd-client"
    );

    const runClient = (payload: unknown) =>
      new Promise<{ status: number | null; stdout: string; stderr: string }>(
        (resolve, reject) => {
          const child = spawn("python3", [helperPath], {
            env: { ...process.env, GREETD_SOCK: sockPath },
            stdio: ["pipe", "pipe", "pipe"],
          });
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (d) => {
            stdout += String(d);
          });
          child.stderr.on("data", (d) => {
            stderr += String(d);
          });
          child.on("error", reject);
          child.on("close", (status) => resolve({ status, stdout, stderr }));
          child.stdin.end(JSON.stringify(payload));
        }
      );

    try {
      // 1. Successful login + session start
      const okRun = await runClient({
        username: "debian",
        password: "correct-pass",
        cmd: ["/usr/bin/piloti-session"],
        env: ["XDG_SESSION_TYPE=wayland"],
      });
      expect(okRun.status).toBe(0);
      expect(JSON.parse(okRun.stdout.trim())).toEqual({ ok: true });

      // 2. Wrong password -> auth_error + cancel_session
      const badRun = await runClient({
        username: "debian",
        password: "wrong",
        cmd: ["/usr/bin/piloti-session"],
      });
      expect(badRun.status).toBe(1);
      expect(JSON.parse(badRun.stdout.trim())).toEqual({
        ok: false,
        error: "Invalid password",
      });

      const types = received.map((m) => (m as { type: string }).type);
      expect(types).toContain("create_session");
      expect(types).toContain("post_auth_message_response");
      expect(types).toContain("start_session");
      expect(types).toContain("cancel_session");
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
