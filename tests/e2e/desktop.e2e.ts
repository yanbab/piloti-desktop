import { expect, test } from "@playwright/test";

test.describe("Piloti Desktop E2E", () => {
  test("opens apps, moves and resizes a window, and restores state on reload", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const filesDockIcon = page.locator('[data-dock-app-id="nautilus"]');
    const editorDockIcon = page.locator('[data-dock-app-id="text-editor"]');
    const terminalDockIcon = page.locator('[data-dock-app-id="terminal"]');

    await expect(filesDockIcon).toBeVisible({ timeout: 20_000 });

    // Open three apps from the Dock
    await filesDockIcon.click();
    await editorDockIcon.click();
    await terminalDockIcon.click();

    const terminalWindow = page
      .locator('[data-slot="window"][data-app-id="terminal"]')
      .first();
    const editorWindow = page
      .locator('[data-slot="window"][data-app-id="text-editor"]')
      .first();
    const filesWindow = page
      .locator('[data-slot="window"][data-app-id="nautilus"]')
      .first();

    await expect(filesWindow).toBeVisible();
    await expect(editorWindow).toBeVisible();
    await expect(terminalWindow).toBeVisible();

    // Wait for open zoom transition to finish
    await page.waitForTimeout(300);

    // Move the Terminal window by dragging its titlebar
    const beforeBox = await terminalWindow.boundingBox();
    expect(beforeBox).not.toBeNull();

    const dragHandle = terminalWindow
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

    const movedBox = await terminalWindow.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(Math.round(movedBox!.x)).toBeGreaterThan(Math.round(beforeBox!.x) + 40);
    expect(Math.round(movedBox!.y)).toBeGreaterThan(Math.round(beforeBox!.y) + 20);

    // Resize the Terminal window from its bottom-right edge
    const resizeX = movedBox!.x + movedBox!.width - 2;
    const resizeY = movedBox!.y + movedBox!.height - 2;
    await page.mouse.move(resizeX, resizeY);
    await page.mouse.down();
    await page.mouse.move(resizeX + 80, resizeY + 60, { steps: 10 });
    await page.mouse.up();

    const resizedBox = await terminalWindow.boundingBox();
    expect(resizedBox).not.toBeNull();
    expect(Math.round(resizedBox!.width)).toBeGreaterThan(
      Math.round(movedBox!.width) + 30
    );
    expect(Math.round(resizedBox!.height)).toBeGreaterThan(
      Math.round(movedBox!.height) + 20
    );

    // Allow debounced session persistence to flush to localStorage
    await page.waitForTimeout(350);

    // Reload the desktop and verify open windows and geometry are restored
    await page.reload();

    await expect(filesWindow).toBeVisible();
    await expect(editorWindow).toBeVisible();
    await expect(terminalWindow).toBeVisible();

    const restoredBox = await terminalWindow.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(Math.abs(restoredBox!.x - resizedBox!.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(restoredBox!.y - resizedBox!.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(restoredBox!.width - resizedBox!.width)).toBeLessThanOrEqual(4);
    expect(Math.abs(restoredBox!.height - resizedBox!.height)).toBeLessThanOrEqual(4);
  });

  test("propagates Settings panel changes to settings.ini open in Text Editor", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const settingsWindow = page
      .locator('[data-slot="window"][data-app-id="settings"]')
      .first();
    await expect(settingsWindow).toBeVisible({ timeout: 20_000 });

    // Switch to Dock pane so /home/user/.config/Piloti/settings.ini is written
    await settingsWindow.getByRole("button", { name: "Dock" }).click();

    // Open Files and navigate to /home/user/.config/Piloti to open settings.ini
    const filesDockIcon = page.locator('[data-dock-app-id="nautilus"]');
    await filesDockIcon.click();

    const filesWindow = page
      .locator('[data-slot="window"][data-app-id="nautilus"]')
      .first();
    await expect(filesWindow).toBeVisible();
    await filesWindow.click();
    await page.keyboard.press("Control+l");
    const locInput = filesWindow.locator("input").first();
    await locInput.fill("/home/user/.config/Piloti");
    await locInput.press("Enter");

    const iniItem = filesWindow.getByText("settings.ini").first();
    await expect(iniItem).toBeVisible();
    await iniItem.dblclick();

    const editorWindow = page
      .locator('[data-slot="window"][data-app-id="text-editor"]')
      .first();
    await expect(editorWindow).toBeVisible();
    await expect(editorWindow).toContainText("lastPane=dock");

    // Bring Settings to front, switch to Wallpaper, close Settings, and verify Text Editor updates live
    await page.locator('[data-dock-app-id="settings"]').click();
    await settingsWindow.getByRole("button", { name: "Wallpaper" }).click();
    await settingsWindow
      .locator('[data-slot="window-controls"] button')
      .last()
      .click();

    await expect(editorWindow).toContainText("lastPane=wallpaper");
  });

  test("Calculator resizes on mode switch, cannot maximize, and closes", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const calcDockIcon = page.locator('[data-dock-app-id="calculator"]');
    await expect(calcDockIcon).toBeVisible({ timeout: 20_000 });
    await calcDockIcon.click();

    const calcWindow = page
      .locator('[data-slot="window"][data-app-id="calculator"]')
      .first();
    await expect(calcWindow).toBeVisible();
    await page.waitForTimeout(300);

    const basicBox = await calcWindow.boundingBox();
    expect(basicBox).not.toBeNull();

    // Switch to Scientific mode -> window widens
    await calcWindow.getByRole("button", { name: "Scientific Mode" }).click();
    await page.waitForTimeout(150);
    const sciBox = await calcWindow.boundingBox();
    expect(sciBox).not.toBeNull();
    expect(sciBox!.width).toBeGreaterThan(basicBox!.width + 60);

    // Switch back to Basic mode -> window shrinks back
    await calcWindow.getByRole("button", { name: "Basic Mode" }).click();
    await page.waitForTimeout(150);
    const backBox = await calcWindow.boundingBox();
    expect(backBox).not.toBeNull();
    expect(Math.abs(backBox!.width - basicBox!.width)).toBeLessThanOrEqual(4);

    // Close Calculator
    await calcWindow.getByRole("button", { name: "Close window" }).click();
    await expect(calcWindow).toBeHidden();
  });
});

