export type Status = "new" | "reviewing" | "mastered";
export type Difficulty = "easy" | "medium" | "hard";
export interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}
export interface Attachment {
  id: string;
  name: string;
  blob: Blob;
}
export interface Mistake {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  createdAt: string;
  reviewedAt?: string;
  points: string[];
  tags: string[];
  difficulty: Difficulty;
  wrong: string;
  correct: string;
  explanation: string;
  status: Status;
  images: Attachment[];
}
export interface Notebook {
  subjects: Subject[];
  mistakes: Mistake[];
  revision: number;
}
export const empty = (): Notebook => ({
  subjects: [],
  mistakes: [],
  revision: 0,
});
export const uid = () => crypto.randomUUID();
export const statuses: Record<Status, string> = {
  new: "未复习",
  reviewing: "复习中",
  mastered: "已掌握",
};
export const difficulties: Record<Difficulty, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};
export const split = (v: string) => [
  ...new Set(
    v
      .split(/[,，、\n]/)
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];
export interface Filters {
  search: string;
  subject: string;
  status: string;
  difficulty: string;
  from: string;
  to: string;
  sort: string;
  point: string;
}
export const initialFilters: Filters = {
  search: "",
  subject: "",
  status: "",
  difficulty: "",
  from: "",
  to: "",
  sort: "newest",
  point: "",
};
export function selectMistakes(data: Notebook, f: Filters) {
  const terms = f.search
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return data.mistakes
    .filter((m) => {
      const hay = [
        m.title,
        m.content,
        data.subjects.find((s) => s.id === m.subjectId)?.name,
        ...m.points,
        ...m.tags,
      ]
        .join(" ")
        .toLocaleLowerCase();
      const d = new Date(m.createdAt);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return (
        terms.every((t) => hay.includes(t)) &&
        (!f.subject || m.subjectId === f.subject) &&
        (!f.status || m.status === f.status) &&
        (!f.difficulty || m.difficulty === f.difficulty) &&
        (!f.point || m.points.includes(f.point)) &&
        (!f.from || day >= f.from) &&
        (!f.to || day <= f.to)
      );
    })
    .sort((a, b) =>
      f.sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : f.sort === "reviewed"
          ? (b.reviewedAt || "").localeCompare(a.reviewedAt || "")
          : f.sort === "difficulty"
            ? ["easy", "medium", "hard"].indexOf(b.difficulty) -
                ["easy", "medium", "hard"].indexOf(a.difficulty) ||
              b.createdAt.localeCompare(a.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
    );
}
export function removeSubject(
  data: Notebook,
  id: string,
  target?: string,
): Notebook {
  if (target && !data.subjects.some((s) => s.id === target && target !== id))
    throw Error("请选择有效的目标科目");
  return {
    ...data,
    subjects: data.subjects.filter((s) => s.id !== id),
    mistakes: target
      ? data.mistakes.map((m) =>
          m.subjectId === id ? { ...m, subjectId: target } : m,
        )
      : data.mistakes.filter((m) => m.subjectId !== id),
  };
}
export function mergeNotebook(data: Notebook, incoming: Notebook): Notebook {
  const ids = new Map(incoming.subjects.map((s) => [s.id, uid()]));
  return {
    ...data,
    subjects: [
      ...data.subjects,
      ...incoming.subjects.map((s) => ({ ...s, id: ids.get(s.id)! })),
    ],
    mistakes: [
      ...data.mistakes,
      ...incoming.mistakes.map((m) => ({
        ...m,
        id: uid(),
        subjectId: ids.get(m.subjectId)!,
        images: m.images.map((i) => ({ ...i, id: uid() })),
      })),
    ],
  };
}
