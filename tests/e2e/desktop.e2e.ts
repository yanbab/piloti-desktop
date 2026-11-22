import { expect, test } from "@playwright/test";

test.describe("Piloti Desktop E2E", () => {
  test("opens apps, moves and resizes a window, and restores state on reload", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const filesDockIcon = page.locator('[data-dock-app-id="nautilus"]');
    const editorDockIcon = page.locator('[data-dock-app-id="text-editor"]');
    const terminalDockIcon = page.locator('[data-dock-app-id="terminal"]');

    await expect(filesDockIcon).toBeVisible({ timeout: 35_000 });

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

    // Switch to Dock pane so /home/user/.config/piloti/settings.ini is written
    await settingsWindow.getByRole("button", { name: "Dock" }).click();

    // Open Files and navigate to /home/user/.config/piloti to open settings.ini
    const filesDockIcon = page.locator('[data-dock-app-id="nautilus"]');
    await filesDockIcon.click();

    const filesWindow = page
      .locator('[data-slot="window"][data-app-id="nautilus"]')
      .first();
    await expect(filesWindow).toBeVisible();
    await filesWindow.click();
    await page.keyboard.press("Control+l");
    const locInput = filesWindow.locator("input").first();
    await locInput.fill("/home/user/.config/piloti");
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

  test("Fitt's law: screen borders activate menubar, overview, control panel, and auto-hidden dock", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const dock = page.locator('[data-slot="dock"]');
    await expect(dock).toBeVisible({ timeout: 20_000 });
    const vp = page.viewportSize()!;

    // 1. Clicking top-left corner (0, 0) opens the Piloti Menu
    await page.mouse.click(0, 0);
    await expect(page.getByRole("menuitem", { name: "About Computer" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "About Computer" })).toBeHidden();

    // 2. Clicking top-right corner (width - 1, 0) opens Control Panel
    await page.mouse.click(vp.width - 1, 0);
    await expect(page.getByText("Night Light")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Night Light")).toBeHidden();

    // 3. Clicking middle-top border (width / 2, 0) opens Windows Overview
    await page.mouse.click(Math.round(vp.width / 2), 0);
    const overviewDialog = page.getByRole("dialog", { name: "Overview" });
    await expect(overviewDialog).toBeVisible();
    await page.mouse.click(Math.round(vp.width / 2), 0);
    await expect(overviewDialog).toBeHidden();

    // 4. Enable Dock Auto-Hide in Settings
    const settingsWindow = page
      .locator('[data-slot="window"][data-app-id="settings"]')
      .first();
    await expect(settingsWindow).toBeVisible();
    await settingsWindow.getByRole("button", { name: "Dock" }).click();
    const autoHideRow = settingsWindow
      .locator('[data-slot="grouped-form-row"]')
      .filter({ hasText: "Hide" });
    await autoHideRow.locator('[data-slot="switch"]').click();
    await settingsWindow
      .locator('[data-slot="window-controls"] button')
      .last()
      .click();
    await expect(settingsWindow).toBeHidden();

    // Move cursor away to center so auto-hidden dock hides
    await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
    await expect(dock).toHaveAttribute("data-state", "hidden");

    // 5. Moving mouse anywhere on bottom border shows the auto-hidden Dock
    await page.mouse.move(24, vp.height - 1);
    await expect(dock).toHaveAttribute("data-state", "visible");
    await page.waitForTimeout(350);

    // 6. Clicking in the middle of the bottom border activates the closest Dock icon
    const midX = Math.round(vp.width / 2);
    const closestAppId = await page.evaluate((x) => {
      const tiles = Array.from(
        document.querySelectorAll<HTMLElement>('[data-slot="dock-item"][data-dock-app-id]')
      );
      let bestId = "";
      let bestDist = Infinity;
      for (const tile of tiles) {
        const r = tile.getBoundingClientRect();
        const dist = Math.abs(x - (r.left + r.width / 2));
        if (dist < bestDist) {
          bestDist = dist;
          bestId = tile.getAttribute("data-dock-app-id") ?? "";
        }
      }
      return bestId;
    }, midX);
    expect(closestAppId).not.toBe("");

    await page.mouse.click(midX, vp.height - 1);
    await expect(
      page.locator(`[data-slot="window"][data-app-id="${closestAppId}"]`).first()
    ).toBeVisible();
  });

  test("Launcher header drag moves popup in-screen and Desktop Console persists across tabs", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Open Launcher via top-bar button
    await page.locator('[data-menubar-nav="launcher"]').click();
    const dragHeader = page.locator("[data-launcher-drag-header]");
    await expect(dragHeader).toBeVisible();
    const popup = page.locator('[data-slot="dropdown-menu-content"]').first();
    const initialBox = await popup.boundingBox();
    expect(initialBox).not.toBeNull();

    // Drag header search field down and left
    const hx = initialBox!.x + initialBox!.width / 2;
    const hy = initialBox!.y + 20;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx - 220, hy + 140, { steps: 10 });
    await page.mouse.up();

    const movedBox = await popup.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(movedBox!.x).toBeLessThan(initialBox!.x - 150);
    expect(movedBox!.y).toBeGreaterThan(initialBox!.y + 90);

    // Drag back to top-right corner -> clamped neatly back to original top-right spot
    const mx = movedBox!.x + movedBox!.width / 2;
    const my = movedBox!.y + 20;
    await page.mouse.move(mx, my);
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + initialBox!.width / 2 + 120, 20, { steps: 10 });
    await page.mouse.up();

    const cornerBox = await popup.boundingBox();
    expect(cornerBox).not.toBeNull();
    expect(Math.abs(cornerBox!.x - initialBox!.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(cornerBox!.y - initialBox!.y)).toBeLessThanOrEqual(4);
    await page.keyboard.press("Escape");

    // Desktop Console persistence across tab switches
    await page.locator('[data-dock-app-id="console"]').click();
    const consoleWindow = page
      .locator('[data-slot="window"][data-app-id="console"]')
      .first();
    await expect(consoleWindow).toBeVisible();

    const replInput = consoleWindow.locator("textarea").first();
    await replInput.fill("40 + 2");
    await replInput.press("Enter");
    await expect(consoleWindow).toContainText("42");

    await consoleWindow.getByRole("button", { name: /Logs/ }).click();
    await consoleWindow.getByRole("button", { name: /^Console$/ }).click();
    await expect(consoleWindow).toContainText("42");

    // Keyboard shortcut Alt+Space opens Launcher and Escape closes it
    await page.keyboard.press("Alt+Space");
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();

    // Files floating left status pill and right zoom slider pill
    await page.locator('[data-dock-app-id="nautilus"]').click();
    const filesWindow = page
      .locator('[data-slot="window"][data-app-id="nautilus"]')
      .first();
    await expect(filesWindow).toBeVisible();
    await expect(filesWindow.getByTestId("files-status-pill")).toBeVisible();
    await expect(filesWindow.getByRole("slider", { name: "Zoom" })).toBeVisible();
  });

  test("live-editing /home/user/.config/piloti/settings.ini in Text Editor updates shell settings immediately", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Open Files and navigate directly to /home/user/.config/piloti
    const filesDockIcon = page.locator('[data-dock-app-id="nautilus"]');
    await expect(filesDockIcon).toBeVisible({ timeout: 35_000 });
    await filesDockIcon.click();

    const filesWindow = page
      .locator('[data-slot="window"][data-app-id="nautilus"]')
      .first();
    await expect(filesWindow).toBeVisible();
    await page.waitForTimeout(250);
    const filesGrid = filesWindow.getByRole("grid").first();
    await expect(filesGrid).toBeVisible();
    await filesGrid.click();
    await page.keyboard.press("Control+l");
    const locInput = filesWindow.locator("input").first();
    await expect(locInput).toBeVisible();
    await locInput.fill("/home/user/.config/piloti");
    await locInput.press("Enter");

    const settingsIniItem = filesWindow.getByText("settings.ini").first();
    await expect(settingsIniItem).toBeVisible();
    await settingsIniItem.dblclick();

    const editorWindow = page
      .locator('[data-slot="window"][data-app-id="text-editor"]')
      .first();
    await expect(editorWindow).toBeVisible();

    const editorTextbox = editorWindow.getByRole("textbox").first();
    await expect(editorWindow).toContainText("interface-theme=piloti");

    // Edit interface-theme line live in Text Editor (CodeMirror) and press Ctrl/Cmd+S
    const themeLine = editorTextbox
      .locator(".cm-line", { hasText: "interface-theme=" })
      .first();
    await themeLine.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.insertText("interface-theme=adwaita");
    await editorTextbox.press("Control+s");

    // Live shell reflects the VFS edit without reload
    await expect(page.locator("html")).toHaveAttribute(
      "data-interface-theme",
      "adwaita"
    );

    // Persists via VFS across full page reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-interface-theme",
      "adwaita"
    );
  });

  test("double-click titlebar/headerbar maximizes and unmaximizes, and simulated USB mounts/ejects across Dock and Folders", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // SSD titlebar double-click (Settings)
    const settingsWindow = page
      .locator('[data-slot="window"][data-app-id="settings"]')
      .first();
    await expect(settingsWindow).toBeVisible({ timeout: 25_000 });
    await page.waitForTimeout(300);

    const ssdTitlebar = settingsWindow.locator('[data-slot="window-titlebar"]').first();
    const ssdBox = await ssdTitlebar.boundingBox();
    expect(ssdBox).not.toBeNull();
    await page.mouse.dblclick(ssdBox!.x + ssdBox!.width * 0.5, ssdBox!.y + ssdBox!.height * 0.5);
    await expect(settingsWindow).toHaveAttribute("data-maximized", "true");
    await page.waitForTimeout(450);

    const ssdMaxBox = await ssdTitlebar.boundingBox();
    expect(ssdMaxBox).not.toBeNull();
    await page.mouse.dblclick(
      ssdMaxBox!.x + ssdMaxBox!.width * 0.5,
      ssdMaxBox!.y + ssdMaxBox!.height * 0.5
    );
    await expect(settingsWindow).not.toHaveAttribute("data-maximized", "true");
    await page.waitForTimeout(450);

    // Folders headerbar double-click + SSD titlebar double-click (Terminal)
    await page.locator('[data-dock-app-id="terminal"]').click();
    const terminalWindow = page
      .locator('[data-slot="window"][data-app-id="terminal"]')
      .first();
    await expect(terminalWindow).toBeVisible();
    await page.waitForTimeout(300);

    const termTitlebar = terminalWindow.locator('[data-slot="window-titlebar"]').first();
    const termBox = await termTitlebar.boundingBox();
    expect(termBox).not.toBeNull();
    await page.mouse.dblclick(termBox!.x + termBox!.width * 0.5, termBox!.y + termBox!.height * 0.5);
    await expect(terminalWindow).toHaveAttribute("data-maximized", "true");
    await page.waitForTimeout(450);

    const termMaxBox = await termTitlebar.boundingBox();
    expect(termMaxBox).not.toBeNull();
    await page.mouse.dblclick(
      termMaxBox!.x + termMaxBox!.width * 0.5,
      termMaxBox!.y + termMaxBox!.height * 0.5
    );
    await expect(terminalWindow).not.toHaveAttribute("data-maximized", "true");
    await page.waitForTimeout(450);

    // Bring Settings forward, go to Advanced, verify Engine switch & Mount USB Drive
    await page.locator('[data-dock-app-id="settings"]').click();
    await settingsWindow.getByRole("button", { name: "Advanced" }).click();
    await expect(settingsWindow.getByLabel("Use engine:web")).toBeDisabled();

    const mountBtn = settingsWindow.getByRole("button", { name: "Mount USB Drive" });
    await expect(mountBtn).toBeVisible();
    await mountBtn.click();

    const usbDockItem = page.locator('[data-dock-context="usb"]');
    await expect(usbDockItem).toBeVisible();

    // Open USB drive from Dock -> opens Folders into /media/user/PILOTI_USB
    await usbDockItem.click();
    const foldersWindow = page
      .locator('[data-slot="window"][data-app-id="nautilus"]')
      .first();
    await expect(foldersWindow).toBeVisible();
    await expect(foldersWindow).toContainText("PILOTI USB");
    await expect(foldersWindow.getByText("README.txt")).toBeVisible();

    // Inner Adwaita headerbar double-click on Folders maximizes/unmaximizes
    await page.waitForTimeout(300);
    const foldersHeader = foldersWindow.locator('[data-slot="window-titlebar"]').last();
    const fhBox = await foldersHeader.boundingBox();
    expect(fhBox).not.toBeNull();
    await page.mouse.dblclick(fhBox!.x + fhBox!.width * 0.5, fhBox!.y + fhBox!.height * 0.5);
    await expect(foldersWindow).toHaveAttribute("data-maximized", "true");
    await page.waitForTimeout(450);
    const fhMaxBox = await foldersHeader.boundingBox();
    expect(fhMaxBox).not.toBeNull();
    await page.mouse.dblclick(fhMaxBox!.x + fhMaxBox!.width * 0.5, fhMaxBox!.y + fhMaxBox!.height * 0.5);
    await expect(foldersWindow).not.toHaveAttribute("data-maximized", "true");
    await page.waitForTimeout(450);

    // Eject via the sidebar eject button on the right
    const ejectBtn = foldersWindow.getByRole("button", { name: "Eject USB Drive" });
    await expect(ejectBtn).toBeVisible();
    await ejectBtn.click();

    await expect(usbDockItem).toBeHidden();
    await expect(ejectBtn).toBeHidden();
  });
});

