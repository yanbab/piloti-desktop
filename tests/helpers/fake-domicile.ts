/**
 * An in-memory `domicile.files` and `domicile.processes` that behave like the
 * Linux ones where `piloti.vfs` cares (measured on the VM, `_docs/PLAN-VFS.md`):
 * atomic writes replace symlinks, watches are per folder and not recursive, a
 * removed folder is reported once and then never again, and watches run out.
 */
const FILE = 0;
const DIRECTORY = 1;
const SYMLINK = 2;

type Node =
  | { type: "file"; data: Uint8Array; mtime: number; meta: Record<string, string> }
  | { type: "dir"; mtime: number; meta: Record<string, string> }
  | { type: "link"; target: string; mtime: number; meta: Record<string, string> };

const ok = <T>(value: T) => ({
  match: <R>(on: { Ok: (v: T) => R; Err: (e: never) => R }) => on.Ok(value),
});
const err = (kind: number, message: string) => ({
  match: <R>(on: { Ok: (v: never) => R; Err: (e: { kind: number; message: string }) => R }) =>
    on.Err({ kind, message }),
});
const notFound = () => err(0, "entity not found");

const parent = (p: string) => p.slice(0, p.lastIndexOf("/")) || "/";
const leaf = (p: string) => p.slice(p.lastIndexOf("/") + 1);

export function createFakeDomicile(options: { watchLimit?: number } = {}) {
  const nodes = new Map<string, Node>([["/", { type: "dir", mtime: 0, meta: {} }]]);
  const watchers = new Set<{ dir: string; push: (path: string) => void; dead: boolean }>();
  let clock = 1;

  /** `path` with links resolved; every part but the last must exist. */
  const real = (path: string, followLast = true, hops = 0): string => {
    const parts = path.split("/").filter(Boolean);
    let at = "";
    for (let i = 0; i < parts.length; i += 1) {
      at = `${at}/${parts[i]}`;
      const node = nodes.get(at);
      if (node?.type === "link" && (followLast || i < parts.length - 1) && hops < 8) {
        const target = node.target.startsWith("/") ? node.target : `${parent(at)}/${node.target}`;
        at = real(target, true, hops + 1);
      }
    }
    return at || "/";
  };
  const emit = (path: string) => {
    for (const w of watchers) {
      if (w.dead) continue;
      if (w.dir === parent(path)) w.push(path);
      if (w.dir === path && !nodes.has(path)) {
        w.push(path);
        w.dead = true;
      }
    }
  };
  const set = (path: string, node: Node) => {
    nodes.set(path, node);
    emit(path);
  };
  const subtree = (path: string) => [...nodes.keys()].filter((p) => p === path || p.startsWith(`${path}/`));
  const removeTree = (path: string) => {
    for (const p of subtree(path).sort((a, b) => b.length - a.length)) {
      nodes.delete(p);
      emit(p);
    }
  };
  const moveTree = (from: string, to: string) => {
    const moved = subtree(from).map((p) => [p, nodes.get(p)!] as const);
    removeTree(from);
    for (const [p, node] of moved) set(to + p.slice(from.length), node);
  };
  const children = (dir: string) => [...nodes.keys()].filter((p) => p !== "/" && parent(p) === dir);

  const mkdirs = (path: string) => {
    let at = "";
    for (const part of path.split("/").filter(Boolean)) {
      at = `${at}/${part}`;
      if (!nodes.has(real(at))) set(at, { type: "dir", mtime: clock++, meta: {} });
    }
  };

  const files = {
    async read(path: string) {
      const node = nodes.get(real(path));
      return node?.type === "file" ? ok(node.data) : notFound();
    },
    async readText(path: string) {
      const node = nodes.get(real(path));
      return node?.type === "file" ? ok(new TextDecoder().decode(node.data)) : notFound();
    },
    async write(path: string, data: Uint8Array | string) {
      const at = real(path, false);
      if (nodes.get(parent(at))?.type !== "dir") return notFound();
      if (nodes.get(at)?.type === "dir") return err(4, "is a directory");
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      // Atomic: whatever had the name, a link included, is replaced.
      const temporary = `${at}.domicile-1-${clock}`;
      emit(temporary);
      set(at, { type: "file", data: bytes, mtime: clock++, meta: nodes.get(at)?.meta ?? {} });
      return ok("written" as const);
    },
    async createDir(path: string) {
      if (nodes.has(real(path))) return err(2, "exists");
      set(real(path, false), { type: "dir", mtime: clock++, meta: {} });
      return ok("created" as const);
    },
    async readDir(path: string) {
      const dir = real(path);
      if (nodes.get(dir)?.type !== "dir") return notFound();
      const types = { file: FILE, dir: DIRECTORY, link: SYMLINK };
      return ok(children(dir).map((p) => ({ name: leaf(p), fileType: types[nodes.get(p)!.type] })));
    },
    async stat(path: string) {
      const at = real(path);
      const node = nodes.get(at);
      if (!node || node.type === "link") return notFound();
      return ok({
        fileType: node.type === "dir" ? DIRECTORY : FILE,
        size: node.type === "file" ? node.data.length : 0,
        modifiedMs: node.mtime,
        realPath: at,
      });
    },
    async watch(path: string) {
      const dir = real(path);
      const node = nodes.get(dir);
      if (!node) return notFound();
      if (node.type !== "dir") throw new Error(`piloti.vfs must only watch folders: ${path}`);
      if ([...watchers].length >= (options.watchLimit ?? 128)) return err(10, "Too many open files");
      let controller!: ReadableStreamDefaultController<{ kind: number; item: string }>;
      const items = new ReadableStream<{ kind: number; item: string }>({ start: (c) => void (controller = c) });
      const watcher = { dir, dead: false, push: (item: string) => controller.enqueue({ kind: 0, item }) };
      watchers.add(watcher);
      return ok({
        items,
        stop: () => {
          if (watchers.delete(watcher)) controller.close();
        },
        ended: new Promise<never>(() => {}),
      });
    },
  };

  const trashDir = "/home/user/.local/share/Trash";
  const command = (argv: string[]): string => {
    const [program, ...rest] = argv;
    const args = rest.slice(rest.indexOf("--") + 1);
    const flags = rest.slice(0, rest.indexOf("--"));
    switch (program) {
      case "mkdir":
        mkdirs(args[0]!);
        return "";
      case "mv":
        moveTree(real(args[0]!, false), real(args[1]!, false));
        return "";
      case "cp": {
        const from = real(args[0]!, false);
        const to = real(args[1]!, false);
        for (const p of subtree(from)) set(to + p.slice(from.length), { ...nodes.get(p)! });
        return "";
      }
      case "ln":
        set(real(args[1]!, false), { type: "link", target: args[0]!, mtime: clock++, meta: {} });
        return "";
      case "rm":
        removeTree(real(args[0]!, false));
        return "";
      case "gio":
        break;
      default:
        throw new Error(`unexpected command ${argv.join(" ")}`);
    }
    if (rest[0] === "trash" && rest.includes("--empty")) {
      for (const dir of [`${trashDir}/files`, `${trashDir}/info`]) children(dir).forEach(removeTree);
      return "";
    }
    if (rest[0] === "trash") {
      const from = real(args[0]!, false);
      if (!nodes.has(from)) throw new Error("no such file");
      mkdirs(`${trashDir}/files`);
      mkdirs(`${trashDir}/info`);
      let name = leaf(from);
      while (nodes.has(`${trashDir}/files/${name}`)) name = `${name}.2`;
      const info = `[Trash Info]\nPath=${encodeURI(from)}\n`;
      set(`${trashDir}/info/${name}.trashinfo`, { type: "file", data: new TextEncoder().encode(info), mtime: clock++, meta: {} });
      moveTree(from, `${trashDir}/files/${name}`);
      return "";
    }
    const node = nodes.get(real(args[0]!));
    if (!node) throw new Error("no such file");
    if (rest[0] === "set") {
      node.meta[args[1]!] = args[2]!;
      return "";
    }
    const keys = flags[flags.indexOf("-a") + 1]!.split(",");
    return keys.flatMap((k) => (node.meta[k] ? [`  ${k}: ${node.meta[k]}`] : [])).join("\n");
  };

  const processes = {
    async run(argv: string[]) {
      try {
        return ok({ code: 0, stdout: command([...argv]), stderr: "" });
      } catch (error) {
        return ok({ code: 1, stdout: "", stderr: String(error) });
      }
    },
  };

  mkdirs("/home/user");
  return {
    domicile: { files, processes },
    watchCount: () => watchers.size,
  };
}
