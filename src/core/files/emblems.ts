/** File emblems (tags), as Folders and the desktop show them. */

export type VfsEmblemId = "favorite" | "important" | "work" | "personal";

export const VFS_EMBLEM_META: Record<
  VfsEmblemId,
  { label: string; colorClass: string; badgeBgClass: string }
> = {
  favorite: {
    label: "Favorite",
    colorClass: "text-rose-500",
    badgeBgClass: "bg-rose-500/90 text-white",
  },
  important: {
    label: "Important",
    colorClass: "text-amber-500",
    badgeBgClass: "bg-amber-500/90 text-white",
  },
  work: {
    label: "Work",
    colorClass: "text-sky-500",
    badgeBgClass: "bg-sky-500/90 text-white",
  },
  personal: {
    label: "Personal",
    colorClass: "text-emerald-500",
    badgeBgClass: "bg-emerald-500/90 text-white",
  },
};
