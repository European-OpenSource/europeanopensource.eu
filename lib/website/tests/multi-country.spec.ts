import { test, expect } from "@playwright/test";

test.describe("Country filter in catalog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForSelector("#projects-grid");
  });

  test("country select is present with All Countries default", async ({ page }) => {
    const select = page.locator("select#country");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("");
  });

  test("country select has options derived from projects", async ({ page }) => {
    const options = await page.locator("select#country option").allTextContents();
    expect(options[0]).toBe("All Countries");
    expect(options.length).toBeGreaterThan(1);
    expect(options).toContain("Italy");
  });

  test("selecting a country shows only matching projects", async ({ page }) => {
    const select = page.locator("select#country");
    await select.selectOption("italy");
    await page.waitForTimeout(400);

    const visibleWrappers = page.locator(".project-card-wrapper:visible");
    const count = await visibleWrappers.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const dataCountry = await visibleWrappers.nth(i).getAttribute("data-country");
      expect(dataCountry?.split(",")).toContain("italy");
    }
  });

  test("reset filters clears country filter and shows all projects", async ({ page }) => {
    const select = page.locator("select#country");
    await select.selectOption("italy");
    await page.waitForTimeout(400);

    await page.locator("#filters-reset").click();
    await page.waitForTimeout(400);

    await expect(select).toHaveValue("");
    const url = page.url();
    expect(url).not.toContain("country=");
  });

  test("country filter persists in URL", async ({ page }) => {
    const select = page.locator("select#country");
    await select.selectOption("france");
    await page.waitForTimeout(400);

    const url = page.url();
    expect(url).toContain("country=france");
  });

  test("country filter initializes from URL param", async ({ page }) => {
    await page.goto("/projects?country=germany");
    await page.waitForSelector("#projects-grid");
    await page.waitForTimeout(400);

    const select = page.locator("select#country");
    await expect(select).toHaveValue("germany");

    const visibleWrappers = page.locator(".project-card-wrapper:visible");
    const count = await visibleWrappers.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const dataCountry = await visibleWrappers.nth(i).getAttribute("data-country");
      expect(dataCountry?.split(",")).toContain("germany");
    }
  });
});

test.describe("Project detail page — country badges", () => {
  test("single-country project shows one country badge with link", async ({ page }) => {
    await page.goto("/projects/capsule-6f5262");
    const countryBadges = page.locator(".project-detail-badges a[href^='/projects/country/']");
    await expect(countryBadges).toHaveCount(1);
    await expect(countryBadges.first()).toContainText("Italy");
    await expect(countryBadges.first()).toHaveAttribute("href", "/projects/country/italy");
  });

  test("country badge icons are on the left (eos-label-icon-start)", async ({ page }) => {
    await page.goto("/projects/capsule-6f5262");
    const countryBadge = page
      .locator(".project-detail-badges a[href^='/projects/country/']")
      .first();
    await expect(countryBadge).toHaveClass(/eos-label-icon-start/);
  });

  test("detail card badges use icon-start for language, license, platform", async ({ page }) => {
    await page.goto("/projects/capsule-6f5262");
    const metaBadges = page.locator(".project-detail-card__meta .eos-label-with-icon");
    const count = await metaBadges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(metaBadges.nth(i)).toHaveClass(/eos-label-icon-start/);
    }
  });
});

test.describe("Country pages", () => {
  test("country page is generated for italy (>= 1 project)", async ({ page }) => {
    const response = await page.goto("/projects/country/italy");
    expect(response?.status()).toBe(200);
  });

  test("country page shows projects for that country", async ({ page }) => {
    await page.goto("/projects/country/italy");
    const cards = page.locator(".project-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Project cards — max 3 tags", () => {
  test("cards show at most 3 tags", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForSelector("#projects-grid");
    await page.waitForTimeout(300);

    const cards = page.locator(".project-card:visible");
    const cardCount = await cards.count();

    for (let i = 0; i < Math.min(cardCount, 10); i++) {
      const tags = cards.nth(i).locator(".project-card__tags .eos-label");
      const tagCount = await tags.count();
      expect(tagCount).toBeLessThanOrEqual(3);
    }
  });
});
