import JSZip from "jszip";
import type { Notebook } from "./model";
import { parseBackup } from "./backup";
const fail = (message: string): never => {
  throw Error(message);
};
async function hash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function createZip(data: Notebook): Promise<Uint8Array> {
  const zip = new JSZip();
  const mistakes = [];
  for (const m of data.mistakes) {
    const images = [];
    for (const i of m.images) {
      const bytes = new Uint8Array(await i.blob.arrayBuffer());
      const path = `images/${encodeURIComponent(i.id)}.${i.blob.type === "image/png" ? "png" : i.blob.type === "image/webp" ? "webp" : "jpg"}`;
      zip.file(path, bytes);
      images.push({
        id: i.id,
        name: i.name,
        path,
        type: i.blob.type,
        size: bytes.length,
        sha256: await hash(bytes),
      });
    }
    mistakes.push({ ...m, images });
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      format: "mistakebook",
      version: 1,
      subjects: data.subjects,
      mistakes,
    }),
  );
  zip.file("data.json", bytes);
  zip.file(
    "manifest.json",
    JSON.stringify({
      format: "mistakebook-zip",
      version: 1,
      exportedAt: new Date().toISOString(),
      dataSha256: await hash(bytes),
      subjects: data.subjects.length,
      mistakes: data.mistakes.length,
      images: data.mistakes.reduce((n, m) => n + m.images.length, 0),
    }),
  );
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 3 },
  });
}
export async function readBackup(file: Blob): Promise<Notebook> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 80 || bytes[1] !== 75) {
    return parseBackup(new TextDecoder().decode(bytes));
  }
  // Inspect declared lengths before decompression to reject archive bombs.
  const zip = await JSZip.loadAsync(bytes);
  let total = 0;
  for (const entry of Object.values(zip.files)) {
    const raw = entry as unknown as {
      _data?: { uncompressedSize: number };
      unsafeOriginalName?: string;
    };
    if (raw.unsafeOriginalName && raw.unsafeOriginalName !== entry.name)
      fail("备份包含不安全的文件路径");
    total += raw._data?.uncompressedSize ?? 0;
    if (total > 1024 * 1024 * 1024)
      fail("解压后的备份超过 1 GB，请拆分整理后重试");
  }
  const manifestFile = zip.file("manifest.json"),
    dataFile = zip.file("data.json");
  if (!manifestFile || !dataFile) fail("ZIP 缺少 manifest.json 或 data.json");
  const manifest = JSON.parse(await manifestFile!.async("string"));
  if (manifest.format !== "mistakebook-zip" || manifest.version !== 1)
    fail("不支持的 ZIP 备份版本");
  const data = await dataFile!.async("uint8array");
  if ((await hash(data)) !== manifest.dataSha256)
    fail("备份数据完整性校验失败");
  const referenced = new Set(["manifest.json", "data.json"]);
  const notebook = await parseBackup(
    new TextDecoder().decode(data),
    async (i) => {
      if (
        typeof i.path !== "string" ||
        !/^images\/[A-Za-z0-9%_.!~*'()-]+\.(png|webp|jpg)$/.test(i.path)
      )
        fail("图片路径不正确");
      const path = i.path as string;
      if (referenced.has(path)) fail("图片路径重复");
      referenced.add(path);
      const entry = zip.file(path);
      if (!entry) fail("备份缺少图片文件");
      const b = await entry!.async("uint8array");
      if (b.length !== i.size || (await hash(b)) !== i.sha256)
        fail("图片完整性校验失败");
      return new Blob([new Uint8Array(b)], {
        type: typeof i.type === "string" ? i.type : "",
      });
    },
  );
  if (
    manifest.subjects !== notebook.subjects.length ||
    manifest.mistakes !== notebook.mistakes.length ||
    manifest.images !==
      notebook.mistakes.reduce((n, m) => n + m.images.length, 0)
  )
    fail("备份统计与内容不一致");
  for (const entry of Object.values(zip.files))
    if (!entry.dir && !referenced.has(entry.name)) fail("备份含有未声明文件");
  return notebook;
}
export function downloadZip(
  bytes: Uint8Array,
  name = "MistakeBook-backup.zip",
) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
