import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import JSZip from "jszip";
import { createZip, readBackup } from "../src/zipBackup";
import { SyncQueue, fileStamp, type BackupHandle } from "../src/fileSync";
import { empty, type Notebook } from "../src/model";
import {
  replaceWithRecovery,
  readNotebook,
  saveNotebook,
  getSetting,
} from "../src/storage";
const sample = (): Notebook => ({
  ...empty(),
  subjects: [
    {
      id: "s",
      name: "数学",
      color: "#517464",
      createdAt: new Date().toISOString(),
    },
  ],
  mistakes: [
    {
      id: "m",
      subjectId: "s",
      title: "题目",
      content: "测试",
      createdAt: new Date().toISOString(),
      reviewedAt: undefined,
      points: ["函数"],
      tags: ["期中"],
      difficulty: "hard",
      wrong: "0",
      correct: "1",
      explanation: "解析",
      status: "new",
      images: [],
    },
  ],
});
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  ),
);
test("ZIP全字段、ID、日期和原始图片字节往返", async () => {
  const data = sample();
  data.mistakes[0].images = [
    { id: "i", name: "原图.png", blob: new Blob([png], { type: "image/png" }) },
  ];
  const bytes = await createZip(data);
  const parsed = await readBackup(new Blob([new Uint8Array(bytes)]));
  assert.deepEqual(
    { ...parsed, mistakes: parsed.mistakes.map((m) => ({ ...m, images: [] })) },
    { ...data, mistakes: data.mistakes.map((m) => ({ ...m, images: [] })) },
  );
  assert.deepEqual(
    new Uint8Array(await parsed.mistakes[0].images[0].blob.arrayBuffer()),
    png,
  );
  const zip = await JSZip.loadAsync(bytes);
  zip.file("images/i.png", new Uint8Array([1, 2, 3]));
  await assert.rejects(
    readBackup(new Blob([await zip.generateAsync({ type: "uint8array" })])),
    /完整性/,
  );
  zip.remove("data.json");
  await assert.rejects(
    readBackup(new Blob([await zip.generateAsync({ type: "uint8array" })])),
    /缺少/,
  );
});
function fixture() {
  let file = new File([], "backup.zip", { lastModified: 1 });
  let permission: PermissionState = "granted";
  let fail = false;
  let active = 0,
    max = 0,
    writes = 0;
  let latest = sample();
  const handle: BackupHandle = {
    name: file.name,
    getFile: async () => file,
    queryPermission: async () => permission,
    requestPermission: async () => {
      permission = "granted";
      return permission;
    },
    createWritable: async () => {
      active++;
      max = Math.max(max, active);
      let contents = new Uint8Array();
      return {
        write: async (b) => {
          if (fail) throw Error("磁盘写入失败");
          contents = b;
          await new Promise((r) => setTimeout(r, 5));
        },
        close: async () => {
          file = new File([new Uint8Array(contents)], file.name, {
            lastModified: Date.now(),
          });
          active--;
          writes++;
        },
        abort: async () => {
          active--;
        },
      };
    },
  };
  let record = { handle, stamp: fileStamp(file) };
  const queue = new SyncQueue(
    createZip,
    async (r) => {
      record = r;
    },
    async () => latest,
  );
  return {
    queue,
    handle,
    file: () => file,
    permission: (p: PermissionState) => (permission = p),
    fail: (v: boolean) => (fail = v),
    update: (d: Notebook) => {
      latest = d;
      queue.enqueue(d);
    },
    record: () => record,
    max: () => max,
    writes: () => writes,
  };
}
test("防抖与串行写入保证最终版本", async () => {
  const f = fixture();
  f.update(sample());
  await f.queue.attach(f.record());
  const first = { ...sample(), revision: 2 };
  f.update(first);
  const running = f.queue.flush();
  const latest = {
    ...sample(),
    revision: 3,
    subjects: [{ ...first.subjects[0], name: "最终修改" }],
  };
  f.update(latest);
  await running;
  await f.queue.flush();
  assert.equal(f.max(), 1);
  assert.equal((await readBackup(f.file())).subjects[0].name, "最终修改");
  assert.equal(f.queue.state.status, "saved");
  assert.ok(f.writes() >= 2);
});
test("权限续期、失败重试及外部文件保护", async () => {
  const f = fixture();
  f.update(sample());
  f.permission("prompt");
  await f.queue.attach(f.record());
  assert.equal(f.queue.state.status, "permission");
  await f.queue.authorize();
  assert.equal(f.queue.state.status, "saved");
  f.fail(true);
  f.update({ ...sample(), revision: 2 });
  await f.queue.flush();
  assert.equal(f.queue.state.status, "error");
  f.fail(false);
  await f.queue.flush();
  assert.equal(f.queue.state.status, "saved");
  f.record().stamp = "outdated";
  f.update(sample());
  await f.queue.flush();
  assert.equal(f.queue.state.status, "error");
  assert.match(f.queue.state.message!, /其他位置修改/);
});
test("替换导入原子保存恢复副本", async () => {
  const current = await saveNotebook(sample());
  const saved = await replaceWithRecovery(current, empty());
  assert.equal((await readNotebook()).mistakes.length, 0);
  assert.equal((await getSetting<Notebook>("recovery"))!.mistakes.length, 1);
  await assert.rejects(replaceWithRecovery(current, empty()));
  assert.equal((await readNotebook()).revision, saved.revision);
});
