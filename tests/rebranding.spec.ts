import { test, expect } from "@playwright/test";
test("品牌资源、全局搜索与已有数据无损读取", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveTitle(/REWISE/);
  for (const asset of [
    "logo.svg",
    "logo-icon.svg",
    "favicon.svg",
    "app-icon.svg",
    "logo.png",
    "logo-icon.png",
    "favicon.png",
    "app-icon.png",
  ]) {
    const url = new URL("brand/" + asset, page.url().split("#")[0]).href;
    expect((await page.request.get(url)).status()).toBe(200);
  }
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("mistakebook", 2);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("notebook", "readwrite");
      tx.objectStore("notebook").put(
        {
          revision: 42,
          subjects: [
            {
              id: "legacy-subject",
              name: "数学分析",
              color: "#517464",
              createdAt: "2026-11-01T00:00:00Z",
            },
          ],
          mistakes: [
            {
              id: "legacy-question",
              subjectId: "legacy-subject",
              title: "极限的定义",
              content: "重品牌后仍保留的旧数据与公式 lim x → 0",
              createdAt: "2026-11-01T00:00:00Z",
              points: ["极限"],
              tags: ["旧版"],
              difficulty: "hard",
              wrong: "0",
              correct: "1",
              explanation: "保持原有解释",
              status: "reviewing",
              images: [],
            },
          ],
        },
        "data",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByLabel("全局搜索").fill("旧版");
  await page.getByLabel("全局搜索").press("Enter");
  await expect(page.locator(".mistake-row")).toHaveCount(1);
  await page.locator(".mistake-row").click();
  await expect(
    page.getByRole("heading", { name: "极限的定义", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("保持原有解释", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await expect(page.locator(".mistake-row")).toHaveCount(1);
  const record = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("mistakebook", 2);
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<any>((resolve) => {
      const r = db.transaction("notebook").objectStore("notebook").get("data");
      r.onsuccess = () => {
        resolve(r.result);
        db.close();
      };
    });
  });
  expect(record.revision).toBe(42);
  expect(record.mistakes[0].id).toBe("legacy-question");
  expect(record.mistakes[0].status).toBe("reviewing");
});
