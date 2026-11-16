import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useWindowManager } from "@/context/WindowsContext";
import {
  WEB_VFS_HOME,
  createVfsTextFile,
  getVfsEntry,
  normalizeVfsPath,
  subscribeWebVfs,
  writeVfsTextFile,
} from "@/lib/web-vfs";

interface TextEditorAppProps {
  initialPath?: string;
  windowId: string;
}

function getParentDir(path: string): string {
  const norm = normalizeVfsPath(path);
  const idx = norm.lastIndexOf("/");
  if (idx <= 0) return "/";
  return norm.slice(0, idx);
}

function getBaseName(path: string): string {
  const norm = normalizeVfsPath(path);
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

export const TextEditorApp: React.FC<TextEditorAppProps> = ({
  initialPath,
  windowId,
}) => {
  const { launchApp } = useWindowManager();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isDropTarget, setIsDropTarget] = React.useState(false);

  const [filePath, setFilePath] = React.useState<string | null>(() => {
    if (!initialPath) return null;
    const norm = normalizeVfsPath(initialPath);
    const existing = getVfsEntry(norm);
    if (existing && existing.kind === "file") {
      return existing.path;
    }
    const created = createVfsTextFile(
      getParentDir(norm),
      getBaseName(norm) || "Untitled.txt",
      "",
    );
    return created?.path ?? norm;
  });

  const [content, setContent] = React.useState<string>(() => {
    if (!initialPath) return "";
    const entry = getVfsEntry(normalizeVfsPath(initialPath));
    return entry?.kind === "file" ? (entry.content ?? "") : "";
  });

  React.useEffect(() => {
    if (!filePath) return;
    return subscribeWebVfs(() => {
      if (document.activeElement === textareaRef.current) return;
      const entry = getVfsEntry(filePath);
      if (entry && entry.kind === "file") {
        setContent(entry.content ?? "");
      }
    });
  }, [filePath]);

  React.useEffect(() => {
    const handleFileDrag = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          active: boolean;
          item?: { kind?: string };
          clientX?: number;
          clientY?: number;
        }>
      ).detail;
      if (
        !detail?.active ||
        detail.item?.kind !== "file" ||
        detail.clientX === undefined ||
        detail.clientY === undefined
      ) {
        setIsDropTarget(false);
        return;
      }
      const hits = document.elementsFromPoint(detail.clientX, detail.clientY);
      const overThis = hits.some(
        (el) => el.getAttribute("data-drop-window-id") === windowId,
      );
      setIsDropTarget(overThis);
    };

    const handleFileDrop = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          windowId?: string;
          item?: { kind?: string; path?: string };
        }>
      ).detail;
      setIsDropTarget(false);
      if (
        detail?.windowId !== windowId ||
        detail.item?.kind !== "file" ||
        !detail.item.path
      ) {
        return;
      }
      const norm = normalizeVfsPath(detail.item.path);
      const entry = getVfsEntry(norm);
      if (entry && entry.kind === "file") {
        setFilePath(entry.path);
        setContent(entry.content ?? "");
      } else {
        setFilePath(norm);
        setContent("");
      }
      textareaRef.current?.focus();
    };

    window.addEventListener("residence:file-drag", handleFileDrag);
    window.addEventListener("residence:file-drop-window", handleFileDrop);
    return () => {
      window.removeEventListener("residence:file-drag", handleFileDrag);
      window.removeEventListener("residence:file-drop-window", handleFileDrop);
    };
  }, [windowId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setContent(next);
    if (filePath) {
      writeVfsTextFile(filePath, next);
      return;
    }
    const created = createVfsTextFile(
      `${WEB_VFS_HOME}/Desktop`,
      "Untitled.txt",
      next,
    );
    if (created) {
      setFilePath(created.path);
    }
  };

  const handleNewFile = () => {
    const created = createVfsTextFile(
      `${WEB_VFS_HOME}/Desktop`,
      "Untitled.txt",
      "",
    );
    if (created) {
      setFilePath(created.path);
      setContent("");
      textareaRef.current?.focus();
    }
  };

  const handleOpenInFiles = () => {
    const targetDir = filePath
      ? getParentDir(filePath)
      : `${WEB_VFS_HOME}/Desktop`;
    launchApp("nautilus", { payload: targetDir });
  };

  const handleCopyAll = () => {
    void navigator.clipboard?.writeText(content);
  };

  const handleClear = () => {
    setContent("");
    if (filePath) {
      writeVfsTextFile(filePath, "");
    }
    textareaRef.current?.focus();
  };

  return (
    <div data-drop-window-id={windowId} className="relative h-full w-full">
      <ContextMenu>
        <ContextMenuTrigger className="h-full w-full">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            spellCheck={false}
            autoFocus
            aria-label={filePath ? getBaseName(filePath) : "Text Editor"}
            className="h-full w-full resize-none border-0 bg-adw-content p-3 font-mono text-[13px] leading-relaxed text-adw-label placeholder:text-adw-label-tertiary focus:outline-none select-text"
            placeholder="Start typing..."
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={handleNewFile}>New File</ContextMenuItem>
          <ContextMenuItem onClick={handleOpenInFiles}>
            Open in Files
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyAll}>Copy All</ContextMenuItem>
          <ContextMenuItem onClick={handleClear}>Clear</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {isDropTarget && (
        <div className="pointer-events-none absolute inset-1.5 flex items-end justify-center rounded-md border-2 border-dashed border-adw-accent/70 bg-adw-accent/10 pb-3 transition-opacity">
          <span className="rounded-full bg-adw-window/95 px-3 py-1 text-[11.5px] font-medium text-adw-label shadow-sm ring-1 ring-adw-separator">
            Drop to open in Text Editor
          </span>
        </div>
      )}
    </div>
  );
};
