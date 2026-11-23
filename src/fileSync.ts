import type { Notebook } from "./model";
import { createZip } from "./zipBackup";
import { getSetting, setSetting, readNotebook } from "./storage";
export interface BackupHandle {
  name: string;
  getFile(): Promise<File>;
  queryPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<{
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
}
export interface FileRecord {
  handle: BackupHandle;
  stamp: string;
  lastSaved?: string;
}
export interface SyncState {
  status: "unset" | "pending" | "saving" | "saved" | "permission" | "error";
  name?: string;
  message?: string;
  lastSaved?: string;
}
export interface FileWindow extends Window {
  showSaveFilePicker?: (options: unknown) => Promise<BackupHandle>;
  showOpenFilePicker?: (options: unknown) => Promise<BackupHandle[]>;
}
export const fileWindow = (
  typeof window !== "undefined" ? window : {}
) as FileWindow;
export const fileStamp = (file: File) => `${file.size}:${file.lastModified}`;
export class SyncQueue {
  private initialization: Promise<void> | null = null;
  private latest: Notebook | null = null;
  private pending = false;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private record: FileRecord | null = null;
  private listeners = new Set<(s: SyncState) => void>();
  state: SyncState = { status: "unset" };
  constructor(
    private encode = createZip,
    private persist = (r: FileRecord) => setSetting("computerFile", r),
    private fresh = readNotebook,
  ) {}
  subscribe(listener: (s: SyncState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(state: SyncState) {
    this.state = {
      ...state,
      name: this.record?.handle.name,
      lastSaved: this.record?.lastSaved,
    };
    this.listeners.forEach((l) => l(this.state));
  }
  async init() {
    return (this.initialization ||= this.initialize());
  }
  private async initialize() {
    const record = await getSetting<FileRecord>("computerFile");
    if (!record) return;
    this.record = record;
    await this.check();
  }
  enqueue(data: Notebook) {
    this.latest = data;
    this.pending = true;
    if (!this.record) return;
    this.emit({
      status:
        this.state.status === "permission"
          ? "permission"
          : this.state.status === "error"
            ? "error"
            : "pending",
      message: this.state.message,
    });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 1500);
  }
  async attach(record: FileRecord) {
    await this.running;
    clearTimeout(this.timer);
    this.record = record;
    await this.persist(record);
    this.emit({ status: "pending" });
    await this.flush();
  }
  async check() {
    if (!this.record) {
      this.emit({ status: "unset" });
      return;
    }
    try {
      const permission = await this.record.handle.queryPermission({
        mode: "readwrite",
      });
      if (permission !== "granted") {
        this.emit({ status: "permission" });
        return;
      }
      const file = await this.record.handle.getFile();
      if (fileStamp(file) !== this.record.stamp)
        throw Error("电脑文件已在其他位置修改，请重新选择并确认如何处理");
      this.emit({ status: this.pending ? "pending" : "saved" });
      if (this.pending) await this.flush();
    } catch (e) {
      this.emit({ status: "error", message: (e as Error).message });
    }
  }
  async authorize() {
    if (!this.record) return;
    try {
      const permission = await this.record.handle.requestPermission({
        mode: "readwrite",
      });
      if (permission !== "granted") {
        this.emit({ status: "permission" });
        return;
      }
      this.pending = true;
      await this.flush();
    } catch (e) {
      this.emit({ status: "error", message: (e as Error).message });
    }
  }
  async flush() {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (!this.record || !this.latest) return;
    this.pending = true;
    this.running = this.drain();
    try {
      await this.running;
    } finally {
      this.running = null;
      if (
        this.pending &&
        this.state.status !== "error" &&
        this.state.status !== "permission"
      )
        await this.flush();
    }
  }
  private async drain() {
    while (this.pending && this.record && this.latest) {
      this.pending = false;
      const record = this.record;
      try {
        if (
          (await record.handle.queryPermission({ mode: "readwrite" })) !==
          "granted"
        ) {
          this.pending = true;
          this.emit({ status: "permission" });
          return;
        }
        this.emit({ status: "saving" });
        const write = async () => {
          const latest = await this.fresh();
          const before = await record.handle.getFile();
          if (fileStamp(before) !== record.stamp)
            throw Error(
              "电脑文件已在其他位置修改。为避免覆盖，请重新选择并确认如何处理。",
            );
          const bytes = await this.encode(latest);
          const stream = await record.handle.createWritable();
          try {
            await stream.write(bytes);
            await stream.close();
          } catch (e) {
            await stream.abort().catch(() => {});
            throw e;
          }
          const saved = await record.handle.getFile();
          record.stamp = fileStamp(saved);
          record.lastSaved = new Date().toISOString();
          await this.persist(record);
        };
        if (typeof navigator !== "undefined" && navigator.locks)
          await navigator.locks.request("mistakebook-computer-sync", write);
        else await write();
        this.emit({ status: this.pending ? "pending" : "saved" });
      } catch (e) {
        this.pending = true;
        const permission = (e as Error).name === "NotAllowedError";
        this.emit({
          status: permission ? "permission" : "error",
          message: (e as Error).message,
        });
        return;
      }
    }
  }
}
export const syncQueue = new SyncQueue();
