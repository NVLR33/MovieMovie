'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, MonitorPlay, X } from 'lucide-react';
import { playbackSource, type PlaybackSource } from '@/lib/playback-source';

function PlayerDialog({
  source,
  title,
  close,
}: {
  source: PlaybackSource;
  title: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    // Stop a pending/active poster preview before asking for viewing consent.
    window.dispatchEvent(
      new CustomEvent('mg-trailer-preview', { detail: null }),
    );
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="material-player"
      aria-label={`Просмотр: ${title}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          close();
      }}
    >
      <header>
        <div>
          <small>ПРОСМОТР · {source.provider}</small>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          autoFocus
          aria-label="Закрыть просмотр"
          onClick={close}
        >
          <X size={22} />
        </button>
      </header>
      {!started ? (
        <div className="material-player-consent">
          <MonitorPlay size={38} aria-hidden="true" />
          <h3>Видео с внешнего источника</h3>
          <p>
            После подключения {source.provider} получит ваш IP-адрес и может
            использовать cookies, собирать данные и показывать рекламу.
            Доступность и ограничения определяет источник.
          </p>
          <p>
            MovieMovie не хранит видео и не отмечает материал просмотренным
            автоматически.
          </p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => setStarted(true)}
          >
            Подключить {source.provider}
          </button>
        </div>
      ) : (
        <div className="material-player-screen">
          {failed ? (
            <div role="alert">
              <h3>Не удалось загрузить видео</h3>
              <p>Источник может быть недоступен или запрещать встраивание.</p>
              <button
                className="outline-btn"
                type="button"
                onClick={() => setFailed(false)}
              >
                Попробовать снова
              </button>
            </div>
          ) : source.kind === 'video' ? (
            <video
              key={source.url}
              src={source.url}
              controls
              playsInline
              preload="none"
              onError={() => setFailed(true)}
            />
          ) : (
            <iframe
              key={source.url}
              title={`Видео: ${title}`}
              src={source.url}
              allow="fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      )}
      <footer>
        <p>
          Если видите ошибку или пустой плеер, откройте видео у источника.
          Некоторые запреты встраивания браузер не позволяет определить
          автоматически.
        </p>
        <a
          href={source.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Открыть у источника <ExternalLink size={14} />
        </a>
        {started && (
          <button type="button" onClick={() => setStarted(false)}>
            Отключить источник
          </button>
        )}
      </footer>
    </dialog>,
    document.body,
  );
}
/** No iframe, video src, preconnect or provider request before explicit per-opening consent. */
export default function MaterialPlayer({
  url,
  title,
  className = 'primary-btn',
}: {
  url?: string | null;
  title: string;
  className?: string;
}) {
  const source = playbackSource(url);
  const [open, setOpen] = useState(false);
  if (!source) return null;
  return (
    <>
      <button
        type="button"
        className={`material-watch-button ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MonitorPlay size={17} />
        Смотреть
      </button>
      {open && (
        <PlayerDialog
          key={source.url}
          source={source}
          title={title}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}
