'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Shuffle } from 'lucide-react';
import { catalogDayTags, randomCatalogDay } from '@/lib/cine-day';

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
  // Preserve an explicit reroll during data refreshes; never retain a deleted tag.
  const [selected, setSelected] = useState(initialTag);
  const current =
    tags.find((tag) => tag.filter === selected) ||
    tags.find((tag) => tag.filter === initialTag) ||
    tags[0];
  if (!current) return null;
  return (
    <section
      className="cine-day-banner"
      aria-label={en ? 'Random catalog tag' : 'Случайный тег каталога'}
    >
      <span className="cine-day-icon" aria-hidden="true">
        {current.icon}
      </span>
      <div className="cine-day-copy" aria-live="polite" aria-atomic="true">
        <b>{current.label}</b>
        <small>
          {en
            ? 'A tag from the current catalog'
            : 'Подборка из актуального каталога'}{' '}
          · {current.count}
        </small>
      </div>
      <div className="cine-day-actions">
        {tags.length > 1 && (
          <button
            type="button"
            className="outline-btn small"
            onClick={() =>
              setSelected(randomCatalogDay(tags, current.filter)?.filter)
            }
          >
            <Shuffle size={14} />
            {en ? 'Another tag' : 'Другой тег'}
          </button>
        )}
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
          {en ? 'Open' : 'Открыть'}
          <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}
