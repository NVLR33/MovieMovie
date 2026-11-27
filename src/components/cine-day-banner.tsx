"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { catalogDayTags, dailyCatalogDay } from "@/lib/cine-day";

export default function CineDayBanner({
  films,
  initialTag,
  go,
  en = false,
}: {
  films: readonly { genre?: string | null }[];
  initialTag?: string;
  go: (href: string) => void;
  en?: boolean;
}) {
  const tags = useMemo(() => catalogDayTags(films), [films]);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const current = now
    ? dailyCatalogDay(tags, now)
    : tags.find((tag) => tag.filter === initialTag) || null;
  if (!current) return null;
  return (
    <section
      className="cine-day-banner"
      data-cine-day-version="daily-v3"
      aria-label={en ? "Tag of the day" : "Тег дня"}
    >
      <span className="cine-day-icon" aria-hidden="true">
        {current.icon}
      </span>
      <div className="cine-day-copy" aria-live="polite" aria-atomic="true">
        <b>{current.label}</b>
        <small>
          {en
            ? "One catalog tag for the day · updates at midnight Moscow time"
            : "Один тег на весь день · новый в полночь по Москве"}{" "}
          · {current.count}
        </small>
      </div>
      <div className="cine-day-actions">
        <a
          className="outline-btn small"
          href={current.href}
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            go(current.href);
          }}
        >
          {en ? "Open" : "Открыть"}
          <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}
