import React from "react";
import { CodeJar } from "codejar";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useSettings, useWindowActions } from "@/context/DesktopStateContext";
import {
  WEB_VFS_HOME,
  createFsTextFile,
  getVfsEntry,
  normalizeVfsPath,
  readFsTextFile,
  subscribeWebVfs,
  writeFsTextFile,
} from "@/lib/fs-bridge";

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightCode(text: string, filePath: string | null): string {
  const ext = filePath?.split(".").pop()?.toLowerCase() ?? "";
  if (!ext || ext === "txt") {
    return escapeHtml(text);
  }

  if (ext === "html" || ext === "htm" || ext === "xml" || ext === "svg") {
    return escapeHtml(text).replace(
      /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[a-zA-Z0-9:-]+)|(\s+[a-zA-Z0-9:-]+)(?==)|(&quot;[^&]*?&quot;|"[^"]*?"|'[^']*?')/g,
      (match, comment, tag, attr, str) => {
        if (comment) return `<span class="text-adw-label-tertiary italic">${comment}</span>`;
        if (tag) return `<span class="text-sky-600 dark:text-sky-400 font-medium">${tag}</span>`;
        if (attr) return `<span class="text-purple-700 dark:text-purple-400">${attr}</span>`;
        if (str) return `<span class="text-emerald-700 dark:text-emerald-400">${str}</span>`;
        return match;
      }
    );
  }

  if (ext === "md" || ext === "markdown") {
    return escapeHtml(text).replace(
      /^(#{1,6}\s+.*)$|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)/gm,
      (match, heading, code, bold) => {
        if (heading) return `<span class="text-sky-600 dark:text-sky-400 font-bold">${heading}</span>`;
        if (code) return `<span class="text-emerald-700 dark:text-emerald-400">${code}</span>`;
        if (bold) return `<span class="font-semibold text-amber-700 dark:text-amber-300">${bold}</span>`;
        return match;
      }
    );
  }

  if (ext === "json") {
    return escapeHtml(text).replace(
      /("([^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match, str, _inner, colon, bool, num) => {
        if (str && colon) return `<span class="text-sky-600 dark:text-sky-400">${str}</span>${colon}`;
        if (str) return `<span class="text-emerald-700 dark:text-emerald-400">${str}</span>`;
        if (bool) return `<span class="text-purple-700 dark:text-purple-400">${bool}</span>`;
        if (num) return `<span class="text-amber-700 dark:text-amber-300">${num}</span>`;
        return match;
      }
    );
  }

  // JS / TS / CSS / Shell / Python
  if (/^(js|jsx|ts|tsx|mjs|cjs|css|scss|sh|bash|zsh|py)$/.test(ext)) {
    return escapeHtml(text).replace(
      /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|import|export|from|default|type|interface|class|extends|async|await|try|catch|throw|new|true|false|null|undefined|def|elif|in|not|and|or|fi|then|do|done)\b|\b(\d+(?:\.\d+)?)\b/g,
      (match, comment, str, kw, num) => {
        if (comment) return `<span class="text-adw-label-tertiary italic">${comment}</span>`;
        if (str) return `<span class="text-emerald-700 dark:text-emerald-400">${str}</span>`;
        if (kw) return `<span class="text-purple-700 dark:text-purple-400 font-medium">${kw}</span>`;
        if (num) return `<span class="text-amber-700 dark:text-amber-300">${num}</span>`;
        return match;
      }
    );
  }

  return escapeHtml(text);
}

function renderSimpleMarkdown(md: string): React.ReactNode {
  const lines = md.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="mt-2 mb-1 text-lg font-bold text-adw-label">
          {line.slice(2)}
        </h1>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-2 mb-1 text-base font-semibold text-adw-label">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="mt-1.5 mb-0.5 text-sm font-semibold text-adw-label">
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <li key={i} className="ml-4 list-disc text-[13px] leading-relaxed text-adw-label">
          {line.slice(2)}
        </li>
      );
    }
    if (!line.trim()) {
      return <div key={i} className="h-2" />;
    }
    return (
      <p key={i} className="text-[13px] leading-relaxed text-adw-label">
        {line}
      </p>
    );
  });
}

export const TextEditorApp: React.FC<TextEditorAppProps> = ({
  initialPath,
  windowId,
}) => {
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const { launchApp } = useWindowActions();
  const editorRef = React.useRef<HTMLPreElement>(null);
  const jarRef = React.useRef<ReturnType<typeof CodeJar> | null>(null);
  const [isDropTarget, setIsDropTarget] = React.useState(false);
  const [previewMarkdown, setPreviewMarkdown] = React.useState(false);

  const [filePath, setFilePath] = React.useState<string | null>(() => {
    if (!initialPath) return null;
    const norm = normalizeVfsPath(initialPath);
    const existing = getVfsEntry(norm);
    if (existing && existing.kind === "file") {
      return existing.path;
    }
    const created = createFsTextFile(
      domicile,
      isBrowserRuntime,
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

  const filePathRef = React.useRef(filePath);
  filePathRef.current = filePath;
  const contentRef = React.useRef(content);
  contentRef.current = content;

  React.useEffect(() => {
    if (!filePath || isBrowserRuntime) return;
    let cancelled = false;
    void readFsTextFile(domicile, isBrowserRuntime, filePath).then((next) => {
      if (!cancelled) {
        setContent(next);
        jarRef.current?.updateCode(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [domicile, filePath, isBrowserRuntime]);

  const persistContent = React.useCallback(
    (next: string) => {
      setContent(next);
      if (filePathRef.current) {
        writeFsTextFile(domicile, isBrowserRuntime, filePathRef.current, next);
        return;
      }
      const created = createFsTextFile(
        domicile,
        isBrowserRuntime,
        `${WEB_VFS_HOME}/Desktop`,
        "Untitled.txt",
        next,
      );
      if (created) {
        filePathRef.current = created.path;
        setFilePath(created.path);
      }
    },
    [domicile, isBrowserRuntime],
  );

  React.useEffect(() => {
    if (previewMarkdown) {
      jarRef.current?.destroy();
      jarRef.current = null;
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    const jar = CodeJar(
      el,
      (node) => {
        node.innerHTML = highlightCode(
          node.textContent ?? "",
          filePathRef.current,
        );
      },
      { tab: "  ", addClosing: true }
    );
    jar.updateCode(contentRef.current);
    jar.onUpdate((next) => {
      persistContent(next);
    });
    jarRef.current = jar;
    return () => {
      jar.destroy();
      jarRef.current = null;
    };
  }, [filePath, persistContent, previewMarkdown]);

  React.useEffect(() => {
    if (!filePath) return;
    return subscribeWebVfs(() => {
      if (document.activeElement === editorRef.current) return;
      const entry = getVfsEntry(filePath);
      if (entry && entry.kind === "file") {
        const next = entry.content ?? "";
        setContent(next);
        jarRef.current?.updateCode(next);
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
        const next = entry.content ?? "";
        setFilePath(entry.path);
        setContent(next);
        jarRef.current?.updateCode(next);
      } else {
        setFilePath(norm);
        setContent("");
        jarRef.current?.updateCode("");
      }
      editorRef.current?.focus();
    };

    window.addEventListener("residence:file-drag", handleFileDrag);
    window.addEventListener("residence:file-drop-window", handleFileDrop);
    return () => {
      window.removeEventListener("residence:file-drag", handleFileDrag);
      window.removeEventListener("residence:file-drop-window", handleFileDrop);
    };
  }, [windowId]);

  const handleNewFile = () => {
    const created = createFsTextFile(
      domicile,
      isBrowserRuntime,
      `${WEB_VFS_HOME}/Desktop`,
      "Untitled.txt",
      "",
    );
    if (created) {
      setFilePath(created.path);
      setContent("");
      jarRef.current?.updateCode("");
      editorRef.current?.focus();
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
    jarRef.current?.updateCode("");
    if (filePath) {
      writeFsTextFile(domicile, isBrowserRuntime, filePath, "");
    }
    editorRef.current?.focus();
  };

  const isMarkdownFile = Boolean(
    filePath && /\.(md|markdown)$/i.test(filePath)
  );

  return (
    <div data-drop-window-id={windowId} className="relative h-full w-full">
      {isMarkdownFile && (
        <button
          type="button"
          onClick={() => setPreviewMarkdown((v) => !v)}
          className="absolute top-2 right-3 z-10 rounded-md border border-adw-separator bg-adw-window/90 px-2.5 py-1 text-[11px] font-medium text-adw-label-secondary shadow-xs backdrop-blur-xs transition-colors hover:text-adw-label"
        >
          {previewMarkdown ? "Edit Markdown" : "Preview Markdown"}
        </button>
      )}
      <ContextMenu>
        <ContextMenuTrigger className="h-full w-full">
          {previewMarkdown ? (
            <div className="h-full w-full overflow-auto bg-adw-content p-4 select-text">
              {renderSimpleMarkdown(content)}
            </div>
          ) : (
            <pre
              ref={editorRef}
              spellCheck={false}
              aria-label={filePath ? getBaseName(filePath) : "Text Editor"}
              className="m-0 h-full w-full overflow-auto border-0 bg-adw-content p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-adw-label focus:outline-none select-text"
            />
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={handleNewFile}>New File</ContextMenuItem>
          <ContextMenuItem onClick={handleOpenInFiles}>
            Open in Files
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setPreviewMarkdown((v) => !v)}>
            {previewMarkdown ? "Edit Source" : "Markdown Preview"}
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
