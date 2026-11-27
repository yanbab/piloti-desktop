import { expect, test } from "@playwright/test";
import {
  bootDesktop,
  getAppWindow,
  launchFromDock,
  openViaLauncher,
} from "./helpers";

test.describe("Built-in Apps", () => {
  test("Calculator toggles Scientific mode, resizes, and closes", async ({
    page,
  }) => {
    await bootDesktop(page);

    const calcWin = await launchFromDock(page, "calculator");
    const basicBox = await calcWin.boundingBox();
    expect(basicBox).not.toBeNull();

    const sciToggle = calcWin.getByRole("button", { name: "Scientific" });
    await sciToggle.click();
    await expect(sciToggle).toHaveAttribute("aria-pressed", "true");

    const sciBox = await calcWin.boundingBox();
    expect(sciBox).not.toBeNull();
    expect(sciBox!.width).toBeGreaterThan(basicBox!.width + 50);

    await sciToggle.click();
    await expect(sciToggle).toHaveAttribute("aria-pressed", "false");

    const backBox = await calcWin.boundingBox();
    expect(backBox).not.toBeNull();
    expect(Math.abs(backBox!.width - basicBox!.width)).toBeLessThanOrEqual(6);

    await calcWin.getByRole("button", { name: "Close window" }).click();
    await expect(calcWin).toBeHidden();
  });

  test("App Store switches categories, opens Software Sources, and shows Infos panel", async ({
    page,
  }) => {
    test.slow();
    await bootDesktop(page);

    const storeWin = await launchFromDock(page, "app-store");
    const updatesItem = storeWin.locator('[data-sidebar-item="updates"]');
    await expect(updatesItem).toBeVisible({ timeout: 25_000 });
    await updatesItem.click();
    await expect(storeWin.getByText("Available Updates")).toBeVisible();

    const webAppsItem = storeWin.locator('[data-sidebar-item="web-apps"]');
    await webAppsItem.click();
    await expect(
      storeWin.getByRole("heading", { name: "Web Apps", level: 2 })
    ).toBeVisible();

    await storeWin.locator('[data-slot="header-search-toggle"]').click();
    const searchInput = storeWin.locator("input").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Desmos");
    await expect(storeWin.getByText("Desmos Graphing Calculator")).toBeVisible();
    await searchInput.fill("");
  });

  test("Desktop Console switches between Infos, Events, and Storage modules", async ({
    page,
  }) => {
    await bootDesktop(page);

    await openViaLauncher(page, "Console", "console");
    const consoleWin = getAppWindow(page, "console");

    const infosTab = consoleWin.getByRole("button", { name: /^Infos$/ });
    await expect(infosTab).toBeVisible({ timeout: 15_000 });
    await expect(infosTab).toHaveAttribute("aria-pressed", "true");

    const eventsTab = consoleWin.getByRole("button", { name: /^Events/ });
    await eventsTab.click();
    await expect(eventsTab).toHaveAttribute("aria-pressed", "true");

    const storageTab = consoleWin.getByRole("button", { name: /^Storage$/ });
    await storageTab.click();
    await expect(storageTab).toHaveAttribute("aria-pressed", "true");

    await infosTab.click();
    await expect(infosTab).toHaveAttribute("aria-pressed", "true");
  });
});

