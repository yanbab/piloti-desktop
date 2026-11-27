/**
 * The file commands of piloti-shell (`cd`, `ls`, `mv`...), on `piloti.vfs`.
 * They are plain async functions, usable as `mv a b` or `await mv('a', 'b')`.
 */
import { resolveVfsPath, WEB_VFS_HOME } from "@/lib/core/vfs-paths";
import { baseName, joinPath, parentPath, type Vfs } from "@/lib/ports/vfs";
import { formatTable } from "@/apps/terminal/piloti-table";

export interface ShellCommandOptions {
  vfs: () => Vfs;
  /** Opens a file or folder with its application. */
  open?: (path: string, kind: "file" | "directory") => unknown;
  home?: string;
  /** Colors `ls` as a terminal's does. */
  color?: boolean;
  /** Terminal width, for `ls -l`. */
  columns?: () => number;
}

export const SHELL_COMMAND_HELP = [
  "cd [dir]           change folder (cd - goes back)",
  "pwd                current folder",
  "ls [-alh] [path]   list a folder",
  "cat file...        print files",
  "echo text...       print text",
  "touch file...      create empty files",
  "mkdir [-p] dir...  create folders",
  "cp [-r] src... to  copy",
  "mv src... to       move or rename",
  "ln -s target link  symbolic link",
  "rm [-r] [-f] path  delete for good",
  "rmdir dir...       delete empty folders",
  "trash path...      move to the Trash",
  "open [path]        open with its application",
  "alias [name=value] list or set aliases (ll, la, less, more)",
  "unalias name...    remove aliases",
].join("\n");

const DEFAULT_ALIASES = { ll: "ls -la", la: "ls -a", less: "cat", more: "cat" };

/** The usual `LS_COLORS` by extension. Modes are not in the VFS: no executables. */
const FILE_COLORS: [RegExp, string][] = [
  [/\.(tar|t?gz|zip|xz|bz2|zst|7z|rar|deb|rpm|jar)$/i, "01;31"],
  [/\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff?|mp4|mkv|webm|mov|avi)$/i, "01;35"],
  [/\.(mp3|ogg|oga|opus|flac|wav|m4a|aac)$/i, "00;36"],
];

const printable = (text: string) => text.replace(/[\x00-\x1f\x7f-\x9f]/g, "?");

function humanSize(bytes: number): string {
  let value = bytes;
  let unit = "";
  for (const next of ["K", "M", "G", "T"]) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return unit ? `${value < 10 ? value.toFixed(1) : Math.round(value)}${unit}` : String(bytes);
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** As `ls -l`: the time for the last six months, else the year. */
function lsDate(ms?: number): string {
  if (ms === undefined) return " ".repeat(12);
  const date = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  const recent = Math.abs(Date.now() - ms) < 182 * 86_400_000;
  const last = recent ? `${two(date.getHours())}:${two(date.getMinutes())}` : ` ${date.getFullYear()}`;
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2)} ${last}`;
}

function parseFlags(command: string, args: string[], allowed: string) {
  const flags = new Set<string>();
  const rest: string[] = [];
  let done = false;
  for (const arg of args.map(String)) {
    if (!done && arg === "--") done = true;
    else if (!done && arg.length > 1 && arg.startsWith("-")) {
      for (const flag of arg.slice(1)) {
        if (!allowed.includes(flag)) throw new Error(`${command}: unknown option -${flag}`);
        flags.add(flag);
      }
    } else rest.push(arg);
  }
  return { flags, rest };
}

export function createShellCommands({ vfs, open, home = WEB_VFS_HOME, color = false, columns }: ShellCommandOptions) {
  let cwd = home;
  let previous = home;
  const aliases = new Map<string, string>(Object.entries(DEFAULT_ALIASES));

  const resolve = (path: string) => {
    if (path === "~") return home;
    return resolveVfsPath(cwd, path.startsWith("~/") ? `${home}/${path.slice(2)}` : path);
  };

  const need = (command: string, list: string[], count = 1) => {
    if (list.length < count) throw new Error(`${command}: missing operand`);
    return list;
  };

  const existing = async (command: string, path: string) => {
    const stat = await vfs().stat(resolve(path));
    if (!stat) throw new Error(`${command}: ${path}: no such file or folder`);
    return stat;
  };

  /** `cp` and `mv`: sources into a folder, or one source to a new name. */
  const transfer = async (command: "cp" | "mv", paths: string[], recursive: boolean) => {
    need(command, paths, 2);
    const sources = paths.slice(0, -1);
    const target = resolve(paths[paths.length - 1]!);
    const intoFolder = (await vfs().stat(target))?.kind === "directory";
    if (sources.length > 1 && !intoFolder) throw new Error(`${command}: ${target} is not a folder`);
    for (const source of sources) {
      const from = resolve(source);
      const stat = await existing(command, source);
      const to = intoFolder ? joinPath(target, baseName(from)) : target;
      if (command === "cp" && stat.kind === "directory" && !recursive) {
        throw new Error(`cp: ${source} is a folder (use -r)`);
      }
      const taken = await vfs().stat(to);
      // Checked before anything is replaced: overwriting a file with itself would lose it.
      if (to === from || taken?.realPath === stat.realPath) throw new Error(`${command}: ${source}: same file`);
      if (to.startsWith(`${from}/`)) throw new Error(`${command}: cannot put ${source} inside itself`);
      if (taken && (taken.kind === "directory" || stat.kind === "directory")) {
        throw new Error(`${command}: ${to} already exists`);
      }
      if (command === "mv") await vfs().move(from, to, { overwrite: !!taken });
      else {
        if (taken) await vfs().remove(to);
        await vfs().copy(from, to);
      }
    }
  };

  /** Never `/`, the home folder, or a folder we are in. */
  const deletable = (command: string, path: string) => {
    const full = resolve(path);
    if (full === "/" || `${home}/`.startsWith(`${full}/`) || `${cwd}/`.startsWith(`${full}/`)) {
      throw new Error(`${command}: refusing to delete ${full}`);
    }
    return full;
  };

  /** A symlink is removed as itself, whatever it points to. */
  const entryOf = async (path: string) => {
    const full = resolve(path);
    return (await vfs().list(parentPath(full)))?.find((e) => e.name === baseName(full));
  };

  const colorOf = ({ name, kind, isSymlink }: Listed) =>
    isSymlink
      ? "01;36"
      : kind === "directory"
        ? "01;34"
        : FILE_COLORS.find(([pattern]) => pattern.test(name))?.[1];

  const colored = (text: string, entry: Listed) => {
    const code = color ? colorOf(entry) : undefined;
    return code ? `\x1b[${code}m${text}\x1b[0m` : text;
  };

  const suffix = (entry: Listed) => (entry.kind === "directory" ? "/" : "");

  interface Listed {
    name: string;
    path: string;
    kind: "file" | "directory";
    isSymlink?: boolean;
  }

  /** Names one per line, or with `long` a table. */
  const listing = async (entries: Listed[], long: boolean, human: boolean) => {
    if (!long) return entries.map((e) => colored(printable(e.name), e) + suffix(e)).join("\n");
    if (!entries.length) return "";
    const rows = await Promise.all(
      entries.map(async (e) => {
        const stat = await vfs().stat(e.path).catch(() => null);
        const size = stat?.size === undefined ? "-" : human ? humanSize(stat.size) : String(stat.size);
        const target = e.isSymlink && stat ? ` -> ${stat.realPath}` : "";
        return {
          type: e.isSymlink ? "link" : e.kind === "directory" ? "dir" : "file",
          size,
          modified: lsDate(stat?.modifiedMs),
          name: printable(e.name + suffix(e) + target),
        };
      }),
    );
    return formatTable(rows, {
      columns: columns?.(),
      maxCell: Number.MAX_SAFE_INTEGER,
      paint: (text, row, key) => (key === "name" ? colored(text, entries[row]!) : text),
    });
  };

  const commands = {
    async cd(dir: string = "~") {
      const next = dir === "-" ? previous : resolve(String(dir));
      if ((await vfs().stat(next))?.kind !== "directory") throw new Error(`cd: ${dir}: no such folder`);
      previous = cwd;
      cwd = next;
    },
    pwd: () => cwd,
    async ls(...args: string[]) {
      const { flags, rest } = parseFlags("ls", args, "aAl1h");
      const long = flags.has("l");
      const hidden = flags.has("a") || flags.has("A");
      const files: Listed[] = [];
      const folders: { target: string; path: string }[] = [];
      for (const target of rest.length ? rest : ["."]) {
        const stat = await existing("ls", target);
        const path = resolve(target);
        if (stat.kind === "directory") folders.push({ target, path });
        else files.push({ name: target, path, kind: "file", isSymlink: (await entryOf(target))?.isSymlink });
      }
      const blocks = files.length ? [await listing(files, long, flags.has("h"))] : [];
      for (const { target, path } of folders) {
        const entries = ((await vfs().list(path)) ?? [])
          .filter((e) => hidden || !e.name.startsWith("."))
          .sort((a, b) => a.name.localeCompare(b.name));
        const text = await listing(entries, long, flags.has("h"));
        blocks.push([...(rest.length > 1 ? [`${printable(target)}:`] : []), text].join("\n"));
      }
      return blocks.join(rest.length > 1 ? "\n\n" : "\n");
    },
    alias(...args: string[]) {
      const show = (name: string) => `alias ${name}='${aliases.get(name)}'`;
      if (!args.length) return [...aliases.keys()].sort().map(show).join("\n");
      const [first, ...more] = args.map(String) as [string, ...string[]];
      const equals = first.indexOf("=");
      const name = equals === -1 ? first : first.slice(0, equals);
      const value = [...(equals === -1 ? [] : [first.slice(equals + 1)]), ...more].join(" ");
      if (!/^[\w.-]+$/.test(name)) throw new Error(`alias: ${name}: not a name`);
      if (value) aliases.set(name, value);
      else if (aliases.has(name)) return show(name);
      else throw new Error(`alias: ${name}: not found`);
    },
    unalias(...names: string[]) {
      for (const name of need("unalias", names)) {
        if (!aliases.delete(name)) throw new Error(`unalias: ${name}: not found`);
      }
    },
    async cat(...paths: string[]) {
      const texts: string[] = [];
      for (const path of need("cat", paths)) {
        if ((await existing("cat", path)).kind === "directory") throw new Error(`cat: ${path} is a folder`);
        texts.push((await vfs().readText(resolve(path))) ?? "");
      }
      return texts.join("");
    },
    echo: (...words: unknown[]) =>
      words.map((w) => (typeof w === "object" ? JSON.stringify(w) : String(w))).join(" "),
    async touch(...paths: string[]) {
      for (const path of need("touch", paths)) {
        // An existing file is left alone: the VFS cannot set times only.
        if (!(await vfs().stat(resolve(path)))) await vfs().write(resolve(path), "");
      }
    },
    async mkdir(...args: string[]) {
      const { flags, rest } = parseFlags("mkdir", args, "p");
      for (const path of need("mkdir", rest)) {
        const full = resolve(path);
        if (!flags.has("p")) {
          if (await vfs().stat(full)) throw new Error(`mkdir: ${path} already exists`);
          if (!(await vfs().stat(parentPath(full)))) throw new Error(`mkdir: ${path}: no such parent folder`);
        }
        await vfs().createDir(full);
      }
    },
    async cp(...args: string[]) {
      const { flags, rest } = parseFlags("cp", args, "rRf");
      await transfer("cp", rest, flags.has("r") || flags.has("R"));
    },
    async mv(...args: string[]) {
      await transfer("mv", parseFlags("mv", args, "f").rest, true);
    },
    async ln(...args: string[]) {
      const { flags, rest } = parseFlags("ln", args, "s");
      if (!flags.has("s")) throw new Error("ln: only symbolic links (-s)");
      const [target, link] = need("ln", rest, 2) as [string, string];
      await vfs().symlink(resolve(target), resolve(link));
    },
    async rm(...args: string[]) {
      const { flags, rest } = parseFlags("rm", args, "rRf");
      if (!flags.has("f")) need("rm", rest);
      for (const path of rest) {
        const full = deletable("rm", path);
        const entry = await entryOf(path);
        if (!entry) {
          if (flags.has("f")) continue;
          throw new Error(`rm: ${path}: no such file or folder`);
        }
        if (entry.kind === "directory" && !entry.isSymlink && !flags.has("r") && !flags.has("R")) {
          throw new Error(`rm: ${path} is a folder (use -r)`);
        }
        await vfs().remove(full);
      }
    },
    async rmdir(...paths: string[]) {
      for (const path of need("rmdir", paths)) {
        const entries = await vfs().list(resolve(path));
        if (!entries) throw new Error(`rmdir: ${path}: no such folder`);
        if (entries.length) throw new Error(`rmdir: ${path} is not empty`);
        await vfs().remove(deletable("rmdir", path));
      }
    },
    async trash(...paths: string[]) {
      for (const path of need("trash", paths)) {
        await existing("trash", path);
        await vfs().trash(deletable("trash", path));
      }
    },
    async open(path: string = ".") {
      if (!open) throw new Error("open: not available");
      const stat = await existing("open", String(path));
      await open(resolve(String(path)), stat.kind);
    },
  };

  /** Expands `*` and `?` in the last part of a word; kept as is when nothing matches. */
  const glob = async (word: string): Promise<string[]> => {
    const slash = word.lastIndexOf("/");
    const dir = word.slice(0, slash + 1);
    const pattern = word.slice(slash + 1);
    if (!/[*?]/.test(pattern)) return [word];
    const regexp = new RegExp(
      `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
    );
    const matches = ((await vfs().list(resolve(dir || "."))) ?? [])
      .map((e) => e.name)
      .filter((name) => regexp.test(name) && (pattern.startsWith(".") || !name.startsWith(".")))
      .sort()
      .map((name) => dir + name);
    return matches.length ? matches : [word];
  };

  return {
    commands,
    glob,
    resolve,
    cwd: () => cwd,
    aliases: aliases as ReadonlyMap<string, string>,
    /** The current folder: from home inside it (empty for home itself), else absolute. */
    shortCwd: () => (cwd === home ? "" : cwd.startsWith(`${home}/`) ? cwd.slice(home.length + 1) : cwd),
  };
}
