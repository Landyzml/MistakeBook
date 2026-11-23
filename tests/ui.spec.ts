import { test, expect } from "@playwright/test";
test("完整录题、复习、备份、图片与响应布局", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "学习概览", exact: true }),
  ).toBeVisible();
  async function create(name: string) {
    await page.getByRole("button", { name: "创建新科目" }).click();
    await page.getByLabel("科目名称").fill(name);
    await page.getByRole("button", { name: "保存科目" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await create("高等数学");
  await create("大学物理");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "我的科目" })
    .click();
  await page.getByRole("button", { name: "编辑科目" }).first().click();
  await page.getByLabel("科目名称").fill("数学分析");
  await page
    .getByRole("button", { name: "选择颜色 #5d7c9b", exact: true })
    .click();
  await page.getByRole("button", { name: "保存科目" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "高等数学" }).count();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "全部错题" })
    .click();
  await page
    .getByRole("button", { name: "记录错题", exact: true })
    .first()
    .click();
  await page.getByLabel("题目标题").fill("极限与连续性");
  await page.getByLabel("题目内容").fill("求 lim (sin x)/x，x 趋于 0。");
  await page.getByLabel("知识点").fill("函数极限，三角函数");
  await page.getByLabel("自定义标签").fill("期中复习");
  await page.getByLabel("我的错误答案").fill("0");
  await page.getByLabel("正确答案", { exact: true }).fill("1");
  await page.getByLabel("详细解析").fill("利用重要极限。");
  const png = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 100;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 200, 100);
      ctx.fillStyle = "#222";
      ctx.fillText("x + 2 = 5", 20, 50);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page.getByLabel("上传题目图片").setInputFiles([
    { name: "题图一.png", mimeType: "image/png", buffer: png },
    { name: "题图二.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(
    page.getByRole("button", { name: "放大 题图一.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存错题", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /极限与连续性/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /极限与连续性/ }).click();
  await page.getByRole("button", { name: "编辑错题" }).click();
  await page.getByLabel("题目标题").fill("重要极限");
  await page.getByRole("button", { name: "保存错题", exact: true }).click();
  await page.getByRole("button", { name: "复制", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "重要极限（副本）" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑错题" }).click();
  await page.getByLabel("所属科目").selectOption({ label: "大学物理" });
  await page.getByRole("button", { name: "保存错题", exact: true }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByLabel("搜索错题").fill("函数极限");
  await expect(page.locator(".mistake-row")).toHaveCount(2);
  await page.getByLabel("筛选科目").selectOption({ label: "大学物理" });
  await expect(page.locator(".mistake-row")).toHaveCount(1);
  await page.getByRole("button", { name: /重要极限（副本）/ }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "专注复习" })
    .click();
  await page.getByRole("button", { name: "随机复习" }).click();
  await expect(page.getByText("利用重要极限。", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "查看答案与解析" }).click();
  await expect(page.getByText("利用重要极限。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "已掌握", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "本轮复习完成" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "设置与备份" })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整备份", exact: true }).click();
  const dl = await downloaded;
  const path = await dl.path();
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "确认导入备份" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认合并导入" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "全部错题" })
    .click();
  await expect(page.locator(".mistake-row")).toHaveCount(2);
  await page.locator(".mistake-row").last().click();
  await expect(page.locator(".image-tile img")).toHaveCount(2);
  expect(
    await page
      .locator(".image-tile img")
      .evaluateAll((imgs) =>
        imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "放大 题图一.png" }).click();
  await expect(page.locator(".zoom img")).toBeVisible();
  await page
    .getByRole("dialog", { name: "题目图片" })
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "我的科目" })
    .click();
  await page.getByRole("button", { name: "删除", exact: true }).first().click();
  await page.getByLabel("迁移目标科目").selectOption({ index: 1 });
  await page.getByRole("button", { name: "确认删除科目" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "全部错题" })
    .click();
  await expect(page.locator(".mistake-row")).toHaveCount(2);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "学习概览" })
    .click();
  await page.screenshot({ path: "../../work/dashboard.png", fullPage: true });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `../../work/mobile-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test("纯图片录题、移除图片、非法导入与清空保护", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "创建新科目" }).click();
  await page.getByLabel("科目名称").fill("语言练习");
  await page.getByRole("button", { name: "保存科目" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "记录错题", exact: true })
    .first()
    .click();
  const png = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 50;
      c.height = 50;
      return c.toDataURL().split(",")[1];
    }),
    "base64",
  );
  await page.getByLabel("上传题目图片").setInputFiles([
    { name: "保留.png", mimeType: "image/png", buffer: png },
    { name: "移除.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.locator(".image-tile")).toHaveCount(2);
  await page
    .getByRole("button", { name: "移除 移除.png", exact: true })
    .click();
  await page.getByRole("button", { name: "保存错题", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /图片题目/ }).click();
  await expect(page.locator(".image-tile img")).toHaveCount(1);
  await page.getByLabel("修改复习状态").selectOption("reviewing");
  await expect(page.getByRole("status")).toContainText("复习状态已更新");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "设置与备份" })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "错误备份.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"wrong"}'),
  });
  await expect(page.getByRole("alert")).toContainText("未导入任何数据");
  await page.getByRole("alert").getByRole("button", { name: "关闭" }).click();
  await page.getByRole("button", { name: "清空所有数据" }).click();
  await expect(
    page.getByRole("button", { name: "永久清空", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("输入清空确认文字").fill("清空错题本");
  await page.getByRole("button", { name: "永久清空", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("0 个科目 · 0 道错题 · 0 张图片")).toBeVisible();
});
