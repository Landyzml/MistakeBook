import { useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Picture } from "./components";
import { difficulties, statuses, type Mistake, type Subject } from "./model";

export function MistakeRow({
  mistake,
  subject,
  dateLabel,
  compact,
  onOpen,
}: {
  mistake: Mistake;
  subject?: Subject;
  dateLabel: string;
  compact: boolean;
  onOpen: () => void;
}) {
  const titleId = useId();
  const contentId = useId();
  const [imageIndex, setImageIndex] = useState(0);
  const imageCount = mistake.images.length;
  const currentIndex = Math.min(imageIndex, imageCount - 1);
  const image = mistake.images[currentIndex];
  const content = mistake.content.trim() ? mistake.content : "";
  const title =
    mistake.title.trim() ||
    (compact && content
      ? content.slice(0, 50)
      : content
        ? "未命名题目"
        : "图片题目");

  return (
    <article className={`mistake-row${compact ? " is-compact" : ""}`}>
      <button
        type="button"
        className="mistake-row-main"
        aria-labelledby={titleId}
        aria-describedby={content ? contentId : undefined}
        onClick={onOpen}
      >
        <span className="row-question">
          <span className="row-title" id={titleId}>
            {title}
          </span>
          {compact && content && (
            <span className="row-excerpt" id={contentId}>
              {content}
            </span>
          )}
          {mistake.points.length > 0 && (
            <span className="row-tags">
              {mistake.points.slice(0, 3).map((point) => (
                <span key={point}>{point}</span>
              ))}
            </span>
          )}
        </span>
        <span className="subject-label">
          <i style={{ background: subject?.color }} />
          {subject?.name}
        </span>
        <span className={`difficulty ${mistake.difficulty}`}>
          {difficulties[mistake.difficulty]}
        </span>
        <span className={`status ${mistake.status}`}>
          {statuses[mistake.status]}
        </span>
        <span className="row-date">{dateLabel}</span>
        <ChevronRight size={16} aria-hidden="true" />
        {!compact && content && (
          <span className="row-content" id={contentId}>
            {content}
          </span>
        )}
        {!compact && image && (
          <span className="row-image">
            <Picture
              key={image.id}
              attachment={image}
              className="mistake-image"
              loading="lazy"
            />
          </span>
        )}
      </button>
      {!compact && imageCount > 1 && (
        <div
          className="row-image-controls"
          role="group"
          aria-label={`${title}的题目图片`}
        >
          <button
            type="button"
            className="icon"
            aria-label="上一张图片"
            disabled={currentIndex === 0}
            onClick={() => setImageIndex(currentIndex - 1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span aria-live="polite">
            {currentIndex + 1} / {imageCount}
          </span>
          <button
            type="button"
            className="icon"
            aria-label="下一张图片"
            disabled={currentIndex === imageCount - 1}
            onClick={() => setImageIndex(currentIndex + 1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
}
