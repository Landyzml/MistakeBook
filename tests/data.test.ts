import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  empty,
  selectMistakes,
  initialFilters,
  removeSubject,
  mergeNotebook,
  type Notebook,
} from "../src/model";
import { readNotebook, saveNotebook } from "../src/storage";
import { parseBackup, validImage } from "../src/backup";
const d: Notebook = {
  ...empty(),
  subjects: [
    {
      id: "s1",
      name: "数学",
      color: "#517464",
      createdAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "s2",
      name: "物理",
      color: "#517464",
      createdAt: "2026-11-02T00:00:00Z",
    },
  ],
  mistakes: [
    {
      id: "m1",
      subjectId: "s1",
      title: "函数",
      content: "求导数",
      createdAt: "2026-11-02T00:00:00Z",
      points: ["导数"],
      tags: ["期中"],
      difficulty: "hard",
      wrong: "0",
      correct: "2x",
      explanation: "幂函数求导",
      status: "new",
      images: [],
    },
    {
      id: "m2",
      subjectId: "s2",
      title: "力学",
      content: "质量",
      createdAt: "2026-11-01T00:00:00Z",
      points: [],
      tags: [],
      difficulty: "easy",
      wrong: "",
      correct: "",
      explanation: "",
      status: "mastered",
      images: [],
    },
  ],
};
test("组合搜索与排序", () => {
  assert.equal(
    selectMistakes(d, {
      ...initialFilters,
      search: "数学 导数",
      status: "new",
      difficulty: "hard",
      from: "2026-11-01",
      to: "2026-11-03",
      point: "导数",
    }).length,
    1,
  );
  assert.equal(
    selectMistakes(d, { ...initialFilters, search: "期中" })[0].id,
    "m1",
  );
  assert.equal(
    selectMistakes(d, { ...initialFilters, sort: "oldest" })[0].id,
    "m2",
  );
  assert.equal(
    selectMistakes(d, { ...initialFilters, subject: "s2", status: "new" })
      .length,
    0,
  );
});
test("删除迁移不丢失错题；删除关联题", () => {
  assert.equal(removeSubject(d, "s1", "s2").mistakes.length, 2);
  assert.equal(removeSubject(d, "s1", "s2").mistakes[0].subjectId, "s2");
  assert.equal(removeSubject(d, "s1").mistakes.length, 1);
  assert.throws(() => removeSubject(d, "s1", "s1"));
});
test("合并分配新ID且保留数据", () => {
  const r = mergeNotebook(d, d);
  assert.equal(r.mistakes.length, 4);
  assert.equal(new Set(r.mistakes.map((m) => m.id)).size, 4);
  assert.notEqual(r.mistakes[2].subjectId, "s1");
});
test("事务保存与重新读取；拒绝过期标签页覆盖", async () => {
  assert.deepEqual(await readNotebook(), empty());
  const saved = await saveNotebook(d);
  assert.deepEqual(await readNotebook(), saved);
  await assert.rejects(saveNotebook(d), /另一个标签页/);
  assert.deepEqual(await readNotebook(), saved);
});
test("备份字段校验和悬空科目拒绝", async () => {
  const raw = { format: "mistakebook", version: 1, ...d };
  assert.equal((await parseBackup(JSON.stringify(raw))).mistakes.length, 2);
  await assert.rejects(
    parseBackup(
      JSON.stringify({
        ...raw,
        mistakes: [{ ...d.mistakes[0], subjectId: "missing" }],
      }),
    ),
  );
  await assert.rejects(
    parseBackup(
      JSON.stringify({ ...raw, subjects: [d.subjects[0], d.subjects[0]] }),
    ),
  );
  await assert.rejects(
    parseBackup(
      JSON.stringify({
        ...raw,
        mistakes: [{ ...d.mistakes[0], content: "", images: [] }],
      }),
    ),
  );
  await assert.rejects(validImage(new Blob(["bad"], { type: "image/png" })));
});
