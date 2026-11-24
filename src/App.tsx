import { useState, useEffect, useRef, type FormEvent } from "react";
import { brandAsset } from "./brand";
import { MistakeRow } from "./MistakeRow";
import {
  LayoutDashboard,
  BookOpen,
  Library,
  RotateCcw,
  Settings,
  Plus,
  Search,
  ChevronRight,
  ArrowUpRight,
  Download,
  Upload as UploadIcon,
  ShieldCheck,
  Check,
  Shuffle,
  SlidersHorizontal,
  BookMarked,
  Menu,
  PenLine,
  Copy,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import {
  type Notebook,
  type Mistake,
  type Subject,
  type Attachment,
  type Status,
  empty,
  uid,
  statuses,
  difficulties,
  initialFilters,
  selectMistakes,
  removeSubject,
  mergeNotebook,
  split,
} from "./model";
import {
  readNotebook,
  saveNotebook,
  replaceWithRecovery,
  getSetting,
} from "./storage";
import { createZip, readBackup, downloadZip } from "./zipBackup";
import {
  syncQueue,
  fileWindow,
  fileStamp,
  type BackupHandle,
  type SyncState,
} from "./fileSync";
import { ComputerStorage, syncLabels } from "./ComputerStorage";

import {
  Modal,
  Images,
  Picture,
  Upload,
  Empty,
  DeleteButton,
} from "./components";
const nav = [
  ["dashboard", "学习概览", LayoutDashboard],
  ["mistakes", "全部错题", BookOpen],
  ["subjects", "我的科目", Library],
  ["review", "专注复习", RotateCcw],
  ["settings", "设置与备份", Settings],
] as const;
const date = (s: string) =>
  new Date(s).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
const colors = [
  "#517464",
  "#5d7c9b",
  "#a47b45",
  "#9a6874",
  "#72778e",
  "#5a8984",
];
function newMistake(subjectId: string): Mistake {
  return {
    id: uid(),
    subjectId,
    title: "",
    content: "",
    createdAt: new Date().toISOString(),
    points: [],
    tags: [],
    difficulty: "medium",
    wrong: "",
    correct: "",
    explanation: "",
    status: "new",
    images: [],
  };
}
export default function App() {
  const [globalSearch, setGlobalSearch] = useState("");
  const searchIntent = useRef<string | null>(null);
  const globalInput = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Notebook>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [route, setRoute] = useState(location.hash.slice(1) || "dashboard");
  const [mobile, setMobile] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [advanced, setAdvanced] = useState(false);
  const [subjectEdit, setSubjectEdit] = useState<Subject | null>(null);
  const [subjectDelete, setSubjectDelete] = useState<Subject | null>(null);
  const [editor, setEditor] = useState<Mistake | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Attachment | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    text: string;
    run: () => Promise<void>;
  } | null>(null);
  const [sync, setSync] = useState<SyncState>(syncQueue.state);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [candidate, setCandidate] = useState<{
    handle: BackupHandle;
    stamp: string;
    data: Notebook | null;
    invalid?: string;
  } | null>(null);
  const [importHandle, setImportHandle] = useState<BackupHandle | null>(null);
  const [useImportFile, setUseImportFile] = useState(false);
  const [importMode, setImportMode] = useState("merge");
  const [replaceConfirm, setReplaceConfirm] = useState("");
  const [incoming, setIncoming] = useState<Notebook | null>(null);
  const [clearText, setClearText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [reviewSubject, setReviewSubject] = useState("");
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [session, setSession] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    readNotebook()
      .then((d) => {
        setData(d);
        setReady(true);
      })
      .catch((e) =>
        setError(`无法打开本地数据库：${e.message}。请允许浏览器存储后刷新。`),
      );
    const listener = () => {
      setRoute(location.hash.slice(1) || "dashboard");
      setMobile(false);
      setFilters({ ...initialFilters, search: searchIntent.current ?? "" });
      searchIntent.current = null;
      setDetail(null);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const unsubscribe = syncQueue.subscribe(setSync);
    void syncQueue
      .init()
      .catch((e) => setError("无法读取电脑保存位置：" + e.message));
    const storage = navigator.storage;
    if (storage?.persisted)
      void storage
        .persisted()
        .then(async (granted) => {
          setPersistent(granted || (await storage.persist?.()) || false);
        })
        .catch(() => setPersistent(false));
    const visibility = () => {
      if (document.visibilityState === "hidden") void syncQueue.flush();
    };
    const before = (e: BeforeUnloadEvent) => {
      if (syncQueue.state.name && syncQueue.state.status !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", before);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("beforeunload", before);
    };
  }, []);
  useEffect(() => {
    if (ready) syncQueue.enqueue(data);
  }, [data, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (route === "settings")
      navigator.storage
        ?.estimate()
        .then(setStorage)
        .catch(() => {});
  }, [route, data]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        globalInput.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function globalSubmit(e: FormEvent) {
    e.preventDefault();
    if (route === "mistakes")
      setFilters({ ...initialFilters, search: globalSearch });
    else {
      searchIntent.current = globalSearch;
      go("mistakes");
    }
  }
  function go(r: string) {
    if (r === route) {
      setFilters(initialFilters);
      setMobile(false);
    } else location.hash = r;
  }
  async function commit(next: Notebook, message = "已保存") {
    if (lock.current) throw Error("正在保存，请稍后重试");
    lock.current = true;
    setBusy(true);
    try {
      const saved = await saveNotebook(next);
      setData(saved);
      setToast(message);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function perform(task: () => Promise<void>) {
    void task().catch(() => {});
  }
  function add() {
    if (!data.subjects.length) {
      setToast("先创建一个科目，开始整理错题");
      setSubjectEdit({
        id: uid(),
        name: "",
        color: colors[0],
        createdAt: new Date().toISOString(),
      });
      return;
    }
    setEditor(
      newMistake(
        route.startsWith("subject/") ? route.slice(8) : data.subjects[0].id,
      ),
    );
  }
  const activeSubject = route.startsWith("subject/")
    ? data.subjects.find((s) => s.id === route.slice(8))
    : undefined;
  const current = data.mistakes.find((m) => m.id === detail);
  const pending = data.mistakes.filter((m) => m.status !== "mastered").length;
  const mastered = data.mistakes.length - pending;
  const list = selectMistakes(data, {
    ...filters,
    subject: activeSubject?.id || filters.subject,
  });
  const recent = selectMistakes(data, initialFilters).slice(0, 5);
  const activeReview =
    session && index < session.length
      ? data.mistakes.find((m) => m.id === session[index])
      : null;
  const reviewPool = data.mistakes.filter(
    (m) =>
      (!reviewSubject || m.subjectId === reviewSubject) &&
      (reviewStatus === "pending"
        ? m.status !== "mastered"
        : !reviewStatus || m.status === reviewStatus),
  );
  function startReview(random: boolean) {
    const ids = reviewPool.map((m) => m.id);
    if (random)
      for (let n = ids.length - 1; n > 0; n--) {
        const j = Math.floor(Math.random() * (n + 1));
        [ids[n], ids[j]] = [ids[j], ids[n]];
      }
    setSession(ids);
    setIndex(0);
    setRevealed(false);
  }
  async function changeStatus(m: Mistake, status: Status) {
    await commit(
      {
        ...data,
        mistakes: data.mistakes.map((x) =>
          x.id === m.id
            ? { ...x, status, reviewedAt: new Date().toISOString() }
            : x,
        ),
      },
      "复习状态已更新",
    );
  }
  function deleteMistake(m: Mistake) {
    setConfirm({
      title: "删除这道错题？",
      text: "题目、答案和所有附件将一并删除。此操作无法撤销。",
      run: async () => {
        await commit(
          { ...data, mistakes: data.mistakes.filter((x) => x.id !== m.id) },
          "错题已删除",
        );
        setDetail(null);
        setConfirm(null);
      },
    });
  }
  async function download() {
    try {
      downloadZip(await createZip(data));
      setToast("完整 ZIP 备份已下载，包含全部原始图片");
    } catch (e) {
      setError("导出失败：" + (e as Error).message);
    }
  }
  async function importFile(file?: File, handle?: BackupHandle) {
    if (!file) return;
    setBusy(true);
    try {
      setIncoming(await readBackup(file));
      setImportHandle(handle ?? null);
      setUseImportFile(false);
      setImportMode("merge");
      setReplaceConfirm("");
    } catch (e) {
      setError("未导入任何数据：" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openImport() {
    try {
      const handles = await fileWindow.showOpenFilePicker!({
        multiple: false,
        types: [
          {
            description: "REWISE 备份",
            accept: {
              "application/zip": [".zip"],
              "application/json": [".json"],
            },
          },
        ],
      });
      await importFile(await handles[0].getFile(), handles[0]);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError("打开文件失败：" + (e as Error).message);
    }
  }
  async function selectFile() {
    try {
      const handle = await fileWindow.showSaveFilePicker!({
        suggestedName: "REWISE-backup.zip",
        types: [
          {
            description: "REWISE ZIP 备份",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });
      const file = await handle.getFile();
      if (file.size) {
        try {
          setCandidate({
            handle,
            stamp: fileStamp(file),
            data: await readBackup(file),
          });
        } catch (e) {
          setCandidate({
            handle,
            stamp: fileStamp(file),
            data: null,
            invalid: (e as Error).message,
          });
        }
      } else {
        setCandidate({ handle, stamp: fileStamp(file), data: null });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError("选择保存位置失败：" + (e as Error).message);
    }
  }
  async function replaceData(incoming: Notebook) {
    if (lock.current) throw Error("正在保存，请稍后重试");
    lock.current = true;
    setBusy(true);
    try {
      const saved = await replaceWithRecovery(data, incoming);
      setData(saved);
      setSession(null);
      setDetail(null);
      syncQueue.enqueue(saved);
      return saved;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function applyImport() {
    try {
      if (importMode === "replace") {
        await replaceData(incoming!);
      } else await commit(mergeNotebook(data, incoming!), "备份已合并导入");
      if (useImportFile && importHandle) {
        const f = await importHandle.getFile();
        await syncQueue.attach({ handle: importHandle, stamp: fileStamp(f) });
      }
      setIncoming(null);
      setToast("错题本已恢复，图片与答案均已保留");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function recoverPrevious() {
    try {
      const recovery = await getSetting<Notebook>("recovery");
      if (!recovery) {
        setToast("暂无替换前恢复副本");
        return;
      }
      downloadZip(await createZip(recovery), "REWISE-recovery.zip");
      setToast("替换前的完整副本已下载");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function subjectCards() {
    return (
      <div className="subject-grid">
        {data.subjects.map((s) => {
          const ms = data.mistakes.filter((m) => m.subjectId === s.id),
            count = ms.filter((m) => m.status !== "mastered").length;
          return (
            <article className="subject-card" key={s.id}>
              <button
                className="subject-open"
                onClick={() => go("subject/" + s.id)}
              >
                <div className="subject-top">
                  <span
                    className="subject-dot"
                    style={{ background: s.color }}
                  />
                  <ChevronRight size={17} />
                </div>
                <h3>{s.name}</h3>
                <p>
                  <b>{ms.length}</b> 道错题 <span>· {count} 道待复习</span>
                </p>
                <div className="progress">
                  <span
                    style={{
                      width: `${ms.length ? ((ms.length - count) / ms.length) * 100 : 0}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <small>
                  掌握进度{" "}
                  <span>
                    {ms.length
                      ? Math.round(((ms.length - count) / ms.length) * 100)
                      : 0}
                    %
                  </span>
                </small>
              </button>
              {route === "subjects" && (
                <div className="subject-tools">
                  <button onClick={() => setSubjectEdit({ ...s })}>
                    <PenLine size={14} />
                    编辑科目
                  </button>
                  <DeleteButton onClick={() => setSubjectDelete(s)} />
                </div>
              )}
            </article>
          );
        })}
        <button
          className="add-subject"
          onClick={() =>
            setSubjectEdit({
              id: uid(),
              name: "",
              color: colors[data.subjects.length % colors.length],
              createdAt: new Date().toISOString(),
            })
          }
        >
          <Plus size={25} />
          <span>创建新科目</span>
          <small>为下一段学习留一个位置</small>
        </button>
      </div>
    );
  }
  function rows(ms: Mistake[], compact = false) {
    return (
      <div className="mistake-list">
        <div className="mistake-list-head">
          <span>题目与知识点</span>
          <span>科目</span>
          <span>难度</span>
          <span>复习状态</span>
          <span>记录日期</span>
          <span />
        </div>
        {ms.map((mistake) => (
          <MistakeRow
            key={mistake.id}
            mistake={mistake}
            subject={data.subjects.find(
              (subject) => subject.id === mistake.subjectId,
            )}
            compact={compact}
            dateLabel={date(mistake.createdAt)}
            onOpen={() => setDetail(mistake.id)}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a href="#dashboard" className="brand" aria-label="REWISE 首页">
          <img src={brandAsset("logo.svg")} alt="REWISE" />
          <span className="brand-tagline">LEARN FROM EVERY MISTAKE.</span>
        </a>
        <div className="workspace">
          <img src={brandAsset("logo-icon.svg")} alt="" />
          <div>
            个人学习空间<small>专注于你的下一次进步</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="nav-caption">学习工作台</span>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={
                route === id || (id === "subjects" && activeSubject)
                  ? "active"
                  : ""
              }
              onClick={() => go(id)}
            >
              <Icon size={18} />
              {label}
              {id === "mistakes" && (
                <span className="nav-count">{data.mistakes.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="side-subjects">
          <p>
            科目{" "}
            <button
              className="icon"
              aria-label="创建科目"
              onClick={() =>
                setSubjectEdit({
                  id: uid(),
                  name: "",
                  color: colors[0],
                  createdAt: new Date().toISOString(),
                })
              }
            >
              <Plus size={15} />
            </button>
          </p>
          {data.subjects.length ? (
            data.subjects.map((s) => (
              <button key={s.id} onClick={() => go("subject/" + s.id)}>
                <i style={{ background: s.color }} />
                {s.name}
                <span>
                  {data.mistakes.filter((m) => m.subjectId === s.id).length}
                </span>
              </button>
            ))
          ) : (
            <small>创建属于你的第一个科目</small>
          )}
        </div>
        <div className="sidebar-bottom">
          <ShieldCheck size={17} />
          <div>
            数据保存在此浏览器<small>定期备份，让积累更安心</small>
          </div>
        </div>
      </aside>
      <div className="mobile-bar">
        <a href="#dashboard" aria-label="REWISE 首页">
          <img src={brandAsset("logo-icon.svg")} alt="" />
          REWISE
        </a>
        <button
          className="icon"
          aria-label="切换导航"
          onClick={() => setMobile(!mobile)}
        >
          <Menu />
        </button>
      </div>
      <main>
        <div className="topline">
          <span className="breadcrumb">
            <span>学习空间</span>
            <ChevronRight size={14} />
            {activeSubject?.name || nav.find((x) => x[0] === route)?.[1]}
          </span>
          <form className="global-search" onSubmit={globalSubmit}>
            <Search size={16} />
            <input
              ref={globalInput}
              aria-label="全局搜索"
              placeholder="搜索题目、知识点、标签…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            <kbd>⌘ K</kbd>
          </form>
          <button
            className="top-add"
            aria-label="快速记录错题"
            onClick={add}
            disabled={!ready}
          >
            <Plus size={16} />
            <span>新增错题</span>
          </button>
        </div>
        <div className="save-strip">
          <span className={`save-indicator ${sync.status}`} />
          {ready
            ? sync.name
              ? syncLabels[sync.status]
              : "已保存到本地数据库"
            : "正在读取本地数据库"}
          <span className="save-strip-end">私有记录 · 保存在你的设备</span>
        </div>
        <div className="main-inner">
          {!ready ? (
            <Empty
              title="正在打开 REWISE"
              description={error || "你的学习记录，正在回到眼前。"}
            />
          ) : (
            <>
              <header className="page-header">
                <div>
                  <h1>
                    {activeSubject?.name ||
                      {
                        dashboard: "学习概览",
                        mistakes: "全部错题",
                        subjects: "我的科目",
                        review: "专注复习",
                        settings: "设置与备份",
                      }[route] ||
                      "学习概览"}
                  </h1>
                  <p>
                    {route === "dashboard"
                      ? "每次回看，都比上次更进一步。"
                      : route === "subjects"
                        ? "按自己的方式，为知识建立秩序。"
                        : route === "review"
                          ? "再想一次，让知识真正成为自己的。"
                          : route === "settings"
                            ? "妥善保存你的学习积累。"
                            : `共 ${activeSubject ? data.mistakes.filter((m) => m.subjectId === activeSubject.id).length : data.mistakes.length} 道错题，记录思考，找到进步的线索。`}
                  </p>
                </div>
                {route === "subjects" ? (
                  <button
                    className="primary"
                    onClick={() =>
                      setSubjectEdit({
                        id: uid(),
                        name: "",
                        color: colors[0],
                        createdAt: new Date().toISOString(),
                      })
                    }
                  >
                    <Plus size={17} />
                    创建科目
                  </button>
                ) : (
                  route !== "settings" &&
                  route !== "review" && (
                    <button className="primary" onClick={add}>
                      <Plus size={18} />
                      记录错题
                    </button>
                  )
                )}
              </header>
              {route === "dashboard" && (
                <>
                  <section className="stats">
                    {[
                      ["学习科目", data.subjects.length, "按自己的节奏分类"],
                      ["累计错题", data.mistakes.length, "每一道题，都是积累"],
                      ["待复习", pending, "今天值得再看一遍"],
                      ["已掌握", mastered, "理解，正在变得扎实"],
                    ].map(([l, n, t]) => (
                      <div key={l}>
                        <span>{l}</span>
                        <strong>{n}</strong>
                        <small>{t}</small>
                      </div>
                    ))}
                  </section>
                  <div className="dashboard-columns">
                    <section className="subject-section">
                      <div className="section-heading">
                        <h2>
                          我的科目 <small>{data.subjects.length}</small>
                        </h2>
                        <button
                          className="text-btn"
                          onClick={() => go("subjects")}
                        >
                          管理科目 <ChevronRight size={15} />
                        </button>
                      </div>
                      {subjectCards()}
                    </section>
                    <section className="review-note">
                      <div className="review-note-top">
                        <RotateCcw size={21} />
                        <span>温故而知新</span>
                      </div>
                      <h2>
                        {pending
                          ? "让不确定，变得确定。"
                          : "从一道题开始积累。"}
                      </h2>
                      <p>
                        {pending
                          ? `还有 ${pending} 道错题等待复习。留一点时间，检验自己的理解。`
                          : "记下卡住你的那道题，下次遇见时就多一分把握。"}
                      </p>
                      <button onClick={() => (pending ? go("review") : add())}>
                        {pending ? "开始复习" : "记录第一道错题"}
                        <ArrowUpRight size={17} />
                      </button>
                      <div className="review-progress-summary">
                        <span>已掌握</span>
                        <b>
                          {data.mistakes.length
                            ? Math.round(
                                (mastered / data.mistakes.length) * 100,
                              )
                            : 0}
                          %
                        </b>
                        <div className="progress">
                          <span
                            style={{
                              width: `${data.mistakes.length ? (mastered / data.mistakes.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <small>
                          {mastered} / {data.mistakes.length} 道错题
                        </small>
                      </div>
                    </section>
                  </div>
                  <section className="recent">
                    <div className="section-heading">
                      <h2>最近记录</h2>
                      <button
                        className="text-btn"
                        onClick={() => go("mistakes")}
                      >
                        查看全部 <ChevronRight size={15} />
                      </button>
                    </div>
                    {recent.length ? (
                      rows(recent, true)
                    ) : (
                      <Empty
                        title="欢迎来到 REWISE"
                        description="把难住你的题留下，把每一次订正变成下一次的把握。"
                        action={
                          <button onClick={add}>
                            <Plus size={16} />
                            记录错题
                          </button>
                        }
                      />
                    )}
                  </section>
                  <div className="footer-note">
                    <span>REWISE</span>
                    <p>LEARN FROM EVERY MISTAKE.</p>
                  </div>
                </>
              )}
              {route === "subjects" && subjectCards()}
              {(route === "mistakes" || route.startsWith("subject/")) && (
                <>
                  <div className="filter-panel">
                    <div className="search-input">
                      <Search size={18} />
                      <input
                        aria-label="搜索错题"
                        placeholder="搜索题目、科目、知识点或标签…"
                        value={filters.search}
                        onChange={(e) =>
                          setFilters({ ...filters, search: e.target.value })
                        }
                      />
                      {filters.search && (
                        <button
                          className="icon"
                          aria-label="清空搜索"
                          onClick={() => setFilters({ ...filters, search: "" })}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="filter-row">
                      {!activeSubject && (
                        <select
                          aria-label="筛选科目"
                          value={filters.subject}
                          onChange={(e) =>
                            setFilters({ ...filters, subject: e.target.value })
                          }
                        >
                          <option value="">全部科目</option>
                          {data.subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        aria-label="筛选复习状态"
                        value={filters.status}
                        onChange={(e) =>
                          setFilters({ ...filters, status: e.target.value })
                        }
                      >
                        <option value="">全部状态</option>
                        {Object.entries(statuses).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="筛选难度"
                        value={filters.difficulty}
                        onChange={(e) =>
                          setFilters({ ...filters, difficulty: e.target.value })
                        }
                      >
                        <option value="">全部难度</option>
                        {Object.entries(difficulties).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => setAdvanced(!advanced)}>
                        <SlidersHorizontal size={16} />
                        更多筛选
                      </button>
                      <select
                        className="sort"
                        aria-label="排序"
                        value={filters.sort}
                        onChange={(e) =>
                          setFilters({ ...filters, sort: e.target.value })
                        }
                      >
                        <option value="newest">最新添加</option>
                        <option value="oldest">最早添加</option>
                        <option value="reviewed">最近复习</option>
                        <option value="difficulty">难度从高到低</option>
                      </select>
                    </div>
                    {advanced && (
                      <div className="advanced">
                        <label>
                          添加日期起
                          <input
                            type="date"
                            value={filters.from}
                            onChange={(e) =>
                              setFilters({ ...filters, from: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          至
                          <input
                            type="date"
                            value={filters.to}
                            min={filters.from}
                            onChange={(e) =>
                              setFilters({ ...filters, to: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          知识点
                          <select
                            value={filters.point}
                            onChange={(e) =>
                              setFilters({ ...filters, point: e.target.value })
                            }
                          >
                            <option value="">全部知识点</option>
                            {[
                              ...new Set(
                                data.mistakes
                                  .filter(
                                    (m) =>
                                      !activeSubject ||
                                      m.subjectId === activeSubject.id,
                                  )
                                  .flatMap((m) => m.points),
                              ),
                            ].map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="list-caption">
                    <span>找到 {list.length} 道错题</span>
                    <button
                      className="text-btn"
                      onClick={() => setFilters(initialFilters)}
                    >
                      重置筛选
                    </button>
                    {activeSubject && (
                      <button
                        className="text-btn"
                        onClick={() => setSubjectEdit({ ...activeSubject })}
                      >
                        编辑科目
                      </button>
                    )}
                  </div>
                  {list.length ? (
                    rows(list)
                  ) : (
                    <Empty
                      title={
                        data.mistakes.length
                          ? "没有找到符合条件的错题"
                          : "这里还是空白的一页"
                      }
                      description={
                        data.mistakes.length
                          ? "试试调整搜索词或筛选条件。"
                          : "把值得再次思考的题目，留在这里。"
                      }
                      action={
                        <button onClick={add}>
                          <Plus size={16} />
                          记录错题
                        </button>
                      }
                    />
                  )}
                </>
              )}
              {route === "review" && (
                <>
                  {!session ? (
                    <>
                      <div className="review-setup">
                        <div className="review-intro">
                          <BookOpen size={32} strokeWidth={1.3} />
                          <h2>给记忆一次巩固的机会</h2>
                          <p>
                            先独立思考，再揭晓答案。根据理解程度，记录本次收获。
                          </p>
                        </div>
                        <div className="form-grid">
                          <label>
                            复习科目
                            <select
                              value={reviewSubject}
                              onChange={(e) => setReviewSubject(e.target.value)}
                            >
                              <option value="">全部科目</option>
                              {data.subjects.map((s) => (
                                <option value={s.id} key={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            复习范围
                            <select
                              value={reviewStatus}
                              onChange={(e) => setReviewStatus(e.target.value)}
                            >
                              <option value="pending">
                                待复习（未复习与复习中）
                              </option>
                              <option value="">全部状态</option>
                              {Object.entries(statuses).map(([k, v]) => (
                                <option value={k} key={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="review-start">
                          <span>
                            本次可复习 <b>{reviewPool.length}</b> 道错题
                          </span>
                          <div>
                            <button
                              disabled={!reviewPool.length}
                              onClick={() => startReview(false)}
                            >
                              顺序复习
                            </button>
                            <button
                              className="primary"
                              disabled={!reviewPool.length}
                              onClick={() => startReview(true)}
                            >
                              <Shuffle size={16} />
                              随机复习
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : activeReview ? (
                    <div className="review-session">
                      <div className="section-heading">
                        <span>
                          本次进度 {index + 1} / {session.length}
                        </span>
                        <button onClick={() => setSession(null)}>
                          退出复习
                        </button>
                      </div>
                      <div className="progress">
                        <span
                          style={{
                            width: `${(index / session.length) * 100}%`,
                          }}
                        />
                      </div>
                      <article className="review-question">
                        <span className="eyebrow">
                          {
                            data.subjects.find(
                              (s) => s.id === activeReview.subjectId,
                            )?.name
                          }{" "}
                          · {difficulties[activeReview.difficulty]}
                        </span>
                        <h2>{activeReview.title || "思考这道题"}</h2>
                        <p className="prewrap">{activeReview.content}</p>
                        <Images images={activeReview.images} onZoom={setZoom} />
                        {!revealed ? (
                          <div className="reveal">
                            <p>慢慢想，给自己一点时间。</p>
                            <button
                              className="primary"
                              onClick={() => setRevealed(true)}
                            >
                              查看答案与解析
                            </button>
                          </div>
                        ) : (
                          <>
                            <Answers mistake={activeReview} />
                            <div className="review-rating">
                              <h3>这次理解得怎么样？</h3>
                              <div>
                                {Object.entries(statuses).map(([k, v]) => (
                                  <button
                                    key={k}
                                    disabled={busy}
                                    className={
                                      k === "mastered" ? "primary" : ""
                                    }
                                    onClick={() =>
                                      perform(async () => {
                                        await changeStatus(
                                          activeReview,
                                          k as Status,
                                        );
                                        setIndex(index + 1);
                                        setRevealed(false);
                                      })
                                    }
                                  >
                                    {v}
                                    {k === "mastered" && <Check size={16} />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                        <div className="review-navigation">
                          <button
                            disabled={index === 0 || busy}
                            onClick={() => {
                              setIndex(index - 1);
                              setRevealed(false);
                            }}
                          >
                            上一题
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              setIndex(index + 1);
                              setRevealed(false);
                            }}
                          >
                            {index === session.length - 1
                              ? "结束本轮"
                              : "下一题"}
                          </button>
                        </div>
                      </article>
                    </div>
                  ) : (
                    <Empty
                      title="本轮复习完成"
                      description={`本轮共 ${session.length} 道错题，已评定的复习状态已保存。`}
                      action={
                        <button
                          className="primary"
                          onClick={() => setSession(null)}
                        >
                          <CheckCircle2 size={17} />
                          完成，返回复习
                        </button>
                      }
                    />
                  )}
                </>
              )}
              {route === "settings" && (
                <div className="settings">
                  <ComputerStorage
                    state={sync}
                    onSelect={() => void selectFile()}
                    onDownload={() => void download()}
                    busy={busy}
                  />
                  <section>
                    <div>
                      <h2>备份与恢复</h2>
                      <p>
                        把题目、答案和图片一起保存。
                        <br />
                        换设备时，可以导入继续学习。
                      </p>
                    </div>
                    <div className="settings-panel">
                      <h3>导出完整错题本</h3>
                      <p>
                        {data.subjects.length} 个科目 · {data.mistakes.length}{" "}
                        道错题 ·{" "}
                        {data.mistakes.reduce((n, m) => n + m.images.length, 0)}{" "}
                        张图片
                      </p>
                      <button onClick={() => void download()} disabled={busy}>
                        <Download size={16} />
                        下载完整备份
                      </button>
                      <hr />
                      <h3>从电脑导入错题本</h3>
                      <p>
                        导入完整 ZIP 备份，或兼容旧版 JSON
                        文件。校验后预览，可选择合并或替换。
                      </p>
                      {fileWindow.showOpenFilePicker && (
                        <button
                          onClick={() => void openImport()}
                          disabled={busy}
                        >
                          从电脑导入错题本
                        </button>
                      )}
                      <label className="file-button">
                        <UploadIcon size={16} />
                        {busy ? "正在处理…" : "选择备份文件"}
                        <input
                          type="file"
                          accept=".zip,.json,application/zip,application/json"
                          disabled={busy}
                          onChange={(e) => {
                            void importFile(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </section>
                  <section>
                    <div>
                      <h2>本地存储</h2>
                      <p>
                        记录只保存在当前浏览器，
                        <br />
                        不会自动同步至其他设备。
                      </p>
                    </div>
                    <div className="settings-panel">
                      <ShieldCheck size={24} />
                      <h3>你的学习记录，由你保管</h3>
                      <p>
                        附件占用{" "}
                        {(
                          data.mistakes.reduce(
                            (n, m) =>
                              n + m.images.reduce((a, i) => a + i.blob.size, 0),
                            0,
                          ) /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                      <p>
                        {storage?.usage !== undefined
                          ? `此站点总存储约 ${(storage.usage / 1024 / 1024).toFixed(2)} MB`
                          : "此浏览器未提供存储用量信息"}
                      </p>
                      <p>
                        {persistent === null
                          ? "正在检查持久存储…"
                          : persistent
                            ? "浏览器已允许持久存储。"
                            : "浏览器未授予持久存储，记录仍会保存；请设置电脑自动备份或定期下载 ZIP。"}
                      </p>
                      <small>
                        清除浏览器网站数据会删除记录。电脑 ZIP 文件可用于恢复。
                      </small>
                      <div className="settings-buttons">
                        <button onClick={() => void recoverPrevious()}>
                          下载替换前恢复副本
                        </button>
                      </div>
                    </div>
                  </section>
                  <section>
                    <div>
                      <h2>清空错题本</h2>
                      <p>永久删除此浏览器中的全部记录。</p>
                    </div>
                    <div className="settings-panel">
                      <p>此操作无法撤销，建议先导出一份备份。</p>
                      <button
                        className="danger"
                        onClick={() => {
                          setClearText("");
                          setClearing(true);
                        }}
                      >
                        清空所有数据
                      </button>
                    </div>
                  </section>
                  <section>
                    <div>
                      <h2>关于 REWISE</h2>
                    </div>
                    <div className="settings-panel">
                      <h3>REWISE · 个人数字错题本</h3>
                      <p>LEARN FROM EVERY MISTAKE.</p>
                      <small>版本 3.0.0 · 让每一次错误都有回响。</small>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {subjectEdit && (
        <Modal
          title={
            data.subjects.some((s) => s.id === subjectEdit.id)
              ? "编辑科目"
              : "创建新科目"
          }
          onClose={() => setSubjectEdit(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const s = { ...subjectEdit, name: subjectEdit.name.trim() };
              if (!s.name) return;
              if (
                data.subjects.some((x) => x.id !== s.id && x.name === s.name)
              ) {
                setError("已经有同名科目，请换一个名称");
                return;
              }
              perform(async () => {
                await commit(
                  {
                    ...data,
                    subjects: data.subjects.some((x) => x.id === s.id)
                      ? data.subjects.map((x) => (x.id === s.id ? s : x))
                      : [...data.subjects, s],
                  },
                  "科目已保存",
                );
                setSubjectEdit(null);
              });
            }}
          >
            <label>
              科目名称
              <input
                autoFocus
                required
                maxLength={60}
                placeholder="例如：高等数学"
                value={subjectEdit.name}
                onChange={(e) =>
                  setSubjectEdit({ ...subjectEdit, name: e.target.value })
                }
              />
            </label>
            <label>科目颜色</label>
            <div className="color-options">
              {colors.map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label={`选择颜色 ${c}`}
                  style={{ background: c }}
                  className={subjectEdit.color === c ? "selected" : ""}
                  onClick={() => setSubjectEdit({ ...subjectEdit, color: c })}
                >
                  {subjectEdit.color === c && <Check size={18} />}
                </button>
              ))}
              <input
                aria-label="自定义科目颜色"
                type="color"
                value={subjectEdit.color}
                onChange={(e) =>
                  setSubjectEdit({ ...subjectEdit, color: e.target.value })
                }
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setSubjectEdit(null)}>
                取消
              </button>
              <button className="primary" disabled={busy}>
                保存科目
              </button>
            </div>
          </form>
        </Modal>
      )}
      {subjectDelete && (
        <SubjectDelete
          subject={subjectDelete}
          subjects={data.subjects}
          count={
            data.mistakes.filter((m) => m.subjectId === subjectDelete.id).length
          }
          busy={busy}
          close={() => setSubjectDelete(null)}
          save={(target) =>
            perform(async () => {
              await commit(
                removeSubject(data, subjectDelete.id, target),
                "科目已删除",
              );
              setSubjectDelete(null);
            })
          }
        />
      )}
      {editor && (
        <MistakeEditor
          key={editor.id}
          initial={editor}
          subjects={data.subjects}
          busy={busy}
          close={() => setEditor(null)}
          error={setError}
          onZoom={setZoom}
          save={(m) =>
            perform(async () => {
              await commit(
                {
                  ...data,
                  mistakes: data.mistakes.some((x) => x.id === m.id)
                    ? data.mistakes.map((x) => (x.id === m.id ? m : x))
                    : [...data.mistakes, m],
                },
                "错题已保存",
              );
              setEditor(null);
            })
          }
        />
      )}
      {current && !editor && (
        <Modal title="错题详情" wide onClose={() => setDetail(null)}>
          <div className="detail-meta">
            <span>
              {data.subjects.find((s) => s.id === current.subjectId)?.name} ·{" "}
              {difficulties[current.difficulty]} · {date(current.createdAt)}
            </span>
            <select
              aria-label="修改复习状态"
              disabled={busy}
              value={current.status}
              onChange={(e) =>
                perform(() => changeStatus(current, e.target.value as Status))
              }
            >
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <h2 className="question-title">{current.title || "题目"}</h2>
          <p className="prewrap">{current.content}</p>
          <div className="chips">
            {current.points.map((p) => (
              <span key={p}>{p}</span>
            ))}
            {current.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
          <Images images={current.images} onZoom={setZoom} />
          <Answers mistake={current} />
          <div className="modal-actions detail-actions">
            <DeleteButton onClick={() => deleteMistake(current)} />
            <button
              onClick={() =>
                perform(async () => {
                  const copy = {
                    ...current,
                    id: uid(),
                    title: (current.title || "题目").slice(0, 196) + "（副本）",
                    createdAt: new Date().toISOString(),
                    reviewedAt: undefined,
                    status: "new" as Status,
                    images: current.images.map((i) => ({ ...i, id: uid() })),
                  };
                  await commit(
                    { ...data, mistakes: [...data.mistakes, copy] },
                    "已复制错题",
                  );
                  setDetail(copy.id);
                })
              }
              disabled={busy}
            >
              <Copy size={16} />
              复制
            </button>
            <button
              className="primary"
              onClick={() => setEditor({ ...current })}
            >
              <PenLine size={16} />
              编辑错题
            </button>
          </div>
        </Modal>
      )}
      {incoming && (
        <Modal title="确认导入备份" onClose={() => setIncoming(null)}>
          <p>
            已校验：{incoming.subjects.length} 个科目、
            {incoming.mistakes.length} 道错题、
            {incoming.mistakes.reduce((n, m) => n + m.images.length, 0)}{" "}
            张图片。
          </p>
          <label className="radio">
            <input
              type="radio"
              checked={importMode === "merge"}
              onChange={() => setImportMode("merge")}
            />
            合并，保留现有记录（重复 ID 将重新分配）
          </label>
          <label className="radio">
            <input
              type="radio"
              checked={importMode === "replace"}
              onChange={() => setImportMode("replace")}
            />
            替换全部现有记录
          </label>
          {importMode === "replace" && (
            <>
              <p>
                替换前会自动在浏览器保存完整恢复副本，可在设置中下载。请输入“替换错题本”确认。
              </p>
              <input
                aria-label="替换确认文字"
                placeholder="替换错题本"
                value={replaceConfirm}
                onChange={(e) => setReplaceConfirm(e.target.value)}
              />
            </>
          )}
          {importHandle && (
            <label className="radio">
              <input
                type="checkbox"
                checked={useImportFile}
                onChange={(e) => setUseImportFile(e.target.checked)}
              />
              同时将这个文件设为电脑自动保存位置（需写入权限）
            </label>
          )}
          <div className="modal-actions">
            <button onClick={() => setIncoming(null)}>取消</button>
            <button
              className="primary"
              disabled={
                busy ||
                (importMode === "replace" && replaceConfirm !== "替换错题本")
              }
              onClick={() => void applyImport()}
            >
              {importMode === "merge" ? "确认合并导入" : "确认替换导入"}
            </button>
          </div>
        </Modal>
      )}
      {candidate && (
        <Modal title="确认电脑保存位置" onClose={() => setCandidate(null)}>
          <p>文件：{candidate.handle.name}</p>
          {candidate.data ? (
            <p>
              发现已有备份：{candidate.data.subjects.length} 个科目，
              {candidate.data.mistakes.length}{" "}
              道错题。请选择恢复它，或用当前错题本替换它。
            </p>
          ) : candidate.invalid ? (
            <p>
              此文件非有效备份：{candidate.invalid}
              。仅在你确认不再需要原文件时选择替换。
            </p>
          ) : (
            <p>将把当前完整错题本写入此空文件，以后自动同步修改。</p>
          )}
          <div className="modal-actions">
            <button onClick={() => setCandidate(null)}>取消</button>
            {candidate.data && (
              <button
                disabled={busy}
                onClick={() => {
                  setIncoming(candidate.data);
                  setImportHandle(candidate.handle);
                  setUseImportFile(true);
                  setImportMode("replace");
                  setReplaceConfirm("");
                  setCandidate(null);
                }}
              >
                恢复文件内容
              </button>
            )}
            <button
              className="primary"
              disabled={busy || sync.status === "saving"}
              onClick={() =>
                perform(async () => {
                  const c = candidate;
                  await syncQueue.attach({ handle: c.handle, stamp: c.stamp });
                  setCandidate(null);
                })
              }
            >
              {candidate.data || candidate.invalid
                ? "用当前错题本替换文件"
                : "确认启用自动保存"}
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p>{confirm.text}</p>
          <div className="modal-actions">
            <button onClick={() => setConfirm(null)}>取消</button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => perform(confirm.run)}
            >
              确认删除
            </button>
          </div>
        </Modal>
      )}
      {clearing && (
        <Modal title="永久清空所有数据" onClose={() => setClearing(false)}>
          <p>全部科目、错题与图片都将被删除。请输入“清空错题本”确认。</p>
          <input
            aria-label="输入清空确认文字"
            value={clearText}
            onChange={(e) => setClearText(e.target.value)}
            placeholder="清空错题本"
          />
          <div className="modal-actions">
            <button onClick={() => setClearing(false)}>取消</button>
            <button
              className="danger"
              disabled={clearText !== "清空错题本" || busy}
              onClick={() =>
                perform(async () => {
                  await commit(
                    { ...empty(), revision: data.revision },
                    "所有数据已清空",
                  );
                  setClearing(false);
                  setSession(null);
                  setDetail(null);
                })
              }
            >
              永久清空
            </button>
          </div>
        </Modal>
      )}
      {zoom && (
        <Modal title="题目图片" wide onClose={() => setZoom(null)}>
          <div className="zoom">
            <Picture attachment={zoom} />
          </div>
          <p>{zoom.name}</p>
        </Modal>
      )}
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>关闭</button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Answers({ mistake: m }: { mistake: Mistake }) {
  return (
    <div className="answers">
      {[
        ["我的错误答案", m.wrong],
        ["正确答案", m.correct],
        ["详细解析", m.explanation],
      ].map(([label, text]) => (
        <section key={label}>
          <h3>{label}</h3>
          <p className="prewrap">{text || "尚未填写"}</p>
        </section>
      ))}
    </div>
  );
}
function SubjectDelete({
  subject,
  subjects,
  count,
  close,
  save,
  busy,
}: {
  subject: Subject;
  subjects: Subject[];
  count: number;
  close: () => void;
  save: (id?: string) => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState("move");
  const [target, setTarget] = useState(
    subjects.find((s) => s.id !== subject.id)?.id || "",
  );
  return (
    <Modal title={`删除“${subject.name}”？`} onClose={close}>
      <p>该科目中有 {count} 道错题。请选择如何处理，确认后无法撤销。</p>
      {count > 0 && (
        <>
          <label className="radio">
            <input
              type="radio"
              checked={mode === "move"}
              onChange={() => setMode("move")}
            />
            保留错题，迁移至另一个科目
          </label>
          <select
            aria-label="迁移目标科目"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">选择目标科目</option>
            {subjects
              .filter((s) => s.id !== subject.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <label className="radio">
            <input
              type="radio"
              checked={mode === "delete"}
              onChange={() => setMode("delete")}
            />
            一并永久删除所有关联错题和图片
          </label>
        </>
      )}
      <div className="modal-actions">
        <button onClick={close}>取消</button>
        <button
          className="danger"
          disabled={busy || (count > 0 && mode === "move" && !target)}
          onClick={() =>
            save(count > 0 && mode === "move" ? target : undefined)
          }
        >
          确认删除科目
        </button>
      </div>
    </Modal>
  );
}
function MistakeEditor({
  initial,
  subjects,
  close,
  save,
  busy,
  error,
  onZoom,
}: {
  initial: Mistake;
  subjects: Subject[];
  close: () => void;
  save: (m: Mistake) => void;
  busy: boolean;
  error: (s: string) => void;
  onZoom: (a: Attachment) => void;
}) {
  const [m, setM] = useState(initial);
  const [points, setPoints] = useState(initial.points.join("，"));
  const [tags, setTags] = useState(initial.tags.join("，"));
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [discard, setDiscard] = useState(false);
  const patch = (p: Partial<Mistake>) => {
    setM((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };
  function submit(e: FormEvent) {
    e.preventDefault();
    if (uploading || busy) return;
    if (
      split(points).length > 500 ||
      split(tags).length > 500 ||
      [...split(points), ...split(tags)].some((x) => x.length > 1000)
    ) {
      error("知识点和标签各最多 500 个，每项最多 1000 字");
      return;
    }
    if (!m.content.trim() && !m.images.length) {
      error("请填写题目内容，或上传至少一张图片");
      return;
    }
    if (!subjects.some((s) => s.id === m.subjectId)) {
      error("请选择科目");
      return;
    }
    save({
      ...m,
      reviewedAt:
        m.status !== initial.status ? new Date().toISOString() : m.reviewedAt,
      title: m.title.trim(),
      points: split(points),
      tags: split(tags),
    });
  }
  return (
    <Modal
      title="记录与编辑错题"
      wide
      onClose={() => (dirty ? setDiscard(true) : close())}
    >
      <form className="editor-form" onSubmit={submit}>
        <p className="editor-intro">
          把问题留下，也把思考的过程留下。修改仅在点击保存后写入错题本。
        </p>
        <section className="editor-section">
          <h3>题目</h3>
          <label>
            所属科目
            <select
              value={m.subjectId}
              onChange={(e) => patch({ subjectId: e.target.value })}
              required
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            题目标题 <small>选填</small>
            <input
              value={m.title}
              maxLength={200}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="给这道题一个容易找到的名字"
            />
          </label>
          <label>
            题目内容 <small>文字和图片至少填写一项</small>
            <textarea
              value={m.content}
              rows={6}
              maxLength={1000000}
              onChange={(e) => patch({ content: e.target.value })}
              placeholder="输入完整题目，保留公式与推导的换行…"
            />
          </label>
        </section>
        <section className="editor-section">
          <h3>题目附件</h3>
          <Upload
            images={m.images}
            onChange={(images) => patch({ images })}
            onError={error}
            onBusy={setUploading}
          />
          <Images
            images={m.images}
            onZoom={onZoom}
            onRemove={(id) =>
              patch({ images: m.images.filter((i) => i.id !== id) })
            }
          />
        </section>
        <section className="editor-section answer-editor">
          <h3>答案与解析</h3>
          {(["wrong", "correct", "explanation"] as const).map((key, i) => (
            <label className={`answer-field ${key}`} key={key}>
              {["我的错误答案", "正确答案", "详细解析"][i]}
              <textarea
                maxLength={1000000}
                rows={i === 2 ? 5 : 3}
                value={m[key]}
                onChange={(e) => patch({ [key]: e.target.value })}
                placeholder={
                  [
                    "记录当时的思路，找到出错的原因",
                    "写下正确答案与关键步骤",
                    "拆解推导过程，记录下次需要注意的地方",
                  ][i]
                }
              />
            </label>
          ))}
        </section>
        <section className="editor-section">
          <h3>整理与归类</h3>
          <div className="form-grid">
            <label>
              知识点
              <input
                maxLength={10000}
                value={points}
                onChange={(e) => {
                  setPoints(e.target.value);
                  setDirty(true);
                }}
                placeholder="用逗号分隔，例如：函数，导数"
              />
            </label>
            <label>
              自定义标签
              <input
                maxLength={10000}
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                  setDirty(true);
                }}
                placeholder="用逗号分隔，例如：期中，易错"
              />
            </label>
            <label>
              难度
              <select
                value={m.difficulty}
                onChange={(e) =>
                  patch({ difficulty: e.target.value as Mistake["difficulty"] })
                }
              >
                {Object.entries(difficulties).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              复习状态
              <select
                value={m.status}
                onChange={(e) => patch({ status: e.target.value as Status })}
              >
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        {discard && (
          <div className="discard">
            <p>还有未保存的修改，确定放弃吗？</p>
            <button type="button" onClick={() => setDiscard(false)}>
              继续编辑
            </button>
            <button className="danger" type="button" onClick={close}>
              放弃修改
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            onClick={() => (dirty ? setDiscard(true) : close())}
          >
            取消
          </button>
          <button className="primary" disabled={busy || uploading}>
            {uploading ? "正在处理图片…" : busy ? "正在保存…" : "保存错题"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
