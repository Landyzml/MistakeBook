import {
  type Notebook,
  type Attachment,
  type Subject,
  type Mistake,
  empty,
} from "./model";
export function dataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(Error("读取图片失败"));
    r.readAsDataURL(blob);
  });
}
export async function exportBackup(data: Notebook) {
  return JSON.stringify({
    format: "mistakebook",
    version: 1,
    exportedAt: new Date().toISOString(),
    subjects: data.subjects,
    mistakes: await Promise.all(
      data.mistakes.map(async (m) => ({
        ...m,
        images: await Promise.all(
          m.images.map(async (i) => ({
            id: i.id,
            name: i.name,
            data: await dataURL(i.blob),
          })),
        ),
      })),
    ),
  });
}
function ensure(v: unknown, msg = "备份格式不正确"): asserts v {
  if (!v) throw Error(msg);
}
function obj(v: unknown): Record<string, unknown> {
  ensure(v && typeof v === "object" && !Array.isArray(v));
  return v as Record<string, unknown>;
}
function str(v: unknown, max = 1000000): string {
  ensure(typeof v === "string" && v.length <= max);
  return v;
}
function date(v: unknown): string {
  const s = str(v, 100);
  ensure(Number.isFinite(Date.parse(s)));
  return new Date(s).toISOString();
}
function strings(v: unknown): string[] {
  ensure(Array.isArray(v) && v.length <= 500);
  return v.map((x) => str(x, 1000));
}
export async function validImage(blob: Blob) {
  ensure(
    ["image/png", "image/jpeg", "image/webp"].includes(blob.type),
    "图片仅支持 PNG、JPG、WEBP",
  );
  ensure(
    blob.size > 0 && blob.size <= 15 * 1024 * 1024,
    "每张图片需要小于 15 MB",
  );
  const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  ensure(
    blob.type === "image/png"
      ? b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71
      : blob.type === "image/jpeg"
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : b[0] === 82 &&
          b[1] === 73 &&
          b[2] === 70 &&
          b[8] === 87 &&
          b[9] === 69 &&
          b[10] === 66 &&
          b[11] === 80,
    "图片内容与格式不匹配",
  );
  if (typeof createImageBitmap === "function") {
    try {
      const im = await createImageBitmap(blob);
      im.close();
    } catch {
      throw Error("图片损坏，无法解码");
    }
  }
}
export async function parseBackup(
  text: string,
  resolveBlob?: (image: Record<string, unknown>) => Promise<Blob>,
): Promise<Notebook> {
  const root = obj(JSON.parse(text));
  ensure(
    root.format === "mistakebook" && root.version === 1,
    "不是受支持的 REWISE 备份文件",
  );
  ensure(Array.isArray(root.subjects) && root.subjects.length <= 10000);
  ensure(Array.isArray(root.mistakes) && root.mistakes.length <= 100000);
  const seen = new Set<string>();
  const unique = (v: unknown) => {
    const id = str(v, 200);
    ensure(id && !seen.has(id), "备份包含空 ID 或重复 ID");
    seen.add(id);
    return id;
  };
  const subjects: Subject[] = root.subjects.map((x) => {
    const s = obj(x);
    const color = str(s.color, 7);
    const name = str(s.name, 60).trim();
    ensure(/^#[0-9a-f]{6}$/i.test(color) && name, "科目名称或颜色不正确");
    return { id: unique(s.id), name, color, createdAt: date(s.createdAt) };
  });
  const subjectIds = new Set(subjects.map((s) => s.id));
  const mistakes: Mistake[] = [];
  for (const x of root.mistakes) {
    const m = obj(x);
    const id = unique(m.id);
    const subjectId = str(m.subjectId, 200);
    ensure(subjectIds.has(subjectId), "错题引用了不存在的科目");
    ensure(["new", "reviewing", "mastered"].includes(str(m.status)));
    ensure(["easy", "medium", "hard"].includes(str(m.difficulty)));
    ensure(Array.isArray(m.images) && m.images.length <= 30);
    const images: Attachment[] = [];
    for (const x of m.images) {
      const i = obj(x);
      let blob: Blob;
      if (resolveBlob) blob = await resolveBlob(i);
      else {
        const encoded = str(i.data, 22 * 1024 * 1024);
        ensure(
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(
            encoded,
          ),
          "图片编码不正确",
        );
        const [head, b64] = encoded.split(",");
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        blob = new Blob([bytes], {
          type: head.slice(5, head.indexOf(";")),
        });
      }
      await validImage(blob);
      images.push({ id: unique(i.id), name: str(i.name, 1000), blob });
    }
    const content = str(m.content);
    ensure(content.trim() || images.length, "错题需要文字或图片");
    mistakes.push({
      id,
      subjectId,
      title: str(m.title, 200),
      content,
      createdAt: date(m.createdAt),
      reviewedAt: m.reviewedAt === undefined ? undefined : date(m.reviewedAt),
      points: strings(m.points),
      tags: strings(m.tags),
      difficulty: m.difficulty as Mistake["difficulty"],
      status: m.status as Mistake["status"],
      wrong: str(m.wrong),
      correct: str(m.correct),
      explanation: str(m.explanation),
      images,
    });
  }
  return { ...empty(), subjects, mistakes };
}
