import { test, expect } from "@playwright/test";
test("原生文件句柄持久化、自动同步、替换与恢复副本", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).showSaveFilePicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getFileHandle("MistakeBook-backup.zip", { create: true });
    };
  });
  await page.goto("./#settings");
  await page
    .getByRole("button", { name: "设置电脑保存位置", exact: true })
    .click();
  await page.getByRole("button", { name: "确认启用自动保存" }).click();
  await expect(page.locator(".sync-status")).toContainText("已自动保存到电脑");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "我的科目" })
    .click();
  await page
    .getByRole("button", { name: "创建科目", exact: true })
    .first()
    .click();
  await page.getByLabel("科目名称").fill("自动保存测试");
  await page.getByRole("button", { name: "保存科目" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(1800);
  await page.goto("./#settings");
  await expect(page.locator(".sync-status")).toContainText("已自动保存到电脑");
  const bytes = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle("MistakeBook-backup.zip");
    return Array.from(
      new Uint8Array(await (await handle.getFile()).arrayBuffer()),
    );
  });
  expect(bytes[0]).toBe(80);
  await page.reload();
  await expect(page.locator(".sync-status")).toContainText("已自动保存到电脑");
  await expect(
    page.locator(".settings-panel").filter({ hasText: "导出完整错题本" }),
  ).toContainText("1 个科目");
  // Export one-subject backup, change current state, then explicitly replace.
  const dlEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整备份", exact: true }).click();
  const dl = await dlEvent;
  const path = await dl.path();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "我的科目" })
    .click();
  await page
    .getByRole("button", { name: "创建科目", exact: true })
    .first()
    .click();
  await page.getByLabel("科目名称").fill("替换前应恢复");
  await page.getByRole("button", { name: "保存科目" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "设置与备份" })
    .click();
  await page.locator("input[type=file]").setInputFiles(path!);
  await page.getByLabel("替换全部现有记录").check();
  await expect(
    page.getByRole("button", { name: "确认替换导入" }),
  ).toBeDisabled();
  await page.getByLabel("替换确认文字").fill("替换错题本");
  await page.getByRole("button", { name: "确认替换导入" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".settings-panel").filter({ hasText: "导出完整错题本" }),
  ).toContainText("1 个科目");
  const recoveryEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载替换前恢复副本" }).click();
  const recovery = await recoveryEvent;
  await page
    .locator("input[type=file]")
    .setInputFiles((await recovery.path())!);
  await expect(page.getByRole("dialog")).toContainText("2 个科目");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "重新选择保存位置" }).click();
  await expect(page.getByRole("dialog")).toContainText("发现已有备份");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.screenshot({ path: "../../work/settings-v2.png", fullPage: true });
});
test("不支持文件API时提供ZIP降级", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined });
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("./#settings");
  await expect(page.getByText(/此浏览器不支持直接写入电脑文件/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "设置电脑保存位置", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "下载完整备份", exact: true }).first(),
  ).toBeVisible();
});

test("真正关闭并重开浏览器后仍保留数据库", async ({ playwright }, info) => {
  const profile = info.outputPath("browser-profile");
  const options = {
    executablePath:
      "/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev",
    headless: true,
  };
  let context = await playwright.chromium.launchPersistentContext(
    profile,
    options,
  );
  let tab = await context.newPage();
  await tab.goto(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173");
  await tab.getByRole("button", { name: "创建新科目" }).click();
  await tab.getByLabel("科目名称").fill("重启后仍保留");
  await tab.getByRole("button", { name: "保存科目" }).click();
  await expect(tab.getByRole("dialog")).toHaveCount(0);
  await context.close();
  context = await playwright.chromium.launchPersistentContext(profile, options);
  tab = await context.newPage();
  await tab.goto(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173");
  await expect(
    tab.getByRole("heading", { name: "重启后仍保留", exact: true }),
  ).toBeVisible();
  await context.close();
});
