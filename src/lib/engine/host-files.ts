/**
 * The one way to reach files outside the engines: Domicile's files API. On
 * Linux it is the real disk; in the browser demo the web host serves it from
 * the browser VFS (`/home/user`) and the shipped files (`/usr`, `/etc`).
 *
 * Code outside `engine*` asks here instead of using `domicile.files`
 * (`tests/unit/engine-boundary.test.ts` checks it), so caching, timing or a
 * different backend has one place to go.
 */
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";

export type HostFiles = Domicile["files"];

export function hostFiles(domicile: Pick<Domicile, "files">): HostFiles {
  return domicile.files;
}

/** The running shell's files, for apps that may render outside the Domicile provider. */
export function shellHostFiles(): HostFiles | undefined {
  return (window as unknown as { __PILOTI__?: { domicile?: Domicile } }).__PILOTI__?.domicile
    ?.files;
}
