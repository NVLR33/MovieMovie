"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Download,
  ImagePlus,
  Loader2,
  Palette,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import "./profile-identity.css";
import logo from "../../public/brand/moviemovie-logo.png";
import {
  buildCinemaCard,
  cinemaCardShareText,
  type CinemaCardData,
  type CinemaCardFilm,
} from "@/lib/cinema-card";
import {
  CINEMA_CARD_THEMES,
  cinemaCardDimensions,
  renderCinemaCardSvg,
  type CinemaCardFormat,
  type CinemaCardTheme,
} from "@/lib/cinema-card-art";
import { cinemaCardPng, downloadCinemaCard } from "@/lib/cinema-card-export";
import type { AchievementId, AchievementProgress } from "@/lib/achievements";
import type { UnlockedHiddenAchievement } from "@/lib/hidden-achievement-types";
import type { OwnershipStats } from "@/lib/ownership";

export default function CinemaCardStudio({
  user,
  films,
  watches,
  progress,
  ownership,
  hiddenAchievements,
  go,
}: {
  user: { id: number; username: string };
  films: readonly CinemaCardFilm[];
  watches: readonly { movieId: number }[];
  progress: Partial<AchievementProgress>;
  ownership: Partial<Record<AchievementId, OwnershipStats[]>>;
  hiddenAchievements?: readonly UnlockedHiddenAchievement[];
  go: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useMemo(
    () =>
      buildCinemaCard({
        user,
        films,
        watches,
        progress,
        ownership,
        hiddenAchievements,
      }),
    [user, films, watches, progress, ownership, hiddenAchievements],
  );
  return (
    <>
      <section className="cinema-card-entry identity-card-entry">
        <span className="cinema-card-entry-icon" aria-hidden="true">
          <ImagePlus size={25} />
          <Sparkles size={13} />
        </span>
        <div>
          <span className="eyebrow">ЛИЧНАЯ КИНОСТУДИЯ / ВИЗИТКА</span>
          <h2>
            Твой кинопочерк.
            <br />
            <em>В одном кадре.</em>
          </h2>
          <p>
            Жанры, актёр и самая редкая награда — визитка, которую пишут твои
            просмотры.
          </p>
          <div className="identity-entry-meta">
            <span>3 оформления</span>
            <span>2 формата</span>
            <span>PNG без потери качества</span>
          </div>
        </div>
        <button
          type="button"
          ref={trigger}
          className="primary-btn"
          onClick={() => setOpen(true)}
        >
          <Palette size={16} />
          Создать визитку
          <ArrowRight size={15} />
        </button>
      </section>
      {open &&
        createPortal(
          <CinemaCardDialog
            card={card}
            go={(url) => {
              setOpen(false);
              go(url);
            }}
            close={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />,
          document.body,
        )}
    </>
  );
}

function CinemaCardDialog({
  card,
  close,
  go,
}: {
  card: CinemaCardData;
  close: () => void;
  go: (url: string) => void;
}) {
  const [theme, setTheme] = useState<CinemaCardTheme>("aurora");
  const [format, setFormat] = useState<CinemaCardFormat>("square");
  const [logoData, setLogoData] = useState("");
  const [assetError, setAssetError] = useState("");
  const [result, setResult] = useState<{ svg: string; blob: Blob } | null>(
    null,
  );
  const [exportError, setExportError] = useState("");
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [profileUrl] = useState(
    () => `${window.location.origin}/user/${card.userId}`,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [retry, setRetry] = useState(0);
  const headingId = useId();
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadLogo() {
      setAssetError("");
      try {
        const response = await fetch(
          typeof logo === "string" ? logo : logo.src,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Логотип недоступен");
        const blob = await response.blob();
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error("Не удалось прочитать логотип"));
          reader.readAsDataURL(new Blob([blob], { type: "image/png" }));
        });
        if (!cancelled) setLogoData(data);
      } catch {
        if (!cancelled)
          setAssetError(
            "Не удалось загрузить оформление. Попробуй загрузить ещё раз.",
          );
      }
    }
    void loadLogo();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [retry]);

  const svg = useMemo(
    () => renderCinemaCardSvg(card, { theme, format, logoData, profileUrl }),
    [card, theme, format, logoData, profileUrl],
  );
  const ready = !!logoData && result?.svg === svg;
  const { width, height } = cinemaCardDimensions(format);
  const filename = `moviemovie-card-${card.userId}-${format}.png`;
  const shareText = cinemaCardShareText(card);

  useEffect(() => {
    if (!logoData) return;
    let cancelled = false;
    cinemaCardPng(svg, format)
      .then((blob) => {
        if (!cancelled) {
          setResult({ svg, blob });
          setExportError("");
        }
      })
      .catch(() => {
        if (!cancelled)
          setExportError(
            "Не удалось подготовить PNG. Попробуй другое оформление или обнови браузер.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [svg, format, logoData, retry]);

  const save = () => {
    if (!ready || !result) return;
    downloadCinemaCard(result.blob, filename);
    setMessage("PNG сохранён. Его можно прикрепить к посту или истории.");
  };
  const share = async () => {
    if (!ready || !result) return;
    setSharing(true);
    setMessage("");
    try {
      const file = new File([result.blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        // The PNG is prepared in advance, preserving the user gesture on mobile.
        await navigator.share({
          files: [file],
          title: "Моя кино-визитка",
          text: shareText,
        });
        setMessage("Визитка передана в меню «Поделиться».");
      } else {
        downloadCinemaCard(result.blob, filename);
        setMessage(
          "Этот браузер не отправляет файлы напрямую. PNG скачан: прикрепи его в Telegram, VK или к истории.",
        );
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage(
          "Не удалось отправить визитку. Попробуй скачать PNG и прикрепить его вручную.",
        );
    } finally {
      setSharing(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${profileUrl}`);
      setMessage("Текст и ссылка на публичный профиль скопированы.");
    } catch {
      setMessage(
        "Буфер обмена недоступен. Ссылку на профиль можно выделить ниже.",
      );
    }
  };

  return (
    <dialog
      className="cinema-studio identity-card-dialog"
      aria-labelledby={headingId}
      ref={dialog}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Native modality makes the page inert. Wrap the endpoints as well so
        // Chromium never leaves keyboard focus on the document between cycles.
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], [tabindex="0"]',
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            closeRef.current();
        }
      }}
    >
      <header className="cinema-studio-header">
        <div>
          <span className="eyebrow">
            СТУДИЯ <span className="brand-name">moviemovie</span>
          </span>
          <h2 id={headingId}>Твоя история. В одном кадре.</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть кино-визитку"
          onClick={close}
        >
          <X size={21} />
        </button>
      </header>
      <div className="cinema-studio-body">
        <div className="identity-card-canvas">
          <div className="identity-preview-caption">
            <span>ПРЕДПРОСМОТР / {CINEMA_CARD_THEMES[theme].label}</span>
            <span>
              {width} × {height}
            </span>
          </div>
          <div
            className={`cinema-studio-preview cinema-format-${format}`}
            aria-busy={!logoData}
          >
            {logoData ? (
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                width={width}
                height={height}
                alt={`Кино-визитка ${card.username}. ${Math.floor(card.totalMinutes / 60)} ч ${card.totalMinutes % 60} мин в кино. Жанры: ${card.topGenres.map((genre) => genre.name).join(", ") || "пока нет"}. Актёр: ${card.topActor?.name || "нет данных"}. Коронная ачивка: ${card.crown?.name || "пока нет подтверждённых данных"}.`}
              />
            ) : (
              <div className="cinema-studio-loading">
                {!assetError && <Loader2 size={25} />}
                {assetError
                  ? "Оформление пока недоступно"
                  : "Готовим твою визитку…"}
              </div>
            )}
          </div>
          <p className="identity-preview-note">
            Те же данные и оформление попадут в готовый PNG. Визитка обновляется
            вместе с твоей киноисторией.
          </p>
        </div>
        <div className="cinema-studio-settings">
          <div className="identity-settings-intro">
            <span className="eyebrow">РЕЖИССЁР ЗДЕСЬ — ТЫ</span>
            <h3>Выбери свой кадр</h3>
            <p>Оформление меняется. Твоя история остаётся.</p>
          </div>
          <fieldset>
            <legend>01 / НАСТРОЕНИЕ</legend>
            <div className="cinema-theme-options">
              {(Object.keys(CINEMA_CARD_THEMES) as CinemaCardTheme[]).map(
                (key) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={theme === key}
                    onClick={() => {
                      setTheme(key);
                      setExportError("");
                      setMessage("");
                    }}
                  >
                    <span
                      style={{
                        background: `linear-gradient(135deg, ${CINEMA_CARD_THEMES[key].background}, ${CINEMA_CARD_THEMES[key].accent})`,
                      }}
                    >
                      {theme === key && <Check size={13} />}
                    </span>
                    <b>{CINEMA_CARD_THEMES[key].label}</b>
                    <small>
                      {key === "aurora"
                        ? "Свет и глубина"
                        : key === "premiere"
                          ? "Вечер премьеры"
                          : "Бумага и чернила"}
                    </small>
                  </button>
                ),
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend>02 / ФОРМАТ</legend>
            <div className="cinema-format-options">
              {(
                [
                  { id: "square", label: "Пост", dimensions: "1080 × 1080" },
                  { id: "story", label: "Сторис", dimensions: "1080 × 1920" },
                ] as const
              ).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={format === item.id}
                  onClick={() => {
                    setFormat(item.id);
                    setExportError("");
                    setMessage("");
                  }}
                >
                  <span className={`cinema-format-shape shape-${item.id}`} />
                  <b>{item.label}</b>
                  <small>{item.dimensions}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="cinema-card-insights">
            <h3>Твой кинопочерк</h3>
            <p>
              Жанры — по истории просмотров, с учётом повторов. Время сериалов —
              по всем эпизодам.
            </p>
            <div className="cinema-genre-links">
              {card.topGenres.map((genre) => (
                <button
                  key={genre.name}
                  type="button"
                  title={`${genre.count} просмотров · ${genre.percentage}% истории`}
                  onClick={() =>
                    go(`/catalog?genre=${encodeURIComponent(genre.name)}`)
                  }
                >
                  {genre.name}
                  <ArrowRight size={11} />
                </button>
              ))}
            </div>
            <p>
              {card.topActor
                ? `${card.topActor.name} — ${card.topActor.count} просмотров. `
                : "Актёр пока не определён. "}
              Состав известен для {card.castCoverage.known} из{" "}
              {card.castCoverage.total} просмотров. При равенстве — по алфавиту.
            </p>
            <button
              type="button"
              className="cinema-crown-link"
              onClick={() => go("/achievements")}
            >
              <Crown size={14} />
              {card.crown
                ? `Самая редкая награда: ${card.crown.name}`
                : "Награды и условия коронной ачивки"}
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="identity-export-heading">
            <span className="eyebrow">03 / ЗАБЕРИ СВОЮ ИСТОРИЮ</span>
            <p>
              PNG · {width} × {height} · готов к публикации
            </p>
          </div>
          <div className="cinema-export-actions">
            <button
              type="button"
              className="primary-btn"
              disabled={!ready || sharing}
              onClick={share}
            >
              {sharing ? <Loader2 size={16} /> : <Share2 size={16} />}
              Поделиться визиткой
            </button>
            <button
              type="button"
              className="outline-btn"
              disabled={!ready}
              onClick={save}
            >
              {ready ? <Download size={16} /> : <Loader2 size={16} />}Скачать
              PNG
            </button>
          </div>
          <div className="cinema-social-actions">
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
              <ArrowRight size={12} />
            </a>
            <a
              href={`https://vk.com/share.php?url=${encodeURIComponent(profileUrl)}&title=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              VK
              <ArrowRight size={12} />
            </a>
            <button type="button" onClick={copy}>
              <Copy size={13} />
              Текст
            </button>
          </div>
          <p className="cinema-sharing-note">
            Telegram и VK откроют отправку ссылки на профиль. Чтобы отправить
            саму инфографику, скачай PNG и прикрепи его.
          </p>
          <p className="cinema-public-url">{profileUrl}</p>
          <p className="cinema-privacy-note">
            На визитке только имя и киностатистика. Почта, сообщения и другие
            личные данные не публикуются.
          </p>
          {(assetError || exportError) && (
            <button
              type="button"
              className="outline-btn small"
              onClick={() => {
                setAssetError("");
                setExportError("");
                setMessage("");
                setResult(null);
                setRetry((value) => value + 1);
              }}
            >
              Повторить подготовку PNG
            </button>
          )}
          <div
            className="cinema-studio-status"
            role="status"
            aria-live="polite"
          >
            {assetError ||
              exportError ||
              message ||
              (!ready ? "Подготавливаем изображение…" : "")}
          </div>
        </div>
      </div>
    </dialog>
  );
}
