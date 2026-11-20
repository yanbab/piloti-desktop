import * as React from "react";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { EyeIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { ObjectView, themeGitHubLight, themeOneDark } from "react-obj-view";
import "react-obj-view/dist/react-obj-view.css";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { publishWindowMenuState, useIsolatedAppBridge } from "@/lib/app-bridge";
import { _ } from "@/lib/i18n";
import { getCachedPilotiAppIni, writePilotiAppIni } from "@/lib/piloti-ini";
import { cn } from "@/lib/utils";
import {
  normalizeVfsPath,
  renameVfsEntry,
  subscribeVfsRenamed,
} from "@/lib/web-vfs";

interface TextEditorAppProps {
  initialPath?: string;
  windowId?: string;
  isCsd?: boolean;
}

function getBaseName(path: string): string {
  const norm = normalizeVfsPath(path);
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

function resolveLanguageExtension(filePath: string | null): Extension[] {
  const ext = filePath?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "js" || ext === "mjs" || ext === "cjs") return [javascript()];
  if (ext === "jsx") return [javascript({ jsx: true })];
  if (ext === "ts") return [javascript({ typescript: true })];
  if (ext === "tsx") return [javascript({ typescript: true, jsx: true })];
  if (ext === "json") return [json()];
  if (ext === "md" || ext === "markdown") return [markdown()];
  if (ext === "html" || ext === "htm" || ext === "xml" || ext === "svg")
    return [html()];
  if (ext === "css" || ext === "scss") return [css()];
  return [];
}

const adwLightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#9333ea", fontWeight: "500" },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: "#1f2937" },
  { tag: [tags.propertyName], color: "#0284c7" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#2563eb" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#d97706" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#374151" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#b45309" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link], color: "#0d9488" },
  { tag: [tags.meta, tags.comment], color: "#6b7280", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.heading, fontWeight: "bold", color: "#0284c7" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#7c3aed" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#059669" },
  { tag: [tags.tagName], color: "#0284c7", fontWeight: "500" },
  { tag: [tags.attributeName], color: "#7c3aed" },
]);

const adwDarkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c084fc", fontWeight: "500" },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: "#e5e7eb" },
  { tag: [tags.propertyName], color: "#38bdf8" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#60a5fa" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#fbbf24" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#d1d5db" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#f59e0b" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link], color: "#2dd4bf" },
  { tag: [tags.meta, tags.comment], color: "#9ca3af", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.heading, fontWeight: "bold", color: "#38bdf8" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#c084fc" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#34d399" },
  { tag: [tags.tagName], color: "#38bdf8", fontWeight: "500" },
  { tag: [tags.attributeName], color: "#c084fc" },
]);

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
        <li
          key={i}
          className="ml-4 list-disc text-[13px] leading-relaxed text-adw-label"
        >
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

const adwEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--adw-content-bg, var(--adw-window-bg))",
    color: "var(--adw-label)",
    fontFamily: "var(--font-adw-mono)",
    fontSize: "13px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-adw-mono)",
    paddingBottom: "32px",
  },
  ".cm-content": {
    padding: "10px 4px",
    caretColor: "var(--adw-accent)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--adw-dim)",
    border: "none",
    paddingLeft: "6px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--adw-label)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgb(128 128 128 / 0.08)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--adw-accent) 28%, transparent)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export const TextEditorApp: React.FC<TextEditorAppProps> = ({
  initialPath,
  windowId = "",
  isCsd: propIsCsd = true,
}) => {
  const handleMenuAction = React.useCallback((actionId: string) => {
    if (actionId === "text-editor:toggle-line-numbers") {
      setShowLineNumbers((v) => !v);
    } else if (actionId === "text-editor:toggle-syntax") {
      setEnableHighlight((v) => !v);
    } else if (actionId === "text-editor:toggle-word-wrap") {
      setWordWrap((v) => !v);
    } else if (actionId === "text-editor:toggle-active-line") {
      setHighlightLine((v) => !v);
    } else if (actionId === "text-editor:toggle-cursor-position") {
      setShowCursorPos((v) => !v);
    } else if (actionId.startsWith("piloti:open-path:")) {
      const droppedPath = actionId.slice("piloti:open-path:".length).trim();
      if (droppedPath) {
        setFilePath(normalizeVfsPath(droppedPath));
      }
    }
  }, []);
  const bridge = useIsolatedAppBridge(windowId, propIsCsd, handleMenuAction);
  const resolvedPath = React.useMemo(() => {
    if (initialPath) return normalizeVfsPath(initialPath);
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("path");
      if (p) return normalizeVfsPath(p);
    }
    return null;
  }, [initialPath]);

  const [filePath, setFilePath] = React.useState<string | null>(resolvedPath);
  const [content, setContent] = React.useState<string>("");
  const [previewMarkdown, setPreviewMarkdown] = React.useState(false);
  const [findOpen, setFindOpen] = React.useState(false);
  const [findQuery, setFindQuery] = React.useState("");
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [cursorPos, setCursorPos] = React.useState<{ ln: number; col: number }>({
    ln: 1,
    col: 1,
  });

  // Editor preferences (only syntax highlighting enabled by default; persisted to .config/Piloti/notepad.ini)
  const initialEditorPrefs = React.useMemo(
    () => getCachedPilotiAppIni("notepad").Editor ?? {},
    []
  );
  const [showLineNumbers, setShowLineNumbers] = React.useState(
    () => initialEditorPrefs.lineNumbers === "true"
  );
  const [enableHighlight, setEnableHighlight] = React.useState(
    () => initialEditorPrefs.syntaxHighlight !== "false"
  );
  const [wordWrap, setWordWrap] = React.useState(
    () => initialEditorPrefs.wordWrap === "true"
  );
  const [highlightLine, setHighlightLine] = React.useState(
    () => initialEditorPrefs.activeLine === "true"
  );
  const [showCursorPos, setShowCursorPos] = React.useState(
    () => initialEditorPrefs.cursorPosition === "true"
  );

  React.useEffect(() => {
    void writePilotiAppIni(null, "notepad", "Editor", {
      lineNumbers: showLineNumbers,
      syntaxHighlight: enableHighlight,
      wordWrap,
      activeLine: highlightLine,
      cursorPosition: showCursorPos,
    });
  }, [
    showLineNumbers,
    enableHighlight,
    wordWrap,
    highlightLine,
    showCursorPos,
  ]);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState("");
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);

  const isPreviewable = React.useMemo(
    () =>
      Boolean(
        filePath &&
          (/\.(md|markdown|json)$/i.test(filePath)),
      ),
    [filePath],
  );

  React.useEffect(() => {
    if (!isPreviewable && previewMarkdown) {
      setPreviewMarkdown(false);
    }
  }, [isPreviewable, previewMarkdown]);

  React.useEffect(() => {
    if (!filePath) return;
    return subscribeVfsRenamed(({ oldPath, newPath }) => {
      if (normalizeVfsPath(filePath) === normalizeVfsPath(oldPath)) {
        setFilePath(newPath);
        bridge.setTitle(getBaseName(newPath));
      }
    });
  }, [bridge, filePath]);

  const commitTitleRename = React.useCallback(() => {
    setEditingTitle(false);
    if (!filePath) return;
    const nextName = draftTitle.trim().replace(/[/\\]/g, "");
    if (!nextName || nextName === getBaseName(filePath)) return;
    const renamed = renameVfsEntry(filePath, nextName);
    if (renamed) {
      setFilePath(renamed.path);
      bridge.setTitle(renamed.name);
    }
  }, [bridge, draftTitle, filePath]);

  React.useEffect(() => {
    if (!editingTitle) return;
    const onPointerDown = (e: PointerEvent) => {
      if (titleInputRef.current?.contains(e.target as Node)) return;
      commitTitleRename();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [commitTitleRename, editingTitle]);

  React.useEffect(() => {
    if (!windowId) return;
    publishWindowMenuState(windowId, {
      "text-editor:toggle-line-numbers": { checked: showLineNumbers },
      "text-editor:toggle-syntax": { checked: enableHighlight },
      "text-editor:toggle-word-wrap": { checked: wordWrap },
      "text-editor:toggle-active-line": { checked: highlightLine },
      "text-editor:toggle-cursor-position": { checked: showCursorPos },
    });
  }, [
    enableHighlight,
    highlightLine,
    showCursorPos,
    showLineNumbers,
    windowId,
    wordWrap,
  ]);
  const [isDark, setIsDark] = React.useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true,
  );

  React.useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined")
      return;
    const root = document.documentElement;
    const obs = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const editorHostRef = React.useRef<HTMLDivElement | null>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const findInputRef = React.useRef<HTMLInputElement | null>(null);
  const contentRef = React.useRef(content);
  contentRef.current = content;
  const filePathRef = React.useRef(filePath);
  filePathRef.current = filePath;

  React.useEffect(() => {
    setFilePath(resolvedPath);
  }, [resolvedPath]);

  React.useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    void bridge.fs.readText(filePath).then((next) => {
      if (cancelled || next === null) return;
      setContent(next);
      bridge.setTitle(getBaseName(filePath));
      const view = viewRef.current;
      if (view && view.state.doc.toString() !== next) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bridge, filePath]);

  const persistTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const persistText = React.useCallback(
    (next: string) => {
      setContent(next);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        const targetPath =
          filePathRef.current ?? "/home/user/Desktop/Untitled.txt";
        if (!filePathRef.current) {
          filePathRef.current = targetPath;
          setFilePath(targetPath);
        }
        void bridge.fs.writeText(targetPath, next);
      }, 120);
    },
    [bridge.fs],
  );

  React.useEffect(() => {
    if (previewMarkdown) {
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }
    const host = editorHostRef.current;
    if (!host) return;

    const extensions: Extension[] = [
      history(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      adwEditorTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          persistText(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          setCursorPos({
            ln: line.number,
            col: head - line.from + 1,
          });
        }
      }),
    ];
    if (showLineNumbers) {
      extensions.push(lineNumbers(), highlightActiveLineGutter());
    }
    if (highlightLine) {
      extensions.push(highlightActiveLine());
    }
    if (wordWrap) {
      extensions.push(EditorView.lineWrapping);
    }
    if (enableHighlight) {
      extensions.push(
        syntaxHighlighting(
          isDark ? adwDarkHighlightStyle : adwLightHighlightStyle,
          { fallback: true },
        ),
        ...resolveLanguageExtension(filePath),
      );
    }

    const state = EditorState.create({
      doc: contentRef.current,
      extensions,
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [
    enableHighlight,
    filePath,
    highlightLine,
    isDark,
    persistText,
    previewMarkdown,
    showLineNumbers,
    wordWrap,
  ]);

  const findMatchCount = React.useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return 0;
    const hay = content.toLowerCase();
    let count = 0;
    let idx = 0;
    while ((idx = hay.indexOf(q, idx)) !== -1) {
      count += 1;
      idx += q.length;
    }
    return count;
  }, [content, findQuery]);

  const isMarkdownFile = Boolean(
    filePath && /\.(md|markdown)$/i.test(filePath),
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      const targetPath =
        filePathRef.current ?? "/home/user/Desktop/Untitled.txt";
      if (!filePathRef.current) {
        filePathRef.current = targetPath;
        setFilePath(targetPath);
      }
      void bridge.fs.writeText(targetPath, contentRef.current).then(() => {
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1500);
      });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      e.stopPropagation();
      setFindOpen((prev) => {
        const next = !prev;
        if (next) {
          requestAnimationFrame(() => findInputRef.current?.focus());
        }
        return next;
      });
    } else if (e.key === "Escape" && findOpen) {
      e.preventDefault();
      setFindOpen(false);
      viewRef.current?.focus();
    }
  };

  return (
    <div
      data-drop-window-id={windowId}
      onKeyDown={handleKeyDown}
      className="flex h-full w-full flex-col overflow-hidden bg-adw-content text-adw-label"
    >
      {/* Headerbar */}
      <WindowTitlebar
        data-window-drag-region={bridge.isCsd ? "" : undefined}
        className={cn(
          "h-9 shrink-0 justify-between border-b border-adw-separator bg-adw-titlebar px-2.5 select-none",
          !bridge.isCsd && "rounded-t-none",
        )}
      >
        <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
          {windowId && bridge.isCsd && <WindowControls side="left" />}
          {windowId && (
            <WindowMenuButton
              windowId={windowId}
              appId="text-editor"
              iconName="file-text"
            />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 px-2" data-window-no-drag>
          {editingTitle && filePath ? (
            <input
              ref={titleInputRef}
              type="text"
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitleRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitleRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingTitle(false);
                }
              }}
              style={{ width: `${Math.max(8, draftTitle.length + 2)}ch` }}
              className="h-6 max-w-48 rounded-md border border-adw-accent/70 bg-black/8 px-2 text-center text-adw-body font-semibold text-adw-label outline-none dark:bg-white/12"
            />
          ) : (
            <button
              type="button"
              disabled={!filePath}
              title={filePath ? _("Click to rename file") : undefined}
              onClick={() => {
                if (!filePath) return;
                setDraftTitle(getBaseName(filePath));
                setEditingTitle(true);
              }}
              className={cn(
                "truncate rounded-md px-2 py-0.5 text-adw-body font-semibold text-adw-label transition-colors",
                filePath &&
                  "hover:bg-black/8 dark:hover:bg-white/10",
              )}
            >
              {filePath ? getBaseName(filePath) : _("Untitled")}
            </button>
          )}
          {savedFlash && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
              {_("Saved")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" data-window-no-drag>
          {isPreviewable && (
            <button
              type="button"
              aria-label={previewMarkdown ? _("Edit") : _("Preview")}
              title={previewMarkdown ? _("Edit") : _("Preview")}
              onClick={() => setPreviewMarkdown((v) => !v)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                previewMarkdown
                  ? "bg-black/10 text-adw-label dark:bg-white/15"
                  : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10",
              )}
            >
              <EyeIcon className="size-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={_("Editor Preferences")}
              title={_("Preferences")}
              className="flex size-7 items-center justify-center rounded-md text-adw-label-secondary transition-colors outline-none hover:bg-black/8 hover:text-adw-label data-popup-open:bg-black/10 dark:hover:bg-white/10 dark:data-popup-open:bg-white/15"
            >
              <SlidersHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuCheckboxItem
                checked={showLineNumbers}
                onClick={() => setShowLineNumbers((v) => !v)}
              >
                {_("Line Numbers")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={enableHighlight}
                onClick={() => setEnableHighlight((v) => !v)}
              >
                {_("Syntax Highlighting")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={wordWrap}
                onClick={() => setWordWrap((v) => !v)}
              >
                {_("Word Wrap")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={highlightLine}
                onClick={() => setHighlightLine((v) => !v)}
              >
                {_("Active Line")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showCursorPos}
                onClick={() => setShowCursorPos((v) => !v)}
              >
                {_("Cursor Position")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {windowId && bridge.isCsd && <WindowControls side="right" />}
        </div>
      </WindowTitlebar>

      {/* Editor Body */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {findOpen && (
          <div
            data-testid="text-editor-find-bar"
            className="absolute top-2 right-3 z-20 flex items-center gap-1.5 rounded-lg border border-adw-border bg-adw-card/95 px-2 py-1 shadow-md backdrop-blur-md"
          >
            <input
              ref={findInputRef}
              type="search"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              className="w-36 bg-transparent text-xs text-adw-label outline-none"
            />
            <span className="font-mono text-[10.5px] text-adw-dim tabular-nums">
              {findQuery.trim() ? _("%d found", findMatchCount) : ""}
            </span>
            <button
              type="button"
              aria-label={_("Close Find")}
              onClick={() => {
                setFindOpen(false);
                viewRef.current?.focus();
              }}
              className="rounded px-1 text-xs text-adw-dim hover:bg-adw-hover hover:text-adw-label"
            >
              ×
            </button>
          </div>
        )}

        {previewMarkdown ? (
          /\.json$/i.test(filePath ?? "") ? (
            <div className="h-full w-full overflow-auto bg-adw-content p-4 font-mono text-[12px] select-text">
              {(() => {
                try {
                  const parsed = JSON.parse(content || "null");
                  return (
                    <ObjectView
                      valueGetter={() => parsed}
                      style={isDark ? themeOneDark : themeGitHubLight}
                      expandLevel={2}
                    />
                  );
                } catch (err) {
                  return (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400">
                      Invalid JSON: {String(err)}
                    </div>
                  );
                }
              })()}
            </div>
          ) : (
            <div className="h-full w-full overflow-auto bg-adw-content p-4 select-text">
              {renderSimpleMarkdown(content)}
            </div>
          )
        ) : (
          <div ref={editorHostRef} className="h-full w-full" />
        )}

        {showCursorPos && (
          <div
            data-testid="text-editor-status-pill"
            className="pointer-events-none absolute right-2.5 bottom-2 z-10 rounded-full border border-adw-border/60 bg-adw-card/90 px-2.5 py-0.5 font-mono text-[10.5px] text-adw-dim shadow-xs backdrop-blur-md"
          >
            Ln {cursorPos.ln}, Col {cursorPos.col}
          </div>
        )}
      </div>
    </div>
  );
};
