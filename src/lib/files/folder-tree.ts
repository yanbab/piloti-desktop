/** The shape of Folders' tree, apart from React and the disk. */
import type { IconGridItem } from "@/lib/files/desktop-icons";

export interface FolderTreeNode {
  item: IconGridItem;
  children?: FolderTreeNode[];
}

export type ExpandedFolders = Readonly<Record<string, boolean>>;

const isInside = (path: string, dir: string) => path.startsWith(`${dir}/`);

/**
 * Without items that are inside another listed one: moving, copying or
 * trashing a folder already takes its contents.
 */
export function topmostItems<T extends { path: string }>(items: readonly T[]): T[] {
  const paths = new Set(items.map((i) => i.path));
  return items.filter((item) => {
    for (let at = item.path.lastIndexOf("/"); at > 0; at = item.path.lastIndexOf("/", at - 1)) {
      if (paths.has(item.path.slice(0, at))) return false;
    }
    return true;
  });
}

/**
 * The tree under `rootItems`, and its rows from top to bottom. `childrenOf`
 * gives an open folder's items (`undefined` while loading). With a `query`,
 * only matching rows and the folders leading to them stay.
 */
export function buildFolderTree(
  rootItems: readonly IconGridItem[],
  expanded: ExpandedFolders,
  childrenOf: (dir: string) => readonly IconGridItem[] | undefined,
  query = "",
): { nodes: FolderTreeNode[]; visibleItems: IconGridItem[]; openDirs: string[] } {
  const openDirs: string[] = [];
  const build = (items: readonly IconGridItem[]): FolderTreeNode[] =>
    items.flatMap((item) => {
      let children: FolderTreeNode[] | undefined;
      // A folder inside a closed one isn't reached: it isn't listed or watched.
      if (item.kind === "directory" && expanded[item.path]) {
        openDirs.push(item.path);
        children = build(childrenOf(item.path) ?? []);
      }
      const matches = !query || item.name.toLowerCase().includes(query);
      if (!matches && !children?.length) return [];
      return [{ item, children }];
    });
  const nodes = build(rootItems);
  const visibleItems: IconGridItem[] = [];
  const walk = (list: readonly FolderTreeNode[]) => {
    for (const node of list) {
      visibleItems.push(node.item);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return { nodes, visibleItems, openDirs };
}

/** Open folders keep being open under their new path after a rename or move. */
export function renameExpanded(
  expanded: ExpandedFolders,
  oldPath: string,
  newPath: string,
): ExpandedFolders {
  return Object.fromEntries(
    Object.entries(expanded).map(([path, open]) => [
      path === oldPath || isInside(path, oldPath) ? newPath + path.slice(oldPath.length) : path,
      open,
    ]),
  );
}
