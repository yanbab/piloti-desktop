import { expect, test } from "@playwright/test";
import { bootDesktop } from "./helpers";

test.describe("Shell & Menubar", () => {
  test("Fitt's law screen borders activate Piloti menu, Control Panel, and Overview", async ({
    page,
  }) => {
    await bootDesktop(page);
    const vp = page.viewportSize()!;

    // Top-left (0, 0) opens Piloti menu
    await page.mouse.click(0, 0);
    await expect(
      page.getByRole("menuitem", { name: "About Computer" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("menuitem", { name: "About Computer" })
    ).toBeHidden();

    // Top-right (width - 1, 0) opens Control Panel
    await page.mouse.click(vp.width - 1, 0);
    await expect(page.getByText("Night Light")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Night Light")).toBeHidden();

    // Top-center (width / 2, 0) opens Overview
    await page.mouse.click(Math.round(vp.width / 2), 0);
    const overviewDialog = page.getByRole("dialog", { name: "Overview" });
    await expect(overviewDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overviewDialog).toBeHidden();
  });

  test("Launcher opens with Alt+Space, filters items, and drags in-screen", async ({
    page,
  }) => {
    await bootDesktop(page);

    await page.keyboard.press("Alt+Space");
    const dragHeader = page.locator("[data-launcher-drag-header]");
    await expect(dragHeader).toBeVisible();

    const initialBox = await dragHeader.boundingBox();
    expect(initialBox).not.toBeNull();

    const hx = initialBox!.x + initialBox!.width / 2;
    const hy = initialBox!.y + initialBox!.height / 2;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx - 140, hy + 100, { steps: 8 });
    await page.mouse.up();

    const movedBox = await dragHeader.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(movedBox!.x).toBeLessThan(initialBox!.x - 80);
    expect(movedBox!.y).toBeGreaterThan(initialBox!.y + 50);

    const searchInput = dragHeader.locator("input").first();
    await searchInput.fill("Calculator");
    await expect(
      page.locator('[data-launcher-item="builtin:calculator"]').first()
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(dragHeader).toBeHidden();
  });
});

