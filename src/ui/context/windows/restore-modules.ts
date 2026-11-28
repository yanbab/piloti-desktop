/** Brings back the separate windows of the last session. */
import { initAppModules, moduleDocument, resolveAppModuleByUrl } from "@/core/data/app-modules";
import { openAppModule } from "@/platform/shared/desktop-integration";
import type { Piloti } from "@/platform/shared/piloti";

/** A module takes its file from one request per app: give it time to. */
const BETWEEN_MS = 2000;

export async function restoreModuleWindows(piloti: Piloti, urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;
  await initAppModules();
  for (const url of urls) {
    const mod = resolveAppModuleByUrl(url);
    if (!mod) continue;
    await openAppModule(piloti, mod.id, moduleDocument(url) ?? undefined).catch(() => false);
    await new Promise((resolve) => setTimeout(resolve, BETWEEN_MS));
  }
}
