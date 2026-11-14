import { expect, test } from "@playwright/test";

const READ_ONLY = "http://localhost:3211";

test.describe("the owner area", () => {
  test("shows figures, unanswered questions and transcripts", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Questions asked")).toBeVisible();

    await page.getByRole("link", { name: "Do you have a loyalty programme?" }).first().click();
    await expect(page).toHaveURL(/conversations\?c=/);
    const transcript = page.getByRole("region", { name: "Transcript" });
    await expect(transcript.getByText("Declined", { exact: true })).toBeVisible();
    await expect(transcript).toContainText("I couldn't find that");
  });

  test("a new document is answered from straight away, and deleting it stops that", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.getByText("Paste text").click();
    await page.getByLabel("Title").fill("Onboard cinema");
    await page.getByLabel("Text", { exact: true }).fill(
      "# Cinema carriage\nCarriage 6 has a small cinema. Films start at 21:30 and a seat costs €4.",
    );
    await page.getByRole("button", { name: "Add document" }).click();
    await expect(page.getByText("Added. The assistant can answer from it now.")).toBeVisible();
    const row = page.getByRole("row", { name: /Onboard cinema/ });
    await expect(row).toContainText("Pasted text");

    const ask = async () => {
      const response = await page.request.post("/api/chat", { data: { slug: "larkspur", question: "Is there a cinema on the train?" } });
      return JSON.parse((await response.text()).trim().split("\n").at(-1)!);
    };
    const before = await ask();
    expect(before.answered).toBe(true);
    expect(before.answer).toContain("21:30");

    await row.getByRole("button", { name: "Delete Onboard cinema" }).click();
    await row.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.getByRole("row", { name: /Onboard cinema/ })).toHaveCount(0);
    expect((await ask()).answered).toBe(false);
  });

  test("rejects a document with no real content", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.getByText("Paste text").click();
    await page.getByLabel("Title").fill("Empty");
    await page.getByLabel("Text", { exact: true }).fill("too short");
    await page.getByRole("button", { name: "Add document" }).click();
    await expect(page.locator(".form-error")).toHaveText("Content is too short. Write at least 20 characters.");
  });

  test("runs the test set and explains each result", async ({ page }) => {
    await page.goto("/dashboard/quality");
    await page.getByRole("button", { name: "Run all 15 tests" }).click();
    await expect(page.getByRole("heading", { name: "14 of 15 passed" })).toBeVisible();

    const failed = page.getByRole("button", { name: /Missing facts/ });
    await failed.click();
    await expect(page.locator(".detail")).toContainText("Missing from the answer");
    await expect(page.locator(".detail")).toContainText("€25");

    // The run is saved, so it is still there after a reload.
    await page.reload();
    await expect(page.getByRole("heading", { name: "14 of 15 passed" })).toBeVisible();
  });

  test("a changed greeting reaches the chat box", async ({ page }) => {
    await page.goto("/dashboard/settings");
    const greeting = page.getByLabel("Greeting");
    const original = await greeting.inputValue();
    await greeting.fill("All aboard. What can I look up for you?");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    await page.goto("/demo");
    await page.getByRole("button", { name: "Ask Wren" }).click();
    await expect(page.getByText("All aboard. What can I look up for you?")).toBeVisible();

    await page.goto("/dashboard/settings");
    await page.getByLabel("Greeting").fill(original);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  });

  test("shows the one-line embed code for this site", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.locator(".snippet")).toHaveText(
      '<script src="http://localhost:3210/widget.js" data-business="larkspur" async></script>',
    );
  });
});

test.describe("the public, read-only demo", () => {
  test("refuses every change", async ({ request }) => {
    const calls = [
      request.post(`${READ_ONLY}/api/documents`, { data: { title: "x", content: "y".repeat(40) } }),
      request.patch(`${READ_ONLY}/api/settings`, { data: { name: "Hacked" } }),
      request.post(`${READ_ONLY}/api/tests`, { data: { question: "?", keyFacts: ["a"] } }),
      request.delete(`${READ_ONLY}/api/documents/00000000-0000-4000-8000-000000000000`),
      request.patch(`${READ_ONLY}/api/follow-ups/00000000-0000-4000-8000-000000000000`, { data: { status: "done" } }),
    ];
    for (const response of await Promise.all(calls)) {
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("read-only");
    }
  });

  test("still answers questions and switches the edit buttons off", async ({ page }) => {
    await page.goto(`${READ_ONLY}/dashboard/documents`);
    await expect(page.getByText("nothing can be changed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add document" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(0);

    const response = await page.request.post(`${READ_ONLY}/api/chat`, { data: { slug: "larkspur", question: "How many bags can I take?" } });
    expect(await response.text()).toContain("23 kg");
  });
});

// The live site runs on several server copies that share nothing. Two local
// servers stand in for them here: one draws the page, the other gets the click.
test.describe("when another server instance handles the next request", () => {
  test("a rating is accepted for an answer the other instance wrote", async ({ request }) => {
    const chat = await request.post("/api/chat", { data: { slug: "larkspur", question: "Can I bring my dog?" } });
    const done = (await chat.text()).trim().split("\n").map((l) => JSON.parse(l)).find((e) => e.type === "done");
    expect(done.messageId).toBeTruthy();
    const rated = await request.post(`${READ_ONLY}/api/feedback`, { data: { messageId: done.messageId, value: 1 } });
    expect(rated.status()).toBe(200);
  });

  test("test results from one instance fill the table drawn by the other", async ({ page }) => {
    await page.route("**/api/evals/run", async (route) => {
      const response = await route.fetch({ url: `${READ_ONLY}/api/evals/run` });
      await route.fulfill({ response });
    });
    await page.goto("/dashboard/quality");
    await page.getByRole("button", { name: "Run all 15 tests" }).click();
    await expect(page.getByRole("heading", { name: "14 of 15 passed" })).toBeVisible();
    await expect(page.locator(".verdict")).toHaveCount(15);
    await expect(page.getByText("Not run", { exact: true })).toHaveCount(0);
  });

  test("links to seeded conversations open on the other instance", async ({ page }) => {
    await page.goto("/dashboard");
    const link = page.locator(".rows a[href*='conversations?c=']").last();
    const [href, question] = [await link.getAttribute("href"), await link.innerText()];
    await page.goto(`${READ_ONLY}${href}`);
    await expect(page.locator(".transcript")).toContainText(question);
  });
});

test.describe("test runs in the read-only demo", () => {
  test("stay on the page and the overview after a reload", async ({ page }) => {
    await page.goto(`${READ_ONLY}/dashboard/quality`);
    await expect(page.getByRole("heading", { name: "14 of 15 passed" })).toBeVisible();
    await expect(page.locator(".run [role=status]")).toContainText("Last run yesterday");

    await page.getByRole("button", { name: "Run all 15 tests" }).click();
    await expect(page.locator(".run [role=status]")).toContainText("Last run just now");
    await expect(page.getByText("kept in this browser only")).toBeVisible();
    await expect(page.locator(".verdict")).toHaveCount(15);

    await page.reload();
    await expect(page.locator(".run [role=status]")).toContainText("Last run just now");
    await expect(page.locator(".run [role=status]")).toContainText("The run before passed 14 of 15");
    await expect(page.locator(".verdict")).toHaveCount(15);

    await page.goto(`${READ_ONLY}/dashboard`);
    await expect(page.getByText("The last test run passed 14 of 15 questions, just now")).toBeVisible();
  });
});

test.describe("the chat API", () => {
  test("validates its input", async ({ request }) => {
    expect((await request.post("/api/chat", { data: { slug: "larkspur" } })).status()).toBe(400);
    expect((await request.post("/api/chat", { data: { slug: "nobody", question: "hi there" } })).status()).toBe(404);
    expect((await request.post("/api/chat", { data: { slug: "larkspur", question: "x".repeat(601) } })).status()).toBe(400);
    expect((await request.post("/api/feedback", { data: { messageId: "nope", value: 1 } })).status()).toBe(400);
  });

  test("reports a rejected AI key in plain words", async ({ request }) => {
    const response = await request.post("/api/chat", {
      data: { slug: "larkspur", question: "Can I bring my dog on the train?" },
      headers: { "x-askwell-provider": "ollama", "x-askwell-model": "none" },
    });
    // Ollama is not allowed on a production build, so the request falls back to search-only.
    expect(await response.text()).toContain('"mode":"search"');
  });
});
