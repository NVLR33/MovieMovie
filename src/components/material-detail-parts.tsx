"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Length sets the ceiling; container units handle the actual available space. */
export function detailTitleStyle(title: string): CSSProperties {
  const length = [...title.trim()].length;
  return {
    "--detail-title-max": `${length > 110 ? 27 : length > 75 ? 30 : length > 45 ? 34 : 38}px`,
  } as CSSProperties;
}

export function DetailDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(
        getComputedStyle(element).lineHeight,
      );
      setOverflow(element.scrollHeight > lineHeight * 3 + 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts.ready.then(() => {
      if (element.isConnected) measure();
    });
    return () => observer.disconnect();
  }, [text]);
  if (!text.trim()) return null;
  return (
    <div className="detail-description" data-expanded={expanded}>
      <p
        ref={ref}
        id={id}
        className={expanded ? "" : "detail-synopsis-clamped"}
      >
        {text}
      </p>
      {overflow && (
        <button
          type="button"
          className="detail-text-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Свернуть описание" : "Полное описание"}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </div>
  );
}

export function DetailTags({
  genre,
  studio,
  go,
}: {
  genre: string;
  studio: string;
  go: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const tags = [
    ...new Set(
      `${genre},${studio}`
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
  return (
    <div className="detail-tag-group">
      <div className="genre-list" id={id} aria-label="Жанры и студии">
        {tags.map((tag, index) => (
          <button
            type="button"
            hidden={!expanded && index >= 4}
            key={tag}
            onClick={() => go("/catalog?search=" + encodeURIComponent(tag))}
          >
            {tag}
          </button>
        ))}
      </div>
      {tags.length > 4 && (
        <button
          type="button"
          className="detail-tag-more"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Скрыть" : `Ещё ${tags.length - 4}`}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  );
}
