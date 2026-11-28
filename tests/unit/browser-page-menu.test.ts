import { describe, expect, it } from "bun:test";
import { buildPageMenuItems, type PageMenuCommands } from "@/ui/shell/windows/BrowserPageMenu";

const commands: PageMenuCommands = {
  canGoBack: false,
  canGoForward: false,
  back() {},
  forward() {},
  reload() {},
  print() {},
  openInNewTab() {},
  openInNewWindow() {},
  searchWeb() {},
};

function event(over: Partial<DomicileContextMenuEvent>): DomicileContextMenuEvent {
  return {
    x: 0, y: 0, linkUrl: "", linkText: "", srcUrl: "", mediaType: "none",
    hasImageContents: false, canPictureInPicture: false, inPictureInPicture: false,
    selectionText: "", isEditable: false, canUndo: false, canRedo: false, canCut: false,
    canCopy: false, canPaste: false, canDelete: false, canSelectAll: true,
    misspelledWord: "", spellingSuggestions: [], run() {}, replaceMisspelling() {},
    ...over,
  } as unknown as DomicileContextMenuEvent;
}
const labels = (e: DomicileContextMenuEvent, c = commands) =>
  buildPageMenuItems(e, c).map((i) => (i.kind === "separator" ? "—" : i.label));

describe("page context menu", () => {
  it("offers navigation on the page itself", () => {
    expect(labels(event({}))).toEqual(["Back", "Forward", "Reload", "—", "Select All", "Print…", "—", "Inspect"]);
  });
  it("offers link actions, without tabs in a web app", () => {
    expect(labels(event({ linkUrl: "https://x/" }))[0]).toBe("Open Link in New Tab");
    expect(labels(event({ linkUrl: "https://x/" }), { ...commands, openInNewTab: undefined })[0]).toBe(
      "Open Link in New Window"
    );
  });
  it("offers edit commands in a field and a search for a selection", () => {
    expect(labels(event({ isEditable: true, canPaste: true }))).toContain("Paste");
    expect(labels(event({ selectionText: "linux kernel" }))).toContain("Search the Web for “linux kernel”");
  });
  it("puts spelling suggestions first", () => {
    expect(labels(event({ isEditable: true, misspelledWord: "teh", spellingSuggestions: ["the", "tech"] })).slice(0, 3)).toEqual(["the", "tech", "—"]);
  });
});
