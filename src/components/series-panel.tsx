"use client";
import MaterialPlayer from "./material-player";
import { createPortal } from "react-dom";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Layers3,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
  Link2,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { browserStorage, copyText } from "@/lib/browser-preferences";
import {
  resolveSeason,
  seasonLink,
  seasonStorageKey,
  seasonNumber,
} from "@/lib/season-navigation";
import {
  SERIAL_MIN_EPISODES,
  seriesProgress,
  type SeriesSeason,
  type SeriesSnapshot,
} from "@/lib/series";

type Mutation = (body: Record<string, unknown>) => Promise<boolean>;
function Rating({
  value,
  label,
  busy,
  signedIn,
  auth,
  onChange,
}: {
  value: number | null;
  label: string;
  busy: boolean;
  signedIn: boolean;
  auth: () => void;
  onChange: (value: number | null) => void;
}) {
  return signedIn ? (
    <select
      aria-label={label}
      disabled={busy}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Без оценки</option>
      {Array.from({ length: 20 }, (_, i) => (i + 1) / 2).map((score) => (
        <option key={score} value={score}>
          {score.toFixed(1)} / 10
        </option>
      ))}
    </select>
  ) : (
    <button type="button" className="outline-btn small" onClick={auth}>
      Войти для оценки
    </button>
  );
}
function SeasonEditor({
  season,
  nextNumber,
  busy,
  mutate,
}: {
  season?: SeriesSeason;
  nextNumber: number;
  busy: boolean;
  mutate: Mutation;
}) {
  const [number, setNumber] = useState(season?.number ?? nextNumber);
  const [title, setTitle] = useState(season?.title ?? "");
  const [count, setCount] = useState(season?.episodes.length || 1);
  return (
    <form
      className="series-editor-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          season &&
          count < season.episodes.length &&
          !window.confirm(
            "Уменьшение числа эпизодов удалит лишние эпизоды и их оценки. Уже заработанные достижения сохранятся. Продолжить?",
          )
        )
          return;
        void mutate({
          action: "saveSeason",
          ...(season ? { id: season.id } : {}),
          number,
          title,
          episodeCount: count,
        });
      }}
    >
      <label>
        Номер сезона
        <input
          type="number"
          required
          min={1}
          max={100}
          value={number}
          onChange={(e) => setNumber(Number(e.target.value))}
        />
      </label>
      <label>
        Название (необязательно)
        <input
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Эпизодов
        <input
          type="number"
          required
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
      </label>
      <button className="outline-btn small" disabled={busy} type="submit">
        {season ? (
          "Сохранить сезон"
        ) : (
          <>
            <Plus size={14} />
            Добавить сезон
          </>
        )}
      </button>
      {season && (
        <button
          className="outline-btn small danger"
          disabled={busy}
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Удалить сезон, его эпизоды и оценки? Заработанные достижения сохранятся.",
              )
            )
              void mutate({ action: "deleteSeason", id: season.id });
          }}
        >
          <Trash2 size={14} />
          Удалить сезон
        </button>
      )}
    </form>
  );
}

export default function SeriesPanel({
  movieId,
  title,
  userId,
  auth,
  onUpdated,
}: {
  movieId: number;
  title: string;
  userId: number | null;
  auth: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState<SeriesSnapshot | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const url = `/api/series?movieId=${movieId}`;
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(
    () => !!seasonNumber(searchParams.get("season")),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const storageKey = seasonStorageKey(movieId, userId);
  const [rememberedId, setRememberedId] = useState(() =>
    browserStorage.getItem(storageKey),
  );
  const selected = resolveSeason(
    snapshot?.seasons || [],
    searchParams.get("season"),
    rememberedId,
  );
  const selectedIndex =
    snapshot?.seasons.findIndex((season) => season.id === selected?.id) ?? -1;
  const seasonHeading = useRef<HTMLHeadingElement>(null);
  const scrollToSeason = useRef(false);
  const initialLink = useRef(false);
  const dirty = useRef(false);
  const [fallbackLink, setFallbackLink] = useState("");

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (!element) return;
    const previous =
      trigger.current || (document.activeElement as HTMLElement | null);
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!selected || !open) return;
    browserStorage.setItem(storageKey, String(selected.id));
    const followLink = !initialLink.current && searchParams.has("season");
    initialLink.current = true;
    if (scrollToSeason.current || followLink) {
      scrollToSeason.current = false;
      seasonHeading.current?.focus({ preventScroll: true });
      seasonHeading.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
  }, [selected?.id, storageKey, searchParams, selected, open]);

  const close = () => {
    if (pending.current) {
      setMessage("Дождись завершения сохранения.");
      return;
    }
    if (
      dirty.current &&
      !window.confirm(
        "Закрыть сезоны? Несохранённые изменения редактора будут потеряны.",
      )
    )
      return;
    dirty.current = false;
    setEditing(false);
    setOpen(false);
  };
  const authenticate = () => {
    setOpen(false);
    auth();
  };

  const chooseSeason = (id: number, scroll = false) => {
    const season = snapshot?.seasons.find((item) => item.id === id);
    if (!season || busy || season.id === selected?.id) return;
    if (
      dirty.current &&
      !window.confirm(
        "Перейти к другому сезону? Несохранённые изменения редактора будут потеряны.",
      )
    )
      return;
    dirty.current = false;
    setMessage("");
    setError("");
    setFallbackLink("");
    scrollToSeason.current = scroll;
    setRememberedId(String(id));
    browserStorage.setItem(storageKey, String(id));
    window.history.replaceState(
      null,
      "",
      seasonLink(window.location.href, season.number),
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Не удалось загрузить сезоны");
        if (!controller.signal.aborted) {
          setSnapshot(data);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Ошибка загрузки");
      });
    return () => controller.abort();
  }, [url, userId, revision]);

  const mutate: Mutation = async (body) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, movieId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить");
      const fresh = await fetch(url, { cache: "no-store" });
      if (!fresh.ok)
        throw new Error(
          "Изменения сохранены, но обновить список не удалось. Нажмите «Повторить».",
        );
      if (body.action === "deleteSeason") scrollToSeason.current = true;
      setSnapshot(await fresh.json());
      if (
        ["saveSeason", "saveEpisode", "deleteSeason"].includes(
          String(body.action),
        )
      )
        dirty.current = false;
      setMessage(
        result.newlyCompleted
          ? "📚 Сериал засчитан в «Серийного маньяка»! Прогресс сохранён навсегда."
          : "Сохранено",
      );
      if (
        result.newlyCompleted ||
        ["saveSeason", "deleteSeason"].includes(String(body.action))
      )
        await onUpdated();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось сохранить");
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const progress = seriesProgress(
    snapshot?.seasons || [],
    snapshot?.catalogComplete || false,
  );
  const nextNumber =
    Math.max(0, ...(snapshot?.seasons || []).map((s) => s.number)) + 1;
  const content = (
    <section
      className="series-panel"
      onChangeCapture={event => { if ((event.target as HTMLElement).closest('form')) dirty.current = true; }}
      aria-label="Сезоны и эпизоды"
      aria-busy={busy}
    >
      <header className="series-panel-heading">
        <div>
          <h3>Сезоны и эпизоды</h3>
          <p>
            Выбери сезон, включи эпизод или поставь оценку. Оценки здесь не
            меняют рейтинг сериала и не начисляют XP.
          </p>
        </div>
        {snapshot?.canEdit && (
          <button
            type="button"
            className="outline-btn small"
            onClick={() => {
              if (
                editing &&
                dirty.current &&
                !window.confirm(
                  "Закрыть редактор? Несохранённые изменения выбранного сезона будут потеряны.",
                )
              )
                return;
              dirty.current = false;
              setEditing(!editing);
            }}
          >
            <Settings2 size={15} />
            {editing ? "Закрыть редактор" : "Редактировать сезоны"}
          </button>
        )}
      </header>
      {error && (
        <div className="series-error" role="alert">
          {error}
          <button
            type="button"
            className="outline-btn small"
            onClick={() => setRevision((r) => r + 1)}
          >
            Повторить
          </button>
        </div>
      )}
      {!snapshot && !error && <p role="status">Загружаем сезоны…</p>}
      {snapshot && (
        <>
          <details
            className={`series-completion ${snapshot.completed ? "is-complete" : ""}`}
          >
            <summary>
              <b>
                {snapshot.completed ? (
                  <>
                    <CheckCircle2 size={16} />
                    Сериал уже засчитан в достижение
                  </>
                ) : (
                  "📚 Серийный маньяк"
                )}
              </b>
              <span>
                Оценено {progress.rated} из {progress.total}
              </span>
              <ChevronDown size={15} />
            </summary>
            <div className="bar-track">
              <i
                style={{
                  width: `${progress.total ? (progress.rated / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <small>
              {snapshot.completed
                ? "Этот результат не пропадёт при добавлении новых сезонов или изменении оценок."
                : !snapshot.catalogComplete
                  ? "Редактор ещё не подтвердил полный список сезонов и эпизодов. Ачивка пока не начисляется."
                  : progress.episodeCount < SERIAL_MIN_EPISODES
                    ? `Для достижения нужен сериал минимум с ${SERIAL_MIN_EPISODES} эпизодами.`
                    : progress.complete
                      ? "Все оценки на месте. Обнови любую из них, чтобы зафиксировать достижение."
                      : "Оцени каждый сезон и каждый эпизод. Общая оценка сериала не заменяет отдельные оценки."}
            </small>
          </details>
          {editing && snapshot.canEdit && (
            <div className="series-editor">
              <h4>Структура сериала</h4>
              <p>
                Укажите все сезоны и эпизоды вручную. Изменение структуры
                снимает подтверждение полноты. Уменьшение количества серий
                удаляет лишние эпизоды и их оценки.
              </p>
              {nextNumber <= 100 && (
                <SeasonEditor
                  key={nextNumber}
                  nextNumber={nextNumber}
                  busy={busy}
                  mutate={mutate}
                />
              )}
              <button
                type="button"
                className="outline-btn small"
                disabled={busy || !snapshot.seasons.length}
                onClick={() => {
                  if (
                    snapshot.catalogComplete ||
                    window.confirm(
                      "Подтверждаете, что внесены ВСЕ сезоны и эпизоды сериала? По этому списку будут начисляться достижения.",
                    )
                  )
                    void mutate({
                      action: "publish",
                      complete: !snapshot.catalogComplete,
                    });
                }}
              >
                {snapshot.catalogComplete
                  ? "Снять подтверждение полноты"
                  : "Подтвердить полный список"}
              </button>
            </div>
          )}
          {!snapshot.seasons.length && (
            <p className="series-empty">
              Сезоны ещё не добавлены редактором. Общее число серий из карточки
              не заменяет их учёт.
            </p>
          )}
          {snapshot.seasons.length > 1 && (
            <nav className="series-season-nav" aria-label="Выбор сезона">
              <div className="series-season-nav-heading">
                <b>Выбери сезон</b>
                <small>
                  {snapshot.seasons.length} в каталоге · показан один сезон
                </small>
              </div>
              {snapshot.seasons.length > 6 ? (
                <label className="series-season-select">
                  Сезон
                  <select
                    aria-label="Выбрать сезон"
                    value={selected?.id ?? ""}
                    disabled={busy}
                    onChange={(event) =>
                      chooseSeason(Number(event.target.value))
                    }
                  >
                    {snapshot.seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        Сезон {season.number}
                        {season.title ? ` · ${season.title}` : ""} ·{" "}
                        {season.episodes.length} эп.
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div
                  className="series-season-choices"
                  role="group"
                  aria-label="Сезоны сериала"
                >
                  {snapshot.seasons.map((season) => (
                    <button
                      key={season.id}
                      type="button"
                      aria-pressed={selected?.id === season.id}
                      disabled={busy}
                      onClick={() => chooseSeason(season.id)}
                    >
                      <b>Сезон {season.number}</b>
                      <small>{season.episodes.length} эп.</small>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          )}
          {searchParams.has("season") &&
            !snapshot.seasons.some(
              (season) =>
                season.number === seasonNumber(searchParams.get("season")),
            ) &&
            snapshot.seasons.length > 0 && (
              <p role="status">
                Сезон из ссылки недоступен. Показан сохранённый или первый
                доступный сезон.
              </p>
            )}
          <div className="series-seasons" id="series-seasons">
            {selected &&
              [selected].map((season) => (
                <section
                  key={season.id}
                  className="series-season"
                  aria-labelledby={`series-season-${movieId}-${season.id}`}
                  onChangeCapture={(event) => {
                    if ((event.target as HTMLElement).closest("form"))
                      dirty.current = true;
                  }}
                >
                  <header className="series-selected-heading">
                    <div>
                      <span className="eyebrow">СЕЗОН {season.number}</span>
                      <h4
                        id={`series-season-${movieId}-${season.id}`}
                        ref={seasonHeading}
                        tabIndex={-1}
                      >
                        Сезон {season.number}
                        {season.title ? ` · ${season.title}` : ""}
                      </h4>
                      <p>
                        {season.episodes.length} эп. · оценено{" "}
                        {
                          season.episodes.filter((e) => e.rating !== null)
                            .length
                        }{" "}
                        из {season.episodes.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={async () => {
                        const link = seasonLink(
                          window.location.href,
                          season.number,
                        );
                        const copied = await copyText(link);
                        setFallbackLink(copied ? "" : link);
                        setMessage(
                          copied
                            ? "Ссылка на сезон скопирована"
                            : "Не удалось скопировать автоматически. Скопируй ссылку из поля ниже.",
                        );
                      }}
                    >
                      <Link2 size={15} />
                      Ссылка на сезон
                    </button>
                  </header>
                  {fallbackLink && (
                    <label className="series-link-fallback">
                      Ссылка на сезон
                      <input
                        readOnly
                        value={fallbackLink}
                        onFocus={(event) => event.target.select()}
                      />
                    </label>
                  )}
                  {editing && snapshot.canEdit && (
                    <SeasonEditor
                      season={season}
                      nextNumber={nextNumber}
                      busy={busy}
                      mutate={mutate}
                    />
                  )}
                  <div className="series-rating-row season-rating-row">
                    <b>Твоя оценка сезона {season.number}</b>
                    <Rating
                      value={season.rating}
                      label={`Оценка сезона ${season.number}`}
                      busy={busy}
                      signedIn={snapshot.authenticated}
                      auth={authenticate}
                      onChange={(value) =>
                        void mutate({
                          action: "rateSeason",
                          id: season.id,
                          value,
                        })
                      }
                    />
                  </div>
                  <ol className="series-episodes">
                    {season.episodes.map((episode) => (
                      <li key={episode.id}>
                        <div className="series-rating-row">
                          <span>
                            Эпизод {episode.number}
                            {episode.title ? ` · ${episode.title}` : ""}
                          </span>
                          <Rating
                            value={episode.rating}
                            label={`Оценка: сезон ${season.number}, эпизод ${episode.number}`}
                            busy={busy}
                            signedIn={snapshot.authenticated}
                            auth={authenticate}
                            onChange={(value) =>
                              void mutate({
                                action: "rateEpisode",
                                id: episode.id,
                                value,
                              })
                            }
                          />
                        </div>
                        <MaterialPlayer
                          url={episode.playbackUrl}
                          title={`Сезон ${season.number} · Эпизод ${episode.number}${episode.title ? ` · ${episode.title}` : ""}`}
                          className="outline-btn small"
                        />
                        {editing && snapshot.canEdit && (
                          <form
                            className="series-episode-editor"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = new FormData(event.currentTarget);
                              void mutate({
                                action: "saveEpisode",
                                id: episode.id,
                                title: String(form.get("title") || ""),
                                playbackUrl: String(
                                  form.get("playbackUrl") || "",
                                ),
                              });
                            }}
                          >
                            <input
                              aria-label={`Название: сезон ${season.number}, эпизод ${episode.number}`}
                              name="title"
                              defaultValue={episode.title}
                              maxLength={160}
                              placeholder="Название эпизода (необязательно)"
                            />
                            <label className="episode-playback-field">
                              Источник просмотра эпизода
                              <input
                                type="url"
                                name="playbackUrl"
                                defaultValue={episode.playbackUrl || ""}
                                maxLength={4096}
                                aria-label={`Источник: сезон ${season.number}, эпизод ${episode.number}`}
                                placeholder="HTTPS: VK, Rutube или MP4"
                              />
                              <small>
                                Только контент с разрешением на показ. Публичная
                                ссылка, не HTML и не секретный токен.
                              </small>
                            </label>
                            <button
                              disabled={busy}
                              className="outline-btn small"
                              type="submit"
                            >
                              Сохранить эпизод
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            {selected && snapshot.seasons.length > 1 && (
              <nav
                className="series-season-pagination"
                aria-label="Переход между сезонами"
              >
                <button
                  type="button"
                  className="outline-btn"
                  disabled={busy || selectedIndex <= 0}
                  onClick={() =>
                    chooseSeason(snapshot.seasons[selectedIndex - 1].id, true)
                  }
                >
                  <ChevronLeft size={16} />
                  Предыдущий сезон
                </button>
                <span>
                  {selectedIndex + 1} / {snapshot.seasons.length}
                </span>
                <button
                  type="button"
                  className="outline-btn"
                  disabled={
                    busy || selectedIndex >= snapshot.seasons.length - 1
                  }
                  onClick={() =>
                    chooseSeason(snapshot.seasons[selectedIndex + 1].id, true)
                  }
                >
                  Следующий сезон
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        </>
      )}
      <p className="series-message" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="outline-btn detail-seasons-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`series-browser-${movieId}`}
        onClick={() => setOpen(true)}
      >
        <Layers3 size={17} />
        <span>
          Сезоны и эпизоды
          {snapshot && (
            <small>
              {snapshot.seasons.length
                ? `${snapshot.seasons.length} сез. · ${snapshot.seasons.reduce((count, season) => count + season.episodes.length, 0)} эп.`
                : "Список готовится"}
            </small>
          )}
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <dialog
          ref={dialog}
          id={`series-browser-${movieId}`}
          className="series-browser"
          aria-labelledby={`series-browser-title-${movieId}`}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const element = event.currentTarget;
            const controls = [
              ...element.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
              ),
            ].filter((control) => control.checkVisibility());
            const first = controls[0],
              last = controls.at(-1);
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                !element.contains(document.activeElement))
            ) {
              event.preventDefault();
              last?.focus();
            } else if (
              !event.shiftKey &&
              (document.activeElement === last ||
                !element.contains(document.activeElement))
            ) {
              event.preventDefault();
              first?.focus();
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              close();
          }}
        >
          <header className="series-browser-heading">
            <div>
              <span className="eyebrow">НАВИГАЦИЯ ПО СЕРИАЛУ</span>
              <h2 id={`series-browser-title-${movieId}`}>{title}</h2>
            </div>
            <button
              type="button"
              autoFocus
              className="icon-button"
              aria-label="Закрыть сезоны"
              onClick={close}
            >
              <X size={21} />
            </button>
          </header>
          <div className="series-browser-scroll">{content}</div>
        </dialog>
      )}
    </>
  );
}
