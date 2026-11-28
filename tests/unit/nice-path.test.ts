import { describe, expect, it } from "bun:test";
import {
  formatNicePath,
  looksLikeAbsolutePath,
  resolveNicePath,
} from "@/core/files/nice-path";

describe("nice-path", () => {
  it("strips the home folder", () => {
    expect(formatNicePath("/home/user/Desktop/Screenshot.png")).toBe("Desktop ▸ Screenshot.png");
    expect(formatNicePath("/home/yanbab/Pictures/a b.png")).toBe("Pictures ▸ a b.png");
    expect(formatNicePath("~/Documents/x.txt")).toBe("Documents ▸ x.txt");
    expect(formatNicePath("/home/user")).toBe("Home");
  });

  it("prefixes system paths with the system disk", () => {
    expect(formatNicePath("/etc/default")).toBe("SSD ▸ etc ▸ default");
    expect(resolveNicePath("/usr/bin/ls").device).toBe("ssd");
  });

  it("detects removable media", () => {
    expect(formatNicePath("/media/user/PILOTI_USB/Doc.pdf")).toBe("USB ▸ Doc.pdf");
    expect(resolveNicePath("/media/user/PILOTI_USB/Doc.pdf").volumeLabel).toBe("PILOTI USB");
    expect(resolveNicePath("/run/media/me/SDCARD/DCIM/1.jpg").device).toBe("sd");
    expect(formatNicePath("/run/media/me/SDCARD/DCIM/1.jpg")).toBe("SD Card ▸ DCIM ▸ 1.jpg");
    expect(resolveNicePath("/media/user/DVD_ROM/setup.exe").device).toBe("optical");
    expect(formatNicePath("/media/cdrom/readme.txt")).toBe("CD-ROM ▸ readme.txt");
  });

  it("maps trash files", () => {
    expect(formatNicePath("/home/user/.local/share/Trash/files/old.txt")).toBe("Trash ▸ old.txt");
  });

  it("recognises path-only text", () => {
    expect(looksLikeAbsolutePath("/home/user/Desktop/Screenshot 1.png")).toBe(true);
    expect(looksLikeAbsolutePath("Ready to paste in any application.")).toBe(false);
    expect(looksLikeAbsolutePath("/")).toBe(false);
  });
});
