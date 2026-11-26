import * as React from "react";
import { retainVfsWatch } from "@/lib/engine/vfs-query";
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
import {
  bracketMatching,
  codeFolding,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState, Transaction, type Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { SaveIcon, SlidersHorizontalIcon } from "lucide-react";
import { ObjectView, themeGitHubLight, themeOneDark } from "react-obj-view";
import "react-obj-view/dist/react-obj-view.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { publishWindowMenuState, useIsolatedAppBridge } from "@/lib/engine/app-bridge";
import { useTextEditorHost, type TextEditorHost } from "@/lib/engine/text-editor-host";
import { _ } from "@/lib/core/i18n";
import { parseIniText } from "@/lib/config/ini";
import { cn } from "@/lib/core/utils";
import { useAppChrome } from "@/components/elements/app-chrome";
import { HeaderBar, HeaderButton } from "@/components/elements/header-bar";
import { Segmented } from "@/components/ui/segmented";

export interface TextEditorAppProps {
  initialPath?: string;
  windowId?: string;
}

function getBaseName(path: string): string {
  const norm = path.replace(/\/+/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

type EditorViewMode = "code" | "preview" | "design";

const EDITOR_STATE_KEY = "editor-state";

interface PersistedFileEditorState {
  unsavedContent?: string;
  cursor: number;
  scrollTop: number;
  viewMode?: EditorViewMode;
  updatedAt: number;
}

type PersistedEditorStateMap = Record<string, PersistedFileEditorState>;

function readPersistedEditorStateMap(host: TextEditorHost): PersistedEditorStateMap {
  return (
    host.readState<PersistedEditorStateMap>(
      EDITOR_STATE_KEY,
      (val): val is PersistedEditorStateMap =>
        Boolean(val && typeof val === "object" && !Array.isArray(val)),
    ) ?? {}
  );
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx).toLowerCase() : "";
}

const iniLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.sol()) {
      stream.eatSpace();
      if (stream.match(/^[;#].*/)) return "comment";
      if (stream.match(/^\[[^\]]+\]/)) return "heading";
      if (stream.match(/^[^=\s;#]+(?=\s*=)/)) return "propertyName";
    }
    if (stream.match(/^\s*=\s*/)) return "operator";
    if (stream.match(/^[;#].*/)) return "comment";
    if (stream.match(/^(?:true|false)\b/i)) return "bool";
    if (stream.match(/^-?\d+(?:\.\d+)?\b/)) return "number";
    if (stream.match(/^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/)) return "string";
    stream.next();
    return null;
  },
});

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
  if (ext === "ini" || ext === "conf" || ext === "cfg" || ext === "desktop")
    return [iniLanguage];
  return [];
}

const adwLightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--ui-accent)", fontWeight: "600" },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: "#1f2937" },
  { tag: [tags.propertyName], color: "var(--ui-accent)" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#2563eb" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#d97706" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#374151" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#b45309" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link], color: "#0d9488" },
  { tag: [tags.meta, tags.comment], color: "#6b7280", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.heading, fontWeight: "bold", color: "var(--ui-accent)" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#7c3aed" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#059669" },
  { tag: [tags.tagName], color: "var(--ui-accent)", fontWeight: "500" },
  { tag: [tags.attributeName], color: "#7c3aed" },
]);

const adwDarkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--ui-accent)", fontWeight: "600" },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: "#e5e7eb" },
  { tag: [tags.propertyName], color: "var(--ui-accent)" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#60a5fa" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#fbbf24" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#d1d5db" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#f59e0b" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link], color: "#2dd4bf" },
  { tag: [tags.meta, tags.comment], color: "#9ca3af", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.heading, fontWeight: "bold", color: "var(--ui-accent)" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#c084fc" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#34d399" },
  { tag: [tags.tagName], color: "var(--ui-accent)", fontWeight: "500" },
  { tag: [tags.attributeName], color: "#c084fc" },
]);

function renderSimpleMarkdown(md: string): React.ReactNode {
  const lines = md.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="mt-2 mb-1 text-lg font-bold text-ui-label">
          {line.slice(2)}
        </h1>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-2 mb-1 text-base font-semibold text-ui-label">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="mt-1.5 mb-0.5 text-sm font-semibold text-ui-label">
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <li
          key={i}
          className="ml-4 list-disc text-ui-body leading-relaxed text-ui-label"
        >
          {line.slice(2)}
        </li>
      );
    }
    if (!line.trim()) {
      return <div key={i} className="h-2" />;
    }
    return (
      <p key={i} className="text-ui-body leading-relaxed text-ui-label">
        {line}
      </p>
    );
  });
}

const adwEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--ui-content-bg, var(--ui-window))",
    color: "var(--ui-label)",
    fontFamily: "var(--font-ui-mono)",
    fontSize: "13px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-ui-mono)",
    paddingBottom: "32px",
  },
  ".cm-content": {
    padding: "10px 4px",
    caretColor: "var(--ui-accent)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--ui-dim)",
    border: "none",
    paddingLeft: "6px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--ui-label)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgb(128 128 128 / 0.08)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--ui-accent) 28%, transparent)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--ui-accent)",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--ui-accent) 20%, transparent)",
    outline: "1px solid color-mix(in srgb, var(--ui-accent) 55%, transparent)",
    borderRadius: "2px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 4px 0 2px",
    cursor: "pointer",
    color: "var(--ui-dim)",
    opacity: "0.55",
    transition: "opacity 120ms",
  },
  ".cm-gutters:hover .cm-foldGutter .cm-gutterElement": {
    opacity: "1",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "color-mix(in srgb, var(--ui-accent) 18%, transparent)",
    border: "none",
    color: "var(--ui-accent)",
    borderRadius: "4px",
    padding: "0 4px",
    margin: "0 2px",
  },
});

export const TextEditorApp: React.FC<TextEditorAppProps> = ({
  initialPath,
  windowId = "",
}) => {
  const host = useTextEditorHost();
  const previewIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const designIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const viewModeRef = React.useRef<EditorViewMode>("code");

  const handlePrint = React.useCallback(() => {
    const mode = viewModeRef.current;
    if (mode === "preview" && previewIframeRef.current?.contentWindow) {
      previewIframeRef.current.contentWindow.focus();
      previewIframeRef.current.contentWindow.print();
      return;
    }
    if (mode === "design" && designIframeRef.current?.contentWindow) {
      designIframeRef.current.contentWindow.focus();
      designIframeRef.current.contentWindow.print();
      return;
    }
    window.print();
  }, []);

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
    } else if (actionId === "file:print" || actionId === "piloti:print-focused") {
      handlePrint();
    } else if (actionId.startsWith("piloti:open-path:")) {
      const droppedPath = actionId.slice("piloti:open-path:".length).trim();
      if (droppedPath) {
        setFilePath(host.normalizePath(droppedPath));
      }
    }
  }, [handlePrint]);

  React.useEffect(() => {
    const onPrintFocused = (detail: { windowId?: string } | undefined) => {
      if (detail?.windowId && windowId && detail.windowId !== windowId) return;
      handlePrint();
    };
    return host.onPrintFocused(onPrintFocused);
  }, [handlePrint, windowId]);
  const { decorations } = useAppChrome();
  const baseBridge = useIsolatedAppBridge(windowId, decorations === "client", handleMenuAction);
  const bridge = React.useMemo(
    () => (host.bridge ? { ...baseBridge, ...host.bridge } : baseBridge),
    [baseBridge, host],
  );
  const resolvedPath = React.useMemo(() => {
    if (initialPath) return host.normalizePath(initialPath);
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("path");
      if (p) return host.normalizePath(p);
    }
    return null;
  }, [initialPath]);

  const [filePath, setFilePath] = React.useState<string | null>(resolvedPath);
  const [content, setContent] = React.useState<string>(() => {
    if (!resolvedPath) return "";
    const persisted = readPersistedEditorStateMap(host)[resolvedPath];
    return persisted?.unsavedContent ?? "";
  });
  const [savedContent, setSavedContent] = React.useState("");
  const [confirmCloseOpen, setConfirmCloseOpen] = React.useState(false);
  const isDirty = content !== savedContent;
  const isDirtyRef = React.useRef(isDirty);
  isDirtyRef.current = isDirty;
  const savedContentRef = React.useRef(savedContent);
  savedContentRef.current = savedContent;
  const forceCloseRef = React.useRef(false);
  const [viewMode, setViewMode] = React.useState<EditorViewMode>("code");
  viewModeRef.current = viewMode;
  const [findOpen, setFindOpen] = React.useState(false);
  const [findQuery, setFindQuery] = React.useState("");
  const [cursorPos, setCursorPos] = React.useState<{ ln: number; col: number }>({
    ln: 1,
    col: 1,
  });

  // Editor preferences (only syntax highlighting enabled by default; persisted to .config/piloti/notepad.ini)
  const initialEditorPrefs = React.useMemo(
    () => host.readEditorPrefs(),
    [host]
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
  // No UI: fold markers sit next to line numbers unless `codeFolding=false`.
  const showCodeFolding = initialEditorPrefs.codeFolding !== "false";

  React.useEffect(() => {
    host.writeEditorPrefs({
      lineNumbers: showLineNumbers,
      syntaxHighlight: enableHighlight,
      wordWrap,
      activeLine: highlightLine,
      cursorPosition: showCursorPos,
      codeFolding: showCodeFolding,
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
  const [pendingRename, setPendingRename] = React.useState<{
    nextName: string;
    oldExt: string;
    newExt: string;
  } | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);

  const isHtmlFile = React.useMemo(
    () => Boolean(filePath && /\.(html|htm)$/i.test(filePath)),
    [filePath],
  );
  const isSvgFile = React.useMemo(
    () => Boolean(filePath && /\.svg$/i.test(filePath)),
    [filePath],
  );
  const isPreviewable = React.useMemo(
    () =>
      Boolean(
        filePath && /\.(html|htm|md|markdown|json|svg|ini)$/i.test(filePath),
      ),
    [filePath],
  );

  React.useEffect(() => {
    if (!isPreviewable && viewMode !== "code") {
      setViewMode("code");
    } else if (!isHtmlFile && viewMode === "design") {
      setViewMode("preview");
    }
  }, [isHtmlFile, isPreviewable, viewMode]);

  React.useEffect(() => {
    if (!editingTitle) return;
    requestAnimationFrame(() => {
      const input = titleInputRef.current;
      if (!input) return;
      input.focus();
      const dotIdx = input.value.lastIndexOf(".");
      const end = dotIdx > 0 ? dotIdx : input.value.length;
      input.setSelectionRange(0, end);
    });
  }, [editingTitle]);

  React.useEffect(() => {
    if (!filePath) return;
    return host.onRenamed(({ oldPath, newPath }) => {
      if (host.normalizePath(filePath) === host.normalizePath(oldPath)) {
        setFilePath(newPath);
        bridge.setTitle(getBaseName(newPath));
      }
    });
  }, [bridge, filePath]);

  const applyTitleRename = React.useCallback(
    (nextName: string) => {
      if (!filePath) return;
      const renamed = `${filePath.slice(0, filePath.lastIndexOf("/"))}/${nextName}`;
      void host.vfs.move(filePath, renamed).then(
        () => {
          setFilePath(renamed);
          bridge.setTitle(nextName);
        },
        (error) => console.warn("Could not rename", filePath, error),
      );
    },
    [bridge, filePath, host],
  );

  const commitTitleRename = React.useCallback(() => {
    setEditingTitle(false);
    if (!filePath) return;
    const currentName = getBaseName(filePath);
    const nextName = draftTitle.trim().replace(/[/\\]/g, "");
    if (!nextName || nextName === currentName) return;
    const oldExt = getFileExtension(currentName);
    const newExt = getFileExtension(nextName);
    if (oldExt !== newExt) {
      setPendingRename({ nextName, oldExt, newExt });
      return;
    }
    applyTitleRename(nextName);
  }, [applyTitleRename, draftTitle, filePath]);

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

  const restoredFilePathRef = React.useRef<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);

  const persistEditorStateNow = React.useCallback(
    (
      targetPath: string | null,
      options?: { clearUnsaved?: boolean; view?: EditorView | null },
    ) => {
      if (!targetPath) return;
      const normPath = host.normalizePath(targetPath);
      const activeView = options?.view ?? viewRef.current;
      const cursor = activeView
        ? activeView.state.selection.main.head
        : (readPersistedEditorStateMap(host)[normPath]?.cursor ?? 0);
      const scrollTop = activeView
        ? Math.round(activeView.scrollDOM.scrollTop)
        : (readPersistedEditorStateMap(host)[normPath]?.scrollTop ?? 0);

      if (activeView) {
        // A file not saved yet has nowhere to keep them.
        void host.vfs
          .setMetadata(normPath, {
            "metadata::piloti-cursor": cursor,
            "metadata::piloti-scroll": scrollTop,
          })
          .catch(() => undefined);
      }

      const map = readPersistedEditorStateMap(host);
      const currentText = contentRef.current;
      const dirty =
        !options?.clearUnsaved && currentText !== savedContentRef.current;
      map[normPath] = {
        ...(dirty ? { unsavedContent: currentText } : {}),
        cursor,
        scrollTop,
        viewMode: viewModeRef.current,
        updatedAt: Date.now(),
      };
      host.writeState(EDITOR_STATE_KEY, map);
    },
    [host],
  );

  const schedulePersistEditorState = React.useCallback(
    (targetPath: string | null) => {
      if (!targetPath) return;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        persistEditorStateNow(targetPath);
      }, 400);
    },
    [persistEditorStateNow],
  );

  const restoreEditorViewState = React.useCallback(
    (view: EditorView, targetPath: string | null) => {
      const applyPosition = (savedCursor: number, savedScroll: number) => {
        if (viewRef.current !== view) return;
        const clampedCursor = Math.max(
          0,
          Math.min(savedCursor, view.state.doc.length),
        );
        if (view.state.selection.main.head !== clampedCursor) {
          view.dispatch({
            selection: { anchor: clampedCursor },
          });
        }
        const line = view.state.doc.lineAt(clampedCursor);
        setCursorPos({
          ln: line.number,
          col: clampedCursor - line.from + 1,
        });
        requestAnimationFrame(() => {
          if (viewRef.current !== view) return;
          if (savedScroll > 0) {
            view.scrollDOM.scrollTop = savedScroll;
          }
          view.focus();
        });
      };

      if (!targetPath) {
        applyPosition(0, 0);
        return;
      }

      const normPath = host.normalizePath(targetPath);
      const persisted = readPersistedEditorStateMap(host)[normPath];
      const cachedCursor = persisted?.cursor ?? 0;
      const cachedScroll = persisted?.scrollTop ?? 0;
      applyPosition(cachedCursor, cachedScroll);

      if (persisted === undefined) {
        void host.vfs
          .metadata(normPath, ["metadata::piloti-cursor", "metadata::piloti-scroll"])
          .then((meta) => {
            const cursor = Number(meta["metadata::piloti-cursor"] ?? 0) || 0;
            const scroll = Number(meta["metadata::piloti-scroll"] ?? 0) || 0;
            if (cursor || scroll) applyPosition(cursor, scroll);
          })
          .catch(() => undefined);
      }
    },
    [host],
  );

  const saveEditorViewState = React.useCallback(
    (view: EditorView | null, targetPath: string | null) => {
      if (!targetPath) return;
      persistEditorStateNow(targetPath, { view });
    },
    [persistEditorStateNow],
  );

  React.useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    let first = true;
    const syncFromDisk = () => {
      // The first read opens the file; later ones follow outside changes.
      const force = first;
      first = false;
      if (!force && isDirtyRef.current) return;
      void host.vfs.readText(filePath).catch(() => null).then((next) => {
        if (cancelled || next === null) return;
        if (!force && (isDirtyRef.current || next === savedContentRef.current)) return;
        const normPath = host.normalizePath(filePath);
        const persisted = force ? readPersistedEditorStateMap(host)[normPath] : undefined;
        const restoredText =
          persisted?.unsavedContent !== undefined && persisted.unsavedContent !== next
            ? persisted.unsavedContent
            : next;
        setSavedContent(next);
        savedContentRef.current = next;
        setContent(restoredText);
        contentRef.current = restoredText;
        bridge.setTitle(getBaseName(filePath));
        if (persisted?.viewMode) {
          setViewMode(persisted.viewMode);
        }
        const view = viewRef.current;
        if (view && view.state.doc.toString() !== restoredText) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: restoredText },
            // Opening is not an edit: undo must not bring back an empty page.
            annotations: Transaction.addToHistory.of(!force),
          });
        }
        if (view && restoredFilePathRef.current !== filePath) {
          restoredFilePathRef.current = filePath;
          restoreEditorViewState(view, filePath);
        }
      });
    };
    // Only this file: the editor's own state writes (cursor, scroll) must not
    // trigger a re-read of the document. Calls once when in place.
    // Shared with other views of the file; not cached (an open document).
    const unsub = retainVfsWatch(host.vfs, filePath, () => syncFromDisk());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [bridge, filePath, host, restoreEditorViewState]);

  const handleSave = React.useCallback(async () => {
    const targetPath =
      filePathRef.current ?? host.defaultNewFilePath("Untitled.txt");
    if (!filePathRef.current) {
      filePathRef.current = targetPath;
      setFilePath(targetPath);
    }
    const textToSave = contentRef.current;
    const ok = await host.vfs.write(targetPath, textToSave).then(
      () => true,
      (error) => {
        console.warn("Could not save", targetPath, error);
        return false;
      },
    );
    if (ok) {
      setSavedContent(textToSave);
      savedContentRef.current = textToSave;
      persistEditorStateNow(targetPath, { clearUnsaved: true });
    }
    return ok;
  }, [host, persistEditorStateNow]);

  const performClose = React.useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    persistEditorStateNow(filePathRef.current);
    if (typeof window !== "undefined" && window.parent === window) {
      host.requestAnimatedClose(windowId);
    } else {
      bridge.closeWindow();
    }
  }, [bridge, persistEditorStateNow, windowId]);

  const requestClose = React.useCallback(() => {
    if (isDirtyRef.current && !forceCloseRef.current && host.confirmUnsavedOnClose()) {
      setConfirmCloseOpen(true);
      return;
    }
    performClose();
  }, [performClose]);

  React.useEffect(() => {
    if (!windowId) return;
    const onBeforeClose = (
      detail: { windowId: string },
      e: { preventDefault: () => void },
    ) => {
      if (detail?.windowId !== windowId) return;
      if (isDirtyRef.current && !forceCloseRef.current && host.confirmUnsavedOnClose()) {
        e.preventDefault();
        setConfirmCloseOpen(true);
        return;
      }
      // Spatial: unsaved text is kept in editor-state.json and restored on reopen.
      persistEditorStateNow(filePathRef.current);
    };
    return host.onBeforeClose(onBeforeClose);
  }, [persistEditorStateNow, windowId]);

  const persistText = React.useCallback(
    (next: string) => {
      contentRef.current = next;
      setContent(next);
      schedulePersistEditorState(filePathRef.current);
    },
    [schedulePersistEditorState],
  );

  // Preferences live in CodeMirror compartments so toggling them (or the theme)
  // reconfigures the existing view instead of rebuilding it — undo history,
  // selection and folds survive.
  const compartmentsRef = React.useRef<{
    gutter: Compartment;
    activeLine: Compartment;
    wrap: Compartment;
    highlight: Compartment;
  } | null>(null);
  if (!compartmentsRef.current) {
    compartmentsRef.current = {
      gutter: new Compartment(),
      activeLine: new Compartment(),
      wrap: new Compartment(),
      highlight: new Compartment(),
    };
  }
  const editorPrefs = {
    showLineNumbers,
    showCodeFolding,
    highlightLine,
    wordWrap,
    enableHighlight,
    isDark,
    filePath,
  };
  const editorPrefsRef = React.useRef(editorPrefs);
  editorPrefsRef.current = editorPrefs;

  const buildPrefExtensions = React.useCallback((prefs: typeof editorPrefs) => {
    const gutter: Extension[] = [];
    if (prefs.showLineNumbers) {
      gutter.push(lineNumbers(), highlightActiveLineGutter());
      if (prefs.showCodeFolding) {
        gutter.push(
          codeFolding({ placeholderText: "…" }),
          foldGutter({ openText: "⌄", closedText: "›" }),
        );
      }
    }
    return {
      gutter,
      activeLine: prefs.highlightLine ? [highlightActiveLine()] : [],
      wrap: prefs.wordWrap ? [EditorView.lineWrapping] : [],
      highlight: prefs.enableHighlight
        ? [
            syntaxHighlighting(
              prefs.isDark ? adwDarkHighlightStyle : adwLightHighlightStyle,
              { fallback: true },
            ),
            ...resolveLanguageExtension(prefs.filePath),
          ]
        : [],
    };
  }, []);

  // Create the view once per file (and when returning to Code mode).
  React.useEffect(() => {
    if (viewMode !== "code") {
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }
    const mountEl = editorHostRef.current;
    const compartments = compartmentsRef.current;
    if (!mountEl || !compartments) return;

    const prefExts = buildPrefExtensions(editorPrefsRef.current);
    const extensions: Extension[] = [
      history(),
      bracketMatching(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
      adwEditorTheme,
      compartments.gutter.of(prefExts.gutter),
      compartments.activeLine.of(prefExts.activeLine),
      compartments.wrap.of(prefExts.wrap),
      compartments.highlight.of(prefExts.highlight),
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
          schedulePersistEditorState(filePathRef.current);
        }
      }),
    ];

    const state = EditorState.create({
      doc: contentRef.current,
      extensions,
    });

    const view = new EditorView({ state, parent: mountEl });
    viewRef.current = view;
    if (!filePath || contentRef.current.length > 0) {
      restoredFilePathRef.current = filePath;
      restoreEditorViewState(view, filePath);
    } else {
      requestAnimationFrame(() => view.focus());
    }
    const onScroll = () => {
      schedulePersistEditorState(filePathRef.current);
    };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    const handleBeforeUnload = () => {
      saveEditorViewState(view, filePathRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      view.scrollDOM.removeEventListener("scroll", onScroll);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveEditorViewState(view, filePath);
      view.destroy();
      viewRef.current = null;
    };
  }, [
    buildPrefExtensions,
    filePath,
    persistText,
    restoreEditorViewState,
    saveEditorViewState,
    schedulePersistEditorState,
    viewMode,
  ]);

  // Live-reconfigure preferences / theme on the existing view.
  React.useEffect(() => {
    const view = viewRef.current;
    const compartments = compartmentsRef.current;
    if (!view || !compartments) return;
    const prefExts = buildPrefExtensions(editorPrefsRef.current);
    view.dispatch({
      effects: [
        compartments.gutter.reconfigure(prefExts.gutter),
        compartments.activeLine.reconfigure(prefExts.activeLine),
        compartments.wrap.reconfigure(prefExts.wrap),
        compartments.highlight.reconfigure(prefExts.highlight),
      ],
    });
  }, [
    buildPrefExtensions,
    enableHighlight,
    highlightLine,
    isDark,
    showCodeFolding,
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

  const availableModes = React.useMemo<
    readonly { id: EditorViewMode; label: string }[]
  >(() => {
    if (!isPreviewable) return [];
    if (isHtmlFile) {
      return [
        { id: "code", label: _("Code") },
        { id: "preview", label: _("Preview") },
        { id: "design", label: _("Design") },
      ];
    }
    return [
      { id: "code", label: _("Code") },
      { id: "preview", label: _("Preview") },
    ];
  }, [isHtmlFile, isPreviewable]);

  const designInternalSyncRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (viewMode !== "design" || !isHtmlFile) return;
    const iframe = designIframeRef.current;
    if (!iframe) return;
    if (designInternalSyncRef.current === content) return;

    const doc = iframe.contentDocument;
    if (!doc) return;
    const hasDoctype = /^\s*<!doctype\s+html/i.test(content);
    const initialHtml = content.trim()
      ? content
      : "<!DOCTYPE html><html><body><p></p></body></html>";
    doc.open();
    doc.write(initialHtml);
    doc.close();

    if (doc.body) {
      doc.body.contentEditable = "true";
      doc.body.style.outline = "none";
      const onInput = () => {
        const serialized = `${hasDoctype ? "<!DOCTYPE html>\n" : ""}${doc.documentElement.outerHTML}`;
        designInternalSyncRef.current = serialized;
        persistText(serialized);
      };
      doc.body.addEventListener("input", onInput);
      return () => {
        doc.body?.removeEventListener("input", onInput);
      };
    }
  }, [content, isHtmlFile, persistText, viewMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      void handleSave();
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
      e.stopPropagation();
      if (findQuery.length > 0) {
        setFindQuery("");
      } else {
        setFindOpen(false);
        viewRef.current?.focus();
      }
    }
  };

  return (
    <div
      data-drop-window-id={windowId}
      onKeyDown={handleKeyDown}
      className="flex h-full w-full flex-col overflow-hidden bg-ui-content text-ui-label"
    >
      {/* Headerbar */}
      <HeaderBar onClose={requestClose}>
        <HeaderBar.Title interactive={Boolean(filePath) || isDirty}>
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
              className="h-6 max-w-48 rounded-ui-control border border-ui-accent/70 bg-black/8 px-2 text-center text-ui-body font-semibold text-ui-label outline-none dark:bg-white/12"
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
                "flex items-center truncate rounded-ui-control px-2 py-0.5 text-ui-body font-semibold text-ui-label transition-colors",
                filePath &&
                  "hover-fill:bg-black/8 dark:hover-fill:bg-white/10",
              )}
            >
              {isDirty && (
                <span
                  aria-label={_("Unsaved changes")}
                  title={_("Unsaved changes")}
                  className="mr-1.5 inline-block size-1.5 shrink-0 rounded-full bg-ui-label"
                />
              )}
              <span className="truncate">
                {filePath ? getBaseName(filePath) : _("Untitled")}
              </span>
            </button>
          )}
        </HeaderBar.Title>
        <HeaderBar.End>
          <HeaderButton
            icon={SaveIcon}
            label={_("Save")}
            disabled={!isDirty}
            onClick={() => void handleSave()}
          />
          {availableModes.length > 0 && (
            <Segmented value={viewMode} onChange={setViewMode} options={availableModes} />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<HeaderButton icon={SlidersHorizontalIcon} label={_("Editor Preferences")} />}
            />
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
        </HeaderBar.End>
      </HeaderBar>

      {/* Editor Body */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {findOpen && (
          <div
            data-testid="text-editor-find-bar"
            className="absolute top-2 right-3 z-20 flex items-center gap-1.5 rounded-ui-item border border-ui-border bg-ui-card/95 px-2 py-1 shadow-md backdrop-blur-md"
          >
            <input
              ref={findInputRef}
              type="search"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              className="w-36 bg-transparent text-xs text-ui-label outline-none"
            />
            <span className="font-mono text-ui-footnote text-ui-dim tabular-nums">
              {findQuery.trim() ? _("%d found", findMatchCount) : ""}
            </span>
            <button
              type="button"
              aria-label={_("Close Find")}
              onClick={() => {
                setFindOpen(false);
                viewRef.current?.focus();
              }}
              className="rounded px-1 text-xs text-ui-dim hover-fill:bg-ui-hover hover-fill:text-ui-label"
            >
              ×
            </button>
          </div>
        )}

        {viewMode === "design" && isHtmlFile ? (
          <iframe
            ref={designIframeRef}
            sandbox="allow-same-origin"
            title={filePath ? getBaseName(filePath) : _("Design")}
            className="h-full w-full border-0 bg-white"
          />
        ) : viewMode === "preview" ? (
          isHtmlFile ? (
            <iframe
              ref={previewIframeRef}
              sandbox="allow-same-origin allow-scripts"
              srcDoc={content}
              title={filePath ? getBaseName(filePath) : _("Preview")}
              className="h-full w-full border-0 bg-white"
            />
          ) : isSvgFile ? (
            <div className="flex h-full w-full items-center justify-center overflow-auto bg-ui-content p-6">
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`}
                alt={filePath ? getBaseName(filePath) : "SVG"}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : /\.(json|ini)$/i.test(filePath ?? "") ? (
            <div className="h-full w-full overflow-auto bg-ui-content p-4 font-mono text-ui-callout select-text">
              {(() => {
                try {
                  const parsed = /\.ini$/i.test(filePath ?? "")
                    ? parseIniText(content || "")
                    : JSON.parse(content || "null");
                  return (
                    <ObjectView
                      valueGetter={() => parsed}
                      name={filePath ? getBaseName(filePath) : ""}
                      showLineNumbers={false}
                      actionRenders={() => null}
                      style={
                        {
                          ...(isDark ? themeOneDark : themeGitHubLight),
                          backgroundColor: "transparent",
                          "--bigobjview-bg-color": "transparent",
                          "--bigobjview-type-boolean-color": "var(--ui-accent)",
                          "--bigobjview-type-object-object-color": "var(--ui-accent)",
                          "--bigobjview-type-object-array-color": "var(--ui-accent)",
                          fontSize: "12px",
                        } as React.CSSProperties
                      }
                      expandLevel={2}
                    />
                  );
                } catch (err) {
                  return (
                    <div className="rounded-ui-item border border-red-500/30 bg-red-500/10 p-3 text-red-400">
                      Invalid JSON: {String(err)}
                    </div>
                  );
                }
              })()}
            </div>
          ) : (
            <div className="h-full w-full overflow-auto bg-ui-content p-4 select-text">
              {renderSimpleMarkdown(content)}
            </div>
          )
        ) : (
          <div ref={editorHostRef} className="h-full w-full" />
        )}

        {showCursorPos && (
          <div
            data-testid="text-editor-status-pill"
            className="pointer-events-none absolute right-2.5 bottom-2 z-10 rounded-full border border-ui-border/60 bg-ui-card/90 px-2.5 py-0.5 font-mono text-ui-footnote text-ui-dim shadow-xs backdrop-blur-md"
          >
            Ln {cursorPos.ln}, Col {cursorPos.col}
          </div>
        )}

        {confirmCloseOpen && (
          <UnsavedChangesDialog
            onCancel={() => setConfirmCloseOpen(false)}
            onDiscard={() => {
              setConfirmCloseOpen(false);
              persistEditorStateNow(filePathRef.current, { clearUnsaved: true });
              forceCloseRef.current = true;
              performClose();
            }}
            onSave={async () => {
              const ok = await handleSave();
              if (ok) {
                setConfirmCloseOpen(false);
                forceCloseRef.current = true;
                performClose();
              }
            }}
          />
        )}

        <Dialog
          open={Boolean(pendingRename)}
          onOpenChange={(open) => {
            if (!open) setPendingRename(null);
          }}
        >
          <DialogContent showCloseButton={false} className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{_("Change File Extension?")}</DialogTitle>
              <DialogDescription>
                {pendingRename
                  ? _(
                      "Are you sure you want to change the extension from \"%s\" to \"%s\"?",
                      pendingRename.oldExt || _("none"),
                      pendingRename.newExt || _("none"),
                    )
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setPendingRename(null)}
                className="rounded-ui-item bg-black/8 px-3 py-1.5 text-xs font-medium text-ui-label transition-colors hover-fill:bg-black/14 dark:bg-white/10 dark:hover-fill:bg-white/16"
              >
                {_("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingRename) {
                    applyTitleRename(pendingRename.nextName);
                    setPendingRename(null);
                  }
                }}
                className="rounded-ui-item bg-ui-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover-fill:opacity-90"
              >
                {_("Rename")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
