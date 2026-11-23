import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { empty } from "../src/model";
import { readNotebook, getSetting } from "../src/storage";
test("升级数据库保留v1原有记录，不清空数据", async () => {
  const data = {
    ...empty(),
    revision: 9,
    subjects: [
      {
        id: "old-subject",
        name: "原有科目",
        color: "#517464",
        createdAt: new Date().toISOString(),
      },
    ],
  };
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open("mistakebook", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("notebook");
    r.onsuccess = () => {
      const tx = r.result.transaction("notebook", "readwrite");
      tx.objectStore("notebook").put(data, "data");
      tx.oncomplete = () => {
        r.result.close();
        resolve();
      };
    };
    r.onerror = () => reject(r.error);
  });
  assert.deepEqual(await readNotebook(), data);
  assert.equal(await getSetting("computerFile"), undefined);
});
