import { describe, expect, test } from "bun:test";
import {
  asPowerProfile,
  mprisPlayerName,
  parseMprisPlayer,
  parsePowerProfileChange,
  parsePropertyGet,
  pickMprisPlayer,
} from "@/lib/engine-native/dbus-services";

const v = (value: unknown, signature = "s") => ({ signature, value });

describe("power profiles over D-Bus", () => {
  test("knows the three profiles and nothing else", () => {
    expect(asPowerProfile("balanced")).toBe("balanced");
    expect(asPowerProfile("performance")).toBe("performance");
    expect(asPowerProfile("power-saver")).toBe("power-saver");
    expect(asPowerProfile("turbo")).toBeNull();
    expect(asPowerProfile(undefined)).toBeNull();
  });

  test("reads Properties.Get and PropertiesChanged", () => {
    expect(parsePropertyGet([v("performance")])).toBe("performance");
    expect(
      parsePowerProfileChange(["net.hadess.PowerProfiles", { ActiveProfile: v("power-saver") }, []]),
    ).toBe("power-saver");
    // Another property changing is not a profile change.
    expect(parsePowerProfileChange(["net.hadess.PowerProfiles", { PerformanceDegraded: v("", "s") }, []])).toBeNull();
  });
});

describe("MPRIS players", () => {
  const playing = parseMprisPlayer("org.mpris.MediaPlayer2.vlc", {
    PlaybackStatus: v("Playing"),
    Metadata: v(
      { "xesam:title": v("Song"), "xesam:artist": v(["A", "B"], "as") },
      "a{sv}",
    ),
  })!;

  test("reads status, title and joined artists", () => {
    expect(playing).toEqual({
      busName: "org.mpris.MediaPlayer2.vlc",
      status: "Playing",
      title: "Song",
      artist: "A, B",
    });
  });

  test("a player with no track shows nothing", () => {
    expect(parseMprisPlayer("org.mpris.MediaPlayer2.x", { PlaybackStatus: v("Stopped"), Metadata: v({}, "a{sv}") })).toBeNull();
  });

  test("a track without a title is Unknown Track", () => {
    const p = parseMprisPlayer("org.mpris.MediaPlayer2.x", {
      PlaybackStatus: v("Paused"),
      Metadata: v({ "xesam:artist": v(["Someone"], "as") }, "a{sv}"),
    });
    expect(p?.title).toBe("Unknown Track");
    expect(p?.status).toBe("Paused");
  });

  test("picks the playing player over a paused one, and none when all stopped", () => {
    const paused = { ...playing, busName: "org.mpris.MediaPlayer2.mpv", status: "Paused" as const };
    const stopped = { ...playing, busName: "org.mpris.MediaPlayer2.old", status: "Stopped" as const };
    expect(pickMprisPlayer([paused, playing])?.busName).toBe("org.mpris.MediaPlayer2.vlc");
    expect(pickMprisPlayer([stopped, paused])?.busName).toBe("org.mpris.MediaPlayer2.mpv");
    expect(pickMprisPlayer([stopped])).toBeNull();
  });

  test("player name is the bus name without prefix or instance", () => {
    expect(mprisPlayerName("org.mpris.MediaPlayer2.firefox.instance1234")).toBe("firefox");
    expect(mprisPlayerName("org.mpris.MediaPlayer2.vlc")).toBe("vlc");
  });
});
