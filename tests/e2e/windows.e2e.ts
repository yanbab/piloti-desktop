import { expect, test } from "@playwright/test";
import { bootDesktop, getAppWindow, launchFromDock } from "./helpers";

test.describe("Window Management", () => {
  test("opens apps, moves/resizes Terminal, and restores state on reload", async ({
    page,
  }) => {
    await bootDesktop(page);

    const filesWin = await launchFromDock(page, "nautilus");
    const textsWin = await launchFromDock(page, "texts");
    const termWin = await launchFromDock(page, "terminal");

    await expect(filesWin).toBeVisible();
    await expect(textsWin).toBeVisible();
    await expect(termWin).toBeVisible();

    const beforeBox = await termWin.boundingBox();
    expect(beforeBox).not.toBeNull();

    const dragHandle = termWin
      .locator('[data-slot="window-titlebar"], [data-window-drag-region]')
      .first();
    const handleBox = await dragHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 90, startY + 55, { steps: 10 });
    await page.mouse.up();

    const movedBox = await termWin.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(Math.round(movedBox!.x)).toBeGreaterThan(
      Math.round(beforeBox!.x) + 40
    );
    expect(Math.round(movedBox!.y)).toBeGreaterThan(
      Math.round(beforeBox!.y) + 20
    );

    const resizeX = movedBox!.x + movedBox!.width - 2;
    const resizeY = movedBox!.y + movedBox!.height - 2;
    await page.mouse.move(resizeX, resizeY);
    await page.mouse.down();
    await page.mouse.move(resizeX + 80, resizeY + 60, { steps: 10 });
    await page.mouse.up();

    const resizedBox = await termWin.boundingBox();
    expect(resizedBox).not.toBeNull();
    expect(Math.round(resizedBox!.width)).toBeGreaterThan(
      Math.round(movedBox!.width) + 30
    );
    expect(Math.round(resizedBox!.height)).toBeGreaterThan(
      Math.round(movedBox!.height) + 20
    );

    // Wait for debounced VFS session persistence
    await page.waitForTimeout(450);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getAppWindow(page, "nautilus")).toBeVisible({ timeout: 20_000 });
    await expect(getAppWindow(page, "texts")).toBeVisible();
    const restoredTerm = getAppWindow(page, "terminal");
    await expect(restoredTerm).toBeVisible();

    const restoredBox = await restoredTerm.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(Math.abs(restoredBox!.x - resizedBox!.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(restoredBox!.y - resizedBox!.y)).toBeLessThanOrEqual(6);
    expect(
      Math.abs(restoredBox!.width - resizedBox!.width)
    ).toBeLessThanOrEqual(6);
    expect(
      Math.abs(restoredBox!.height - resizedBox!.height)
    ).toBeLessThanOrEqual(6);
  });

  test("double-click titlebar maximizes and unmaximizes a window", async ({
    page,
  }) => {
    await bootDesktop(page);

    const termWin = await launchFromDock(page, "terminal");
    const titlebar = termWin.locator('[data-slot="window-titlebar"]').first();
    await titlebar.dblclick();
    await expect(termWin).toHaveAttribute("data-maximized", "true");
    await page.waitForTimeout(350);

    await titlebar.dblclick();
    await expect(termWin).not.toHaveAttribute("data-maximized", "true");
  });
});
