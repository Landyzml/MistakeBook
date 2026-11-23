import { empty, type Notebook } from "./model";
let connection: Promise<IDBDatabase> | undefined;
function open() {
  return (connection ||= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("mistakebook", 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("notebook"))
        r.result.createObjectStore("notebook");
      if (!r.result.objectStoreNames.contains("settings"))
        r.result.createObjectStore("settings");
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        connection = undefined;
      };
      resolve(r.result);
    };
    r.onerror = () => {
      connection = undefined;
      reject(r.error);
    };
  }));
}
export async function readNotebook(): Promise<Notebook> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readonly");
    const r = tx.objectStore("notebook").get("data");
    r.onsuccess = () => resolve(r.result ?? empty());
    r.onerror = () => reject(r.error);
  });
}
export async function saveNotebook(next: Notebook): Promise<Notebook> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readwrite");
    const store = tx.objectStore("notebook");
    const r = store.get("data");
    let conflict = false;
    const result = { ...next, revision: next.revision + 1 };
    r.onsuccess = () => {
      if ((r.result?.revision ?? 0) !== next.revision) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(result, "data");
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? Error("保存失败"));
    tx.onabort = () =>
      reject(
        Error(
          conflict
            ? "另一个标签页已更新数据，请刷新后重试。当前修改尚未保存。"
            : "保存失败，请检查浏览器存储空间。",
        ),
      );
  });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readonly");
    const r = tx.objectStore("settings").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? Error("保存设置失败"));
  });
}
export async function replaceWithRecovery(
  current: Notebook,
  incoming: Notebook,
): Promise<Notebook> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["notebook", "settings"], "readwrite");
    const store = tx.objectStore("notebook");
    const r = store.get("data");
    const next = { ...incoming, revision: current.revision + 1 };
    r.onsuccess = () => {
      if ((r.result?.revision ?? 0) !== current.revision) {
        tx.abort();
        return;
      }
      tx.objectStore("settings").put(
        { ...current, recoveredAt: new Date().toISOString() },
        "recovery",
      );
      store.put(next, "data");
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(Error("替换失败：数据可能已被另一个标签页修改，请刷新后重试"));
  });
}
