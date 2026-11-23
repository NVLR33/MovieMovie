'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  ChevronRight,
  Clock3,
  Crosshair,
  Film,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  experienceProgress,
  nextAchievement,
  XP_PER_LEVEL,
} from '@/lib/hud-progress';
import type { AchievementProgress } from '@/lib/achievements';

const format = (n: number) => n.toLocaleString('ru-RU');
/** Animate from the displayed value, never from zero on refresh. No frame-by-frame React renders. */
function DigitalCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayed = useRef(value);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = displayed.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      start: number | undefined;
    const finish = () => {
      cancelAnimationFrame(frame);
      displayed.current = value;
      node.textContent = format(value);
    };
    const change = () => {
      if (media.matches) finish();
    };
    if (media.matches || from === value) {
      finish();
      return;
    }
    const step = (time: number) => {
      start ??= time;
      const progress = Math.min(1, (time - start) / 700);
      displayed.current = Math.round(
        from + (value - from) * (1 - (1 - progress) ** 3),
      );
      node.textContent = format(displayed.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    media.addEventListener('change', change);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener('change', change);
    };
  }, [value]);
  return (
    <span ref={ref} aria-hidden="true">
      {format(value)}
    </span>
  );
}

function ExperienceFill({ xp }: { xp: number }) {
  const ref = useRef<HTMLElement>(null),
    previous = useRef(xp);
  useEffect(() => {
    const from = experienceProgress(previous.current),
      to = experienceProgress(xp);
    previous.current = xp;
    if (
      to.level <= from.level ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const animation = ref.current?.animate(
      [
        { width: `${from.percent}%`, offset: 0 },
        { width: '100%', offset: 0.45 },
        { width: '0%', offset: 0.451 },
        { width: `${to.percent}%`, offset: 1 },
      ],
      { duration: 700, easing: 'ease-out' },
    );
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (media.matches) animation?.cancel();
    };
    media.addEventListener('change', stop);
    return () => {
      animation?.cancel();
      media.removeEventListener('change', stop);
    };
  }, [xp]);
  return (
    <i ref={ref} style={{ width: `${experienceProgress(xp).percent}%` }} />
  );
}

export function ExperienceHud({
  xp,
  go,
  en = false,
}: {
  xp: number | null;
  go: (path: string) => void;
  en?: boolean;
}) {
  const p = experienceProgress(xp);
  const [previous, setPrevious] = useState({
    total: p.total,
    delta: 0,
    levels: 0,
    revision: 0,
  });
  if (previous.total !== p.total)
    setPrevious({
      total: p.total,
      delta: p.total - previous.total,
      levels: p.level - experienceProgress(previous.total).level,
      revision: previous.revision + 1,
    });
  const label = en
    ? `Level ${p.level}. ${p.current} of ${XP_PER_LEVEL} XP. ${p.remaining} XP to next level. Open profile`
    : `Уровень ${p.level}. ${p.current} из ${XP_PER_LEVEL} XP. До следующего уровня ${p.remaining} XP. Открыть профиль`;
  return (
    <div className="hud-experience">
      <button
        className="hud-xp-chip"
        type="button"
        onClick={() => go('/profile')}
        aria-label={label}
        title={label}
      >
        <Zap size={14} aria-hidden="true" />
        <span className="hud-xp-level">
          LVL <b>{p.level}</b>
        </span>
        <span className="hud-xp-total">
          <DigitalCounter value={p.total} /> <small>XP</small>
        </span>
      </button>
      <div
        className="hud-xp-rail"
        role="progressbar"
        aria-label={en ? 'Level experience' : 'Опыт текущего уровня'}
        aria-valuemin={0}
        aria-valuemax={XP_PER_LEVEL}
        aria-valuenow={p.current}
        aria-valuetext={
          en
            ? `Level ${p.level}: ${p.current} of 500 XP`
            : `Уровень ${p.level}: ${p.current} из 500 XP`
        }
      >
        <ExperienceFill xp={p.total} />
        <span aria-hidden="true" />
      </div>
      <div
        className="hud-xp-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {previous.delta !== 0 && (
          <span
            key={previous.revision}
            className={`hud-xp-feedback ${previous.delta > 0 ? 'is-gain' : 'is-adjustment'}`}
          >
            <Zap size={15} aria-hidden="true" />
            {previous.delta > 0 ? '+' : '−'}
            {format(Math.abs(previous.delta))} XP
            {previous.levels > 0
              ? en
                ? ` · Level ${p.level} unlocked`
                : ` · Новый уровень ${p.level}`
              : previous.delta < 0
                ? en
                  ? ' · Progress updated'
                  : ' · Прогресс пересчитан'
                : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProfileLevel({
  xp,
  title,
}: {
  xp: number | null;
  title: string;
}) {
  const p = experienceProgress(xp);
  return (
    <article className="hud-level-panel hud-sync-tile">
      <div className="hud-panel-top">
        <span className="hud-kicker">ПРОГРЕСС ЗРИТЕЛЯ</span>
        <span className="hud-serial" aria-hidden="true">
          XP / {String(p.level).padStart(3, '0')}
        </span>
      </div>
      <div className="hud-level-identity">
        <span className="hud-level-number">
          {String(p.level).padStart(2, '0')}
        </span>
        <div>
          <span className="hud-kicker">УРОВЕНЬ</span>
          <h2>{title}</h2>
        </div>
        <Zap size={28} aria-hidden="true" />
      </div>
      <div className="hud-level-meta">
        <b>
          <DigitalCounter value={p.total} />
          <span className="hud-sr-only">{format(p.total)}</span> XP
        </b>
        <span>
          ещё <strong>{p.remaining}</strong> до уровня {p.level + 1}
        </span>
      </div>
      <div
        className="hud-level-track"
        role="progressbar"
        aria-label="Прогресс уровня в профиле"
        aria-valuemin={0}
        aria-valuemax={XP_PER_LEVEL}
        aria-valuenow={p.current}
      >
        <ExperienceFill xp={p.total} />
      </div>
      <div className="hud-level-scale">
        <span>
          {p.current} / {XP_PER_LEVEL} XP
        </span>
        <span>
          LVL {p.level + 1} <ChevronRight size={12} />
        </span>
      </div>
    </article>
  );
}

export function ProfileHud({
  xp,
  title,
  watches,
  minutes,
  achieved,
  days,
  showLevel = true,
  progress,
  go,
}: {
  xp: number | null;
  title: string;
  watches: number;
  minutes: number;
  achieved: number;
  days: number;
  showLevel?: boolean;
  progress: Partial<AchievementProgress>;
  go: (path: string) => void;
}) {
  const goal = nextAchievement(progress);
  return (
    <section className="hud-command" aria-label="Личный командный центр">
      <div className="hud-section-label">
        <span>
          <AudioLines size={15} /> ЛИЧНОЕ / КОМАНДНЫЙ ЦЕНТР
        </span>
        <small>ТВОЯ ИСТОРИЯ В ЦИФРАХ</small>
      </div>
      <div
        className={`hud-overview ${showLevel ? '' : 'hud-overview-metrics'}`}
      >
        {showLevel && <ProfileLevel xp={xp} title={title} />}
        {[
          {
            id: 'watched',
            icon: Film,
            label: 'ПРОСМОТРЕНО',
            value: format(watches),
            note: 'уникальных историй',
          },
          {
            id: 'time',
            icon: Clock3,
            label: 'ВРЕМЯ В КИНО',
            value: `${format(Math.floor(minutes / 60))} ч`,
            note: `и ${minutes % 60} мин · по дневнику`,
          },
          {
            id: 'trophies',
            icon: Trophy,
            label: 'ДОСТИЖЕНИЯ',
            value: format(achieved),
            note: 'открыто в коллекции',
          },
          {
            id: 'days',
            icon: AudioLines,
            label: 'АКТИВНЫЕ ДНИ',
            value: format(days),
            note: 'в твоём кинодневнике',
          },
        ].map(({ id, icon: Icon, label, value, note }) => (
          <article
            key={id}
            className={`hud-metric hud-metric-${id} hud-sync-tile`}
            aria-label={`${label}: ${value}, ${note}`}
          >
            <span className="hud-metric-caption">
              <Icon size={16} />
              <span>{label}</span>
            </span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className="hud-mission-row">
        <button
          type="button"
          className="hud-next-mission hud-sync-tile"
          onClick={() => go('/achievements')}
        >
          <span className="hud-mission-icon" aria-hidden="true">
            {goal?.icon || <Trophy size={24} />}
          </span>
          <span className="hud-mission-copy">
            <span className="hud-kicker">
              <Crosshair size={12} />{' '}
              {goal ? 'БЛИЖАЙШАЯ ЦЕЛЬ' : 'КОЛЛЕКЦИЯ СОБРАНА'}
            </span>
            <b>
              {goal
                ? `${goal.name} · ${goal.tier}`
                : 'Все обычные тиры открыты'}
            </b>
            <small>
              {goal
                ? `${goal.description} · ${format(goal.current)} / ${goal.target} ${goal.unit}`
                : 'Исследуй скрытые трофеи и новые истории'}
            </small>
          </span>
          {goal && (
            <span className="hud-mission-progress" aria-hidden="true">
              <b>{Math.floor(goal.percent)}%</b>
              <i>
                <span style={{ width: `${goal.percent}%` }} />
              </i>
            </span>
          )}
          <ChevronRight size={18} />
        </button>
        <div className="hud-reward-note">
          <Zap size={17} />
          <div>
            <b>Твои действия имеют вес</b>
            <p>
              Просмотр +35 XP · первая оценка +10 XP. Желаемое и любимое не дают
              опыт. Отмена просмотра возвращает 35 XP.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
