import { expect, test } from "@playwright/test";
import { bootDesktop, getAppWindow, launchFromDock } from "./helpers";

test.describe("Folders, Text Editor & Settings", () => {
  test("Settings Appearance theme change updates shell and Security switches Apps/Permissions", async ({
    page,
  }) => {
    await bootDesktop(page);

    const settingsWin = await launchFromDock(page, "settings");
    await settingsWin.getByRole("button", { name: "Appearance" }).click();
    await settingsWin.getByRole("button", { name: "Adwaita" }).click();

    await expect(page.locator("html")).toHaveAttribute(
      "data-interface-theme",
      "adwaita"
    );

    await settingsWin.getByRole("button", { name: "Permissions" }).click();
    await expect(
      settingsWin.getByRole("button", { name: "Permissions", exact: true }).last()
    ).toBeVisible();
    await settingsWin
      .getByRole("button", { name: "Permissions", exact: true })
      .last()
      .click();
    await expect(
      settingsWin.locator('[data-slot="settings-list-row"]', {
        hasText: "Notifications",
      })
    ).toBeVisible();
  });

  test("Folders navigates to ~/.config/piloti, opens settings.ini in Texts, and mounts/ejects USB", async ({
    page,
  }) => {
    await bootDesktop(page);

    const filesWin = await launchFromDock(page, "nautilus");
    await expect(filesWin.getByTestId("files-status-pill")).toBeVisible();

    const filesGrid = filesWin.getByRole("grid").first();
    await expect(filesGrid).toBeVisible();
    await filesGrid.click();
    await page.keyboard.press("Control+l");

    const locInput = filesWin.locator("input").first();
    await expect(locInput).toBeVisible();
    await locInput.fill("/home/user/.config/piloti");
    await locInput.press("Enter");

    const settingsIni = filesWin.getByText("settings.ini").first();
    await expect(settingsIni).toBeVisible();
    await settingsIni.dblclick();

    const textsWin = getAppWindow(page, "texts");
    await expect(textsWin).toBeVisible();
    await expect(textsWin).toContainText("settings.ini");

    // Mount and eject simulated USB via Settings -> Advanced
    const settingsWin = await launchFromDock(page, "settings");
    await settingsWin.getByRole("button", { name: "Advanced" }).click();
    const mountBtn = settingsWin.getByRole("button", {
      name: "Mount USB Drive",
    });
    await expect(mountBtn).toBeVisible();
    await mountBtn.click();

    const usbDockItem = page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "PILOTI USB" });
    await expect(usbDockItem).toBeVisible();
    await usbDockItem.click();

    const usbFilesWin = page
      .locator('[data-slot="window"][data-app-id="nautilus"]')
      .last();
    await expect(usbFilesWin).toContainText("PILOTI USB");
    const ejectBtn = usbFilesWin.getByRole("button", {
      name: "Eject USB Drive",
    });
    await expect(ejectBtn).toBeVisible();
    await ejectBtn.click();

    await expect(usbDockItem).toBeHidden();
  });
});

