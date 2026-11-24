import { test, expect, type Locator } from "@playwright/test";

async function expectFullImage(image: Locator, width: number, height: number) {
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(width);
  const size = await image.evaluate((el: HTMLImageElement) => {
    const button = el.closest("button")!;
    const style = getComputedStyle(button);
    const box = el.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      naturalHeight: el.naturalHeight,
      innerWidth:
        button.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight),
      loading: el.loading,
    };
  });
  expect(Math.abs(size.width - size.innerWidth)).toBeLessThan(1.01);
  expect(Math.abs(size.height - (size.width * height) / width)).toBeLessThan(1);
  expect(size.naturalHeight).toBe(height);
  expect(size.loading).toBe("lazy");
}

test("科目和全部错题直接展示原题、等比图片和多图切换", async ({
  page,
}, info) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "学习概览" })).toBeVisible();
  const originals = await page.evaluate(async () => {
    async function image(
      id: string,
      name: string,
      width: number,
      height: number,
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fcfbf4";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#263c5d";
      ctx.lineWidth = 8;
      ctx.strokeRect(12, 12, width - 24, height - 24);
      ctx.fillStyle = "#172431";
      ctx.font = "48px sans-serif";
      ctx.fillText("f(x) = x² − 3x + 2", 64, 120);
      ctx.fillText("x ∈ [−2, 4]", 64, 200);
      ctx.fillText("f'(x) = 2x − 3", 64, height - 84);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((value) => resolve(value!)),
      );
      return { id, name, blob };
    }

    const landscape = await image("landscape", "横向原题.png", 1600, 900);
    const portrait = await image("portrait", "纵向原题.png", 800, 1200);
    const date = "2026-11-23T10:00:00Z";
    const base = {
      subjectId: "math",
      createdAt: date,
      points: ["函数"],
      tags: [],
      difficulty: "hard",
      wrong: "不在列表显示的错误答案",
      correct: "不在列表显示的正确答案",
      explanation: "不在列表显示的解析",
      status: "reviewing",
    };
    const notebook = {
      revision: 7,
      subjects: [
        { id: "math", name: "0606 数学", color: "#517464", createdAt: date },
      ],
      mistakes: [
        { ...base, id: "image", title: "", content: "", images: [landscape] },
        {
          ...base,
          id: "mixed",
          title: "求函数的零点",
          content: "第 1 行：读取题图。\n    第 2 行：求 f(x) = 0。",
          images: [{ ...landscape, id: "mixed-landscape" }, portrait],
        },
        {
          ...base,
          id: "text",
          title: "纯文字原题",
          content: "第 1 行：确定定义域。\n第 2 行：写出计算过程。",
          images: [],
        },
      ],
    };

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("mistakebook", 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("notebook", "readwrite");
      tx.objectStore("notebook").put(notebook, "data");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return [landscape.blob.size, portrait.blob.size];
  });

  await page.goto("./#subject/math");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "0606 数学", exact: true }),
  ).toBeVisible();
  const list = page.locator(".mistake-list");
  const rows = list.locator(".mistake-row");
  const imageOnly = rows.filter({
    has: page.getByRole("button", { name: "图片题目", exact: true }),
  });
  const mixed = rows.filter({
    has: page.getByRole("button", { name: "求函数的零点", exact: true }),
  });
  const textOnly = rows.filter({
    has: page.getByRole("button", { name: "纯文字原题", exact: true }),
  });
  await expect(rows).toHaveCount(3);
  await expectFullImage(imageOnly.getByRole("img"), 1600, 900);
  await expect(imageOnly.getByText("0606 数学")).toBeVisible();
  await expect(imageOnly.getByText("困难")).toBeVisible();
  await expect(imageOnly.getByText("复习中")).toBeVisible();
  await expect(imageOnly.locator(".row-date")).toHaveText("2026/11/23");
  await expect(list).not.toContainText(/打开查看题目图片|不在列表显示/);
  await expect(textOnly.getByRole("img")).toHaveCount(0);
  expect(await textOnly.locator(".row-content").textContent()).toBe(
    "第 1 行：确定定义域。\n第 2 行：写出计算过程。",
  );
  await expect(textOnly.locator(".row-content")).toHaveCSS(
    "white-space",
    "pre-wrap",
  );
  await expect(mixed.locator(".row-content")).toContainText("求 f(x) = 0。");
  await expect(mixed.getByRole("img")).toHaveCount(1);
  await expectFullImage(
    mixed.getByRole("img", { name: "横向原题.png" }),
    1600,
    900,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await mixed.getByRole("button", { name: "下一张图片" }).click();
  await expect(mixed.getByText("2 / 2")).toBeVisible();
  const portrait = mixed.getByRole("img", { name: "纵向原题.png" });
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expectFullImage(portrait, 800, 1200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect((await mixed.boundingBox())!.height).toBeGreaterThan(
      (await portrait.boundingBox())!.height,
    );
    if (width === 1440 || width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        animations: "disabled",
        path: info.outputPath(`subject-${width}.png`),
      });
    }
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await mixed.getByRole("button", { name: "上一张图片" }).click();
  await expectFullImage(
    mixed.getByRole("img", { name: "横向原题.png" }),
    1600,
    900,
  );
  await mixed
    .getByRole("button", { name: "求函数的零点", exact: true })
    .locator(".row-title")
    .click();
  await expect(page.getByRole("dialog", { name: "错题详情" })).toContainText(
    "不在列表显示的正确答案",
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();

  await page.goto("./#mistakes");
  await expect(
    page.getByRole("heading", { name: "全部错题", exact: true }),
  ).toBeVisible();
  await page.getByLabel("搜索错题", { exact: true }).fill("零点");
  await expect(rows).toHaveCount(1);
  await expectFullImage(mixed.getByRole("img"), 1600, 900);
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("mistakebook", 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return new Promise<{ revision: number; sizes: number[] }>(
      (resolve, reject) => {
        const req = db
          .transaction("notebook")
          .objectStore("notebook")
          .get("data");
        req.onsuccess = () => {
          const record = req.result;
          resolve({
            revision: record.revision,
            sizes: record.mistakes[1].images.map(
              (image: { blob: Blob }) => image.blob.size,
            ),
          });
          db.close();
        };
        req.onerror = () => reject(req.error);
      },
    );
  });
  expect(saved).toEqual({ revision: 7, sizes: originals });
});
