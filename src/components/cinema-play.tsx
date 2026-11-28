"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  Clapperboard,
  Theater,
  Image as ImageIcon,
  Clock3,
  Globe2,
  Languages,
  Film,
  Trophy,
  Grid2X2,
  ScanText,
  Shuffle,
  CircleHelp,
  Hourglass,
  Puzzle,
  Award,
  CalendarDays,
  Gamepad2,
  Search,
  X,
} from "lucide-react";
import { gameModes } from "@/lib/cinema-practice";
export function PlayNavigation({
  active,
  go,
}: {
  active: "games" | "achievements" | "challenges";
  go: (href: string) => void;
}) {
  return (
    <nav className="cinema-play-nav" aria-label="Игры и прогресс">
      {[
        { id: "games", label: "Кинорадар", icon: Gamepad2 },
        { id: "achievements", label: "Достижения", icon: Award },
        { id: "challenges", label: "Челленджи", icon: CalendarDays },
      ].map((item) => (
        <Link
          key={item.id}
          href={"/" + item.id}
          prefetch={false}
          aria-current={active === item.id ? "page" : undefined}
          onClick={(e) => {
            if (
              !e.button &&
              !e.ctrlKey &&
              !e.metaKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              go("/" + item.id);
            }
          }}
        >
          <item.icon size={16} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
const modeIcons: Record<string, typeof BookOpen> = {
  story: BookOpen,
  year: Calendar,
  director: Clapperboard,
  genre: Theater,
  poster: ImageIcon,
  duration: Clock3,
  country: Globe2,
  original: Languages,
  category: Film,
  higher: Trophy,
  wordle: Grid2X2,
  hangman: ScanText,
  anagram: Shuffle,
  truths: CircleHelp,
  chrono: Hourglass,
  connections: Puzzle,
};
function PracticeIcon({ mode }: { mode: string }) {
  const Icon = modeIcons[mode] || Gamepad2;
  return <Icon size={25} strokeWidth={1.5} aria-hidden="true" />;
}
const groups: Record<string, string[]> = {
  recognize: ["story", "poster", "original", "wordle", "hangman", "anagram"],
  details: ["year", "director", "genre", "duration", "country", "category"],
  connect: ["higher", "truths", "chrono", "connections"],
};
export function GameLobby({
  start,
  busy = false,
}: {
  start: (id: string) => void;
  busy?: boolean;
}) {
  const [group, setGroup] = useState("all"),
    [query, setQuery] = useState("");
  const filtered = gameModes.filter(
    (g) =>
      (group === "all" || groups[group]?.includes(g.id)) &&
      `${g.name} ${g.description}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <div className="practice-lobby-stage">
        <header>
          <span className="eyebrow">ИГРЫ / КОРОТКОЕ ЗАМЫКАНИЕ КИНОПАМЯТИ</span>
          <h1>
            Узнать с кадра.
            <br />
            <em>Вспомнить с полуслова.</em>
          </h1>
          <p>
            Шестнадцать способов посмотреть на знакомые истории иначе. Пять
            вопросов в тренировке, четыре варианта в каждом.
          </p>
          <div className="practice-numbers">
            <div>
              <b>{gameModes.length}</b>
              <span>режимов</span>
            </div>
            <div>
              <b>5</b>
              <span>вопросов</span>
            </div>
            <div>
              <b>4</b>
              <span>варианта</span>
            </div>
          </div>
        </header>
        <aside className="practice-warmup">
          <span className="eyebrow">ДЛЯ РАЗОГРЕВА</span>
          <span className="practice-feature-icon">
            <BookOpen size={42} strokeWidth={1.3} aria-hidden="true" />
          </span>
          <h2>История без названия.</h2>
          <p>
            Узнай фильм по описанию. Никакого таймера — только ты и кино,
            которое осталось в памяти.
          </p>
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => start("story")}
          >
            Начать тренировку <ArrowUpRight size={17} />
          </button>
          <small>Результат — в историю. XP за тренировку не начисляется.</small>
        </aside>
      </div>
      <section className="practice-library" aria-label="Режимы тренировки">
        <header>
          <div>
            <span className="eyebrow">ВЫБЕРИ СВОЙ СПОСОБ ВСПОМНИТЬ</span>
            <h2>На что настроим кинорадар?</h2>
          </div>
          <span role="status">
            {filtered.length} / {gameModes.length}
          </span>
        </header>
        <div className="practice-tools">
          <div role="group" aria-label="Тип тренировки">
            {[
              ["all", "Все игры"],
              ["recognize", "Узнавать"],
              ["details", "Знать детали"],
              ["connect", "Сопоставлять"],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={group === id}
                onClick={() => setGroup(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            <Search size={17} />
            <input
              aria-label="Найти игру"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название или подсказка…"
            />
          </label>
        </div>
        <div className="games-grid">
          {filtered.map((g) => (
            <button
              type="button"
              key={g.id}
              className={`game-card game-${g.color}`}
              disabled={busy}
              onClick={() => start(g.id)}
            >
              <div className="game-card-top">
                <span className="game-emoji">
                  <PracticeIcon mode={g.id} />
                </span>
                <small>
                  {String(
                    gameModes.findIndex((m) => m.id === g.id) + 1,
                  ).padStart(2, "0")}{" "}
                  / 16
                </small>
              </div>
              <div>
                <h3>{g.name}</h3>
                <p>{g.description}</p>
              </div>
              <span className="game-launch">
                Играть <ArrowUpRight size={17} />
              </span>
            </button>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <h3>Такой игры не нашли</h3>
            <button
              type="button"
              className="outline-btn"
              onClick={() => {
                setQuery("");
                setGroup("all");
              }}
            >
              Показать все игры
            </button>
          </div>
        )}
        <p className="practice-note">
          Вопросы основаны на данных каталога. Если четырёх разных вариантов не
          хватает, режим сообщит об этом. При небольшой базе вопросы могут
          повторяться. Тренировки доступны гостям; для сохранения результата
          нужен аккаунт.
        </p>
      </section>
    </>
  );
}
export function PracticeDialog({
  close,
  children,
  label,
}: {
  close: () => void;
  children: ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!,
      previous = document.activeElement as HTMLElement,
      overflow = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      (previous?.isConnected
        ? previous
        : document.getElementById("main-content")
      )?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="glass-modal game-modal cinema-practice-dialog"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const items = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]),[href],input:not([disabled]),[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !items.includes(document.activeElement as HTMLElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !items.includes(document.activeElement as HTMLElement))
        ) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <button
        type="button"
        className="modal-close"
        aria-label="Закрыть тренировку"
        onClick={close}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}
