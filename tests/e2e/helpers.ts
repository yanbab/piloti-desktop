import { expect, type Locator, type Page } from "@playwright/test";

export async function bootDesktop(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-slot="dock"]')).toBeVisible({
    timeout: 35_000,
  });
  await expect(page.locator('[data-menubar-nav="launcher"]')).toBeVisible({
    timeout: 20_000,
  });
}

export function getAppWindow(page: Page, appId: string): Locator {
  return page.locator(`[data-slot="window"][data-app-id="${appId}"]`).first();
}

export async function launchFromDock(
  page: Page,
  appId: string
): Promise<Locator> {
  const win = getAppWindow(page, appId);
  if (!(await win.isVisible())) {
    const dockIcon = page.locator(`[data-dock-app-id="${appId}"]`);
    await expect(dockIcon).toBeVisible({ timeout: 20_000 });
    await dockIcon.click();
    await expect(win).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(300);
  }
  return win;
}

export async function openViaLauncher(
  page: Page,
  query: string,
  expectedAppId?: string
): Promise<void> {
  await page.keyboard.press("Alt+Space");
  const header = page.locator("[data-launcher-drag-header]");
  await expect(header).toBeVisible({ timeout: 10_000 });
  const input = header.locator("input").first();
  await input.fill(query);
  await input.press("Enter");
  await expect(header).toBeHidden({ timeout: 10_000 });
  if (expectedAppId) {
    await expect(getAppWindow(page, expectedAppId)).toBeVisible({
      timeout: 15_000,
    });
  }
}
