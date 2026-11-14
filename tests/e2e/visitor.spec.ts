import { expect, test } from "@playwright/test";

test.describe("a visitor on the demo site", () => {
  test("gets an answer with its source, and can rate it", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Ask Wren" }).click();
    const chat = page.getByRole("region", { name: "Chat with Wren" });
    await expect(chat.getByText("I'm Wren")).toBeVisible();

    await chat.getByRole("button", { name: "Can I bring my dog?" }).click();
    const answer = chat.locator(".chat-answer").last();
    await expect(answer).toContainText("A pet ticket costs €30 per animal");

    const source = answer.getByRole("button", { name: /Luggage, bikes and pets/ });
    await source.click();
    await expect(source).toHaveAttribute("aria-expanded", "true");
    await expect(answer.locator(".chat-excerpt")).toContainText("Dogs and cats are welcome");

    await answer.getByRole("button", { name: "Yes" }).click();
    await expect(answer.getByText("Glad it helped. Thanks for telling us.")).toBeVisible();
    // The question is answered, so the buttons go away.
    await expect(answer.getByRole("button", { name: "Yes" })).toHaveCount(0);
    await expect(answer.getByRole("button", { name: "No" })).toHaveCount(0);
  });

  test("is told when the documents have no answer, and can leave an email", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Ask Wren" }).click();
    const chat = page.getByRole("region", { name: "Chat with Wren" });

    await chat.getByLabel("Ask Wren a question").fill("Can I pay with Bitcoin?");
    await chat.getByLabel("Ask Wren a question").press("Enter");
    const answer = chat.locator(".chat-answer").last();
    await expect(answer).toContainText("I couldn't find that");
    await expect(answer.locator(".chat-sources")).toHaveCount(0);

    await answer.getByLabel("Your email").fill("not-an-email");
    await answer.getByRole("button", { name: "Ask a person" }).click();
    await expect(answer.getByText("Sent.")).toHaveCount(0);

    await answer.getByLabel("Your email").fill("dana@example.com");
    await answer.getByRole("button", { name: "Ask a person" }).click();
    await expect(answer.getByText("Sent. Someone from Larkspur Night Line will reply by email.")).toBeVisible();

    // The owner sees the question and a masked address, never the real one.
    await page.goto("/dashboard/follow-ups");
    const row = page.getByRole("row", { name: /Can I pay with Bitcoin/ }).first();
    await expect(row).toContainText("d•••@example.com");
    await expect(page.getByText("dana@example.com")).toHaveCount(0);
  });

  test("keeps the chat usable with the keyboard alone", async ({ page }) => {
    await page.goto("/demo");
    const launcher = page.getByRole("button", { name: "Ask Wren" });
    await launcher.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Ask Wren a question")).toBeFocused();
    await page.keyboard.type("When does boarding close?");
    await page.keyboard.press("Enter");
    await expect(page.locator(".chat-answer").last()).toContainText("closes 5 minutes before");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Chat with Wren" })).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });
});

test.describe("the home page", () => {
  test("marks the cited passage in the document when an answer arrives", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every answer comes with the page it came from.");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    await page.getByRole("button", { name: "Is breakfast included?" }).click();
    await expect(page.locator(".desk .chat-answer").last()).toContainText("Breakfast is included with Sleeper cabin");

    await expect(page.getByRole("tab", { name: "Food and drink on board" })).toHaveAttribute("aria-selected", "true");
    const marked = page.locator(".desk-sheet [data-marked]");
    await expect(marked).toHaveCount(1);
    await expect(marked.getByRole("heading")).toHaveText("What is included");
    // The highlighter has finished drawing across the passage.
    await expect(marked.locator("p > span").first()).toHaveCSS("background-size", "100% 100%");
  });

  test("shows a score computed from the live test set", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".score-big")).toContainText("of 15 test questions passed");
    await expect(page.locator(".score-big b")).toHaveText("14");
  });

  test("has no horizontal scroll", async ({ page }) => {
    for (const path of ["/", "/demo", "/dashboard", "/dashboard/quality"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test("the embed script adds a chat frame to another page", async ({ page }) => {
  await page.route("**/host-page", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Host</title><h1>Someone else's site</h1><script src="/widget.js" data-business="larkspur"></script>`,
    }),
  );
  await page.goto("/host-page");
  const frame = page.frameLocator('iframe[title="Support chat"]');
  await frame.getByRole("button", { name: "Ask Wren" }).click();
  await expect(frame.getByText("I'm Wren")).toBeVisible();
  await expect
    .poll(async () => (await page.locator("iframe").boundingBox())?.height ?? 0)
    .toBeGreaterThan(300);
});
