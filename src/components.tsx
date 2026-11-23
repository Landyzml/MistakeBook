import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ImagePlus, Trash2, ZoomIn } from "lucide-react";
import { type Attachment, uid } from "./model";
import { validImage } from "./backup";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea,select,a[href],[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    const el = ref.current;
    el?.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      el?.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Picture({
  attachment,
  onClick,
}: {
  attachment: Attachment;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => {
    const u = URL.createObjectURL(attachment.blob);
    setUrl(u);
    setBad(false);
    return () => URL.revokeObjectURL(u);
  }, [attachment.blob]);
  return bad ? (
    <span>图片无法显示</span>
  ) : (
    <img
      src={url || undefined}
      alt={attachment.name}
      onError={() => setBad(true)}
      onClick={onClick}
    />
  );
}
export function Images({
  images,
  onZoom,
  onRemove,
}: {
  images: Attachment[];
  onZoom: (a: Attachment) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="images">
      {images.map((i) => (
        <div className="image-tile" key={i.id}>
          <button
            type="button"
            onClick={() => onZoom(i)}
            aria-label={`放大 ${i.name}`}
          >
            <Picture attachment={i} />
            <ZoomIn size={16} />
          </button>
          {onRemove && (
            <button
              type="button"
              className="remove-img"
              aria-label={`移除 ${i.name}`}
              onClick={() => onRemove(i.id)}
            >
              <X size={15} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
export function Upload({
  images,
  onChange,
  onError,
  onBusy,
}: {
  images: Attachment[];
  onChange: (a: Attachment[]) => void;
  onError: (s: string) => void;
  onBusy?: (b: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  async function load(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    setLoading(true);
    onBusy?.(true);
    try {
      if (images.length + selected.length > 30)
        throw Error("每道题最多 30 张图片");
      const next: Attachment[] = [];
      for (const file of selected) {
        await validImage(file);
        next.push({ id: uid(), name: file.name, blob: file });
      }
      onChange([...images, ...next]);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
      onBusy?.(false);
    }
  }
  return (
    <label
      className="upload"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!loading) void load(e.dataTransfer.files);
      }}
    >
      <ImagePlus size={22} />
      <span>{loading ? "正在检查图片…" : "点击选择或拖入题目图片"}</span>
      <small>PNG、JPG、WEBP · 每张最多 15 MB · 最多 30 张</small>
      <input
        aria-label="上传题目图片"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={loading}
        onChange={(e) => {
          void load(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="paper-mark">
        <span />
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="danger ghost" onClick={onClick}>
      <Trash2 size={16} />
      删除
    </button>
  );
}
