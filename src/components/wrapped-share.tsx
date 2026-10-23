'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Share2,
  Smartphone,
  Square,
  RectangleVertical,
  X,
} from 'lucide-react';

import type { WrappedData } from './wrapped-experience';

/* ============================================
   TYPES
============================================ */

type Props = {
  data: WrappedData;
  onClose: () => void;
  initialSlide?: number;
};

type Format = 'story' | 'post' | 'square';

type CardType =
  | 'summary'
  | 'time'
  | 'genre'
  | 'movie'
  | 'achievements';

const FORMATS: Record<
  Format,
  { label: string; width: number; height: number }
> = {
  story: { label: 'История', width: 1080, height: 1920 },
  post: { label: 'Публикация', width: 1080, height: 1350 },
  square: { label: 'Квадрат', width: 1080, height: 1080 },
};

const CARDS: { id: CardType; title: string; emoji: string }[] = [
  { id: 'summary', title: 'Мой киногод', emoji: '🎬' },
  { id: 'time', title: 'Время в кино', emoji: '⏱️' },
  { id: 'genre', title: 'Мой жанр', emoji: '🎭' },
  { id: 'movie', title: 'Фильм года', emoji: '⭐' },
  { id: 'achievements', title: 'Достижения', emoji: '🏆' },
];

const nf = new Intl.NumberFormat('ru-RU');

/* ============================================
   CANVAS HELPERS
============================================ */

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 800,
  align: CanvasTextAlign = 'left'
) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${size}px "Unbounded", "Rubik", Arial, sans-serif`;
  ctx.fillText(value, x, y);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 4
) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;

    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((item, index) => {
    ctx.fillText(item, x, y + index * lineHeight);
  });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);

    const image = new window.Image();
    image.crossOrigin = 'anonymous';

    const timeout = window.setTimeout(() => resolve(null), 5000);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };

    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };

    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const ratio = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight
  );

  const w = image.naturalWidth * ratio;
  const h = image.naturalHeight * ratio;

  ctx.drawImage(
    image,
    x + (width - w) / 2,
    y + (height - h) / 2,
    w,
    h
  );
}

function drawPoster(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 18);
  ctx.clip();

  if (image) {
    drawCover(ctx, image, x, y, width, height);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#474757');
    gradient.addColorStop(1, '#22222e');

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);

    text(
      ctx,
      'MOVIE',
      x + width / 2,
      y + height / 2,
      24,
      '#a8a8ba',
      900,
      'center'
    );
  }

  ctx.restore();
}

/* ============================================
   IMAGE GENERATOR
============================================ */

async function generateWrappedImage(
  data: WrappedData,
  format: Format,
  card: CardType
): Promise<Blob> {
  const { width: W, height: H } = FORMATS[format];

  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas недоступен в этом браузере.');
  }

  const compact = format === 'square';
  const story = format === 'story';

  const M = 85;
  const white = '#f8f8f4';
  const muted = '#a5a5b4';
  const lime = '#d8ff63';

  /* Background */

  const backgrounds: Record<CardType, string> = {
    summary: '#17171e',
    time: '#111317',
    genre: '#d8ff63',
    movie: '#17171f',
    achievements: '#224de2',
  };

  ctx.fillStyle = backgrounds[card];
  ctx.fillRect(0, 0, W, H);

  const darkText = card === 'genre';
  const mainColor = darkText ? '#191b16' : white;
  const secondaryColor = darkText ? '#444b32' : muted;

  /* Decorative circle */

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = darkText ? '#000' : '#fff';
  ctx.beginPath();
  ctx.arc(W + 150, H * 0.35, 500, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /* Header */

  text(
    ctx,
    'moviemovie.',
    M,
    135,
    43,
    darkText ? '#191b16' : lime,
    900
  );

  text(
    ctx,
    `WRAPPED ${data.year}`,
    W - M,
    135,
    27,
    mainColor,
    800,
    'right'
  );

  ctx.fillStyle = darkText ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.16)';
  ctx.fillRect(M, 168, W - M * 2, 2);

  /* Content area */

  const top = story ? 350 : compact ? 265 : 295;

  if (card === 'summary') {
    text(ctx, 'ЭТО БЫЛО', M, top, 74, white);
    text(ctx, 'КИНО.', M, top + 107, 125, lime);

    text(
      ctx,
      `@${data.username}`,
      M,
      top + 185,
      33,
      muted
    );

    const statsY = story ? top + 350 : top + 280;

    const statWidth = (W - M * 2 - 28) / 2;

    roundedRect(
      ctx,
      M,
      statsY,
      statWidth,
      180,
      24,
      '#292b37'
    );

    roundedRect(
      ctx,
      M + statWidth + 28,
      statsY,
      statWidth,
      180,
      24,
      '#292b37'
    );

    text(
      ctx,
      nf.format(data.watches),
      M + 30,
      statsY + 92,
      67,
      white
    );

    text(
      ctx,
      'ПРОСМОТРОВ',
      M + 30,
      statsY + 137,
      20,
      muted
    );

    text(
      ctx,
      nf.format(data.hours),
      M + statWidth + 58,
      statsY + 92,
      67,
      lime
    );

    text(
      ctx,
      'ЧАСОВ КИНО',
      M + statWidth + 58,
      statsY + 137,
      20,
      muted
    );

    const genreY = statsY + 270;

    text(
      ctx,
      'МОЙ ГЛАВНЫЙ ЖАНР',
      M,
      genreY,
      22,
      muted
    );

    ctx.font = '900 58px "Unbounded", Arial, sans-serif';
    ctx.fillStyle = lime;

    wrapText(
      ctx,
      data.topGenres[0]?.name || 'Кино',
      M,
      genreY + 75,
      W - M * 2,
      65,
      2
    );

    /* Poster strip */

    const posterY = story
      ? H - 570
      : compact
        ? H - 295
        : H - 380;

    const posterWidth = (W - M * 2 - 40) / 5;
    const posterHeight = compact ? 190 : 275;

    const images = await Promise.all(
      data.posters.slice(0, 5).map((movie) =>
        loadImage(movie.poster || '')
      )
    );

    for (let i = 0; i < 5; i++) {
      drawPoster(
        ctx,
        images[i] || null,
        M + i * (posterWidth + 10),
        posterY,
        posterWidth,
        posterHeight
      );
    }
  }

  if (card === 'time') {
    text(ctx, 'ТВОЁ ВРЕМЯ', M, top, 49, white);

    text(
      ctx,
      nf.format(data.hours),
      M,
      top + (story ? 300 : 240),
      data.hours >= 1000 ? 180 : 220,
      lime
    );

    text(
      ctx,
      'ЧАСОВ КИНО',
      M,
      top + (story ? 390 : 325),
      58,
      white
    );

    ctx.font = '500 34px "Rubik", Arial, sans-serif';
    ctx.fillStyle = muted;

    wrapText(
      ctx,
      'За это время можно было освоить новый навык. Но ты освоил кинематограф.',
      M,
      top + (story ? 505 : 440),
      W - M * 2,
      51,
      4
    );

    roundedRect(
      ctx,
      M,
      story ? H - 600 : H - 360,
      W - M * 2,
      170,
      26,
      '#252832'
    );

    text(
      ctx,
      `≈ ${data.days.toLocaleString('ru-RU')} суток`,
      M + 35,
      (story ? H - 600 : H - 360) + 102,
      55,
      lime
    );
  }

  if (card === 'genre') {
    text(
      ctx,
      'МОЯ ЖАНРОВАЯ',
      M,
      top,
      43,
      mainColor
    );

    text(
      ctx,
      'ДУША.',
      M,
      top + 75,
      75,
      mainColor
    );

    const genreName = data.topGenres[0]?.name || 'Кино';

    ctx.fillStyle = mainColor;
    ctx.font = '900 90px "Unbounded", Arial, sans-serif';

    wrapText(
      ctx,
      genreName,
      M,
      top + 220,
      W - M * 2,
      100,
      2
    );

    const genres = data.topGenres.slice(0, 5);
    const max = Math.max(genres[0]?.count || 1, 1);

    const listY = story ? 900 : compact ? 530 : 660;
    const gap = story ? 150 : compact ? 91 : 112;

    genres.forEach((genre, index) => {
      const y = listY + index * gap;

      text(
        ctx,
        `${index + 1}. ${genre.name}`,
        M,
        y,
        29,
        mainColor
      );

      text(
        ctx,
        String(genre.count),
        W - M,
        y,
        29,
        mainColor,
        800,
        'right'
      );

      roundedRect(
        ctx,
        M,
        y + 20,
        W - M * 2,
        18,
        9,
        'rgba(0,0,0,.13)'
      );

      roundedRect(
        ctx,
        M,
        y + 20,
        (W - M * 2) * (genre.count / max),
        18,
        9,
        '#20241b'
      );
    });
  }

  if (card === 'movie') {
    text(
      ctx,
      'МОЙ ФИЛЬМ ГОДА',
      M,
      top,
      47,
      white
    );

    const movie = data.bestMovie;

    const posterWidth = story ? 570 : compact ? 320 : 420;
    const posterHeight = posterWidth * 1.5;

    const posterX = (W - posterWidth) / 2;
    const posterY = story ? 440 : compact ? 330 : 370;

    const image = await loadImage(movie?.poster || '');

    drawPoster(
      ctx,
      image,
      posterX,
      posterY,
      posterWidth,
      posterHeight
    );

    const titleY = posterY + posterHeight + 85;

    ctx.font = '900 48px "Unbounded", Arial, sans-serif';
    ctx.fillStyle = white;

    wrapText(
      ctx,
      movie?.title || 'Интрига сохраняется',
      M,
      titleY,
      W - M * 2,
      65,
      3
    );

    if (movie) {
      text(
        ctx,
        `★ ${movie.rating}/10`,
        M,
        titleY + 150,
        56,
        lime
      );
    }
  }

  if (card === 'achievements') {
    text(
      ctx,
      'ПОБОЧНЫЕ КВЕСТЫ',
      M,
      top,
      42,
      white
    );

    text(
      ctx,
      nf.format(data.challengesCompleted),
      M,
      top + (story ? 335 : 265),
      220,
      white
    );

    text(
      ctx,
      'ЧЕЛЛЕНДЖЕЙ',
      M,
      top + (story ? 430 : 355),
      54,
      white
    );

    text(
      ctx,
      'ПРОЙДЕНО',
      M,
      top + (story ? 510 : 425),
      54,
      white
    );

    roundedRect(
      ctx,
      M,
      story ? 1150 : compact ? 690 : 850,
      W - M * 2,
      200,
      27,
      lime
    );

    text(
      ctx,
      `+${nf.format(data.challengeXP)} XP`,
      W / 2,
      (story ? 1150 : compact ? 690 : 850) + 126,
      73,
      '#17191d',
      900,
      'center'
    );
  }

  /* Footer */

  const footerY = H - (story ? 210 : 90);

  ctx.fillStyle = darkText
    ? 'rgba(0,0,0,.22)'
    : 'rgba(255,255,255,.2)';

  ctx.fillRect(M, footerY - 35, W - M * 2, 2);

  text(
    ctx,
    'ТВОЙ ГОД. ТВОЁ КИНО.',
    M,
    footerY + 17,
    21,
    secondaryColor
  );

  text(
    ctx,
    'MOVIEMOVIE',
    W - M,
    footerY + 17,
    22,
    mainColor,
    900,
    'right'
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Не удалось создать PNG.'));
      },
      'image/png'
    );
  });
}

/* ============================================
   SHARE STUDIO
============================================ */

export default function WrappedShare({
  data,
  onClose,
  initialSlide = 8,
}: Props) {
  const [format, setFormat] = useState<Format>('post');
  const [card, setCard] = useState<CardType>('summary');

  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  /* Preview generation */

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    async function generate() {
      setBusy(true);
      setMessage('');
      setPreview('');
      setImageBlob(null);

      try {
        const blob = await generateWrappedImage(data, format, card);

        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);

        setPreview(objectUrl);
        setImageBlob(blob);
      } catch {
        if (!cancelled) {
          setMessage('Не удалось создать изображение.');
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }

    generate();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [data, format, card]);

  /* Download */

  const download = useCallback(() => {
    if (!imageBlob) return;

    const url = URL.createObjectURL(imageBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `moviemovie-wrapped-${data.year}-${card}-${format}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    setMessage('PNG готов! Изображение сохранено.');
  }, [imageBlob, data.year, card, format]);

  /* Native share */

  async function nativeShare() {
    if (!imageBlob) return;

    const file = new File(
      [imageBlob],
      `moviemovie-wrapped-${data.year}.png`,
      { type: 'image/png' }
    );

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Мой moviemovie Wrapped ${data.year}`,
          text: 'Это был мой киногод! 🎬',
        });

        return;
      }

      setMessage(
        'Браузер не поддерживает отправку PNG. Скачай изображение и опубликуй его вручную.'
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return;
      }

      setMessage('Не удалось открыть меню публикации.');
    }
  }

  return (
    <div className="wshare-backdrop" role="dialog" aria-modal="true">
      <style>{`
        .wshare-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100001;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(5,5,10,.88);
          backdrop-filter: blur(15px);
          color: #fff;
        }

        .wshare-modal {
          display: flex;
          flex-direction: column;
          width: min(1080px, 100%);
          max-height: 94dvh;
          overflow: hidden;
          background: #1c1c24;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 25px;
          box-shadow: 0 30px 90px rgba(0,0,0,.35);
        }

        .wshare-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 28px;
          border-bottom: 1px solid rgba(255,255,255,.1);
        }

        .wshare-header h2 {
          margin: 0;
          font-size: 21px;
          font-weight: 900;
        }

        .wshare-header p {
          margin: 6px 0 0;
          color: #a4a4b1;
          font-size: 13px;
        }

        .wshare-close {
          display: grid;
          place-items: center;
          width: 39px;
          height: 39px;
          background: rgba(255,255,255,.08);
          color: #fff;
          border: 0;
          border-radius: 50%;
          cursor: pointer;
        }

        .wshare-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          min-height: 0;
          overflow-y: auto;
          padding: 28px;
        }

        .wshare-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 450px;
          padding: 25px;
          background: #111117;
          border-radius: 17px;
        }

        .wshare-preview img {
          display: block;
          max-width: 100%;
          max-height: 60dvh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 20px 55px rgba(0,0,0,.35);
        }

        .wshare-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          color: #aaa;
          font-size: 13px;
        }

        .wshare-spin {
          animation: wshare-spin 1s linear infinite;
          color: #d8ff63;
        }

        @keyframes wshare-spin {
          to { transform: rotate(360deg); }
        }

        .wshare-controls {
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .wshare-label {
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 900;
          color: #a9a9b7;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .wshare-options {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .wshare-option {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 15px;
          color: #dedee6;
          background: #292934;
          border: 1px solid transparent;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s;
        }

        .wshare-option.active {
          color: #141414;
          background: #d8ff63;
          border-color: #d8ff63;
        }

        .wshare-format-info {
          margin-top: 12px;
          font-size: 12px;
          color: #9292a0;
        }

        .wshare-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: auto;
        }

        .wshare-primary,
        .wshare-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          min-height: 50px;
          padding: 13px;
          border: 0;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .wshare-primary {
          background: #d8ff63;
          color: #161616;
        }

        .wshare-secondary {
          background: #343440;
          color: #fff;
        }

        .wshare-primary:disabled,
        .wshare-secondary:disabled {
          opacity: .4;
          cursor: not-allowed;
        }

        .wshare-message {
          padding: 12px 14px;
          border-radius: 10px;
          color: #d8ff63;
          background: rgba(216,255,99,.08);
          font-size: 12px;
          line-height: 1.6;
        }

        .wshare-note {
          font-size: 12px;
          line-height: 1.6;
          color: #9292a0;
        }

        @media (max-width: 720px) {
          .wshare-backdrop {
            padding: 0;
          }

          .wshare-modal {
            width: 100%;
            height: 100dvh;
            max-height: none;
            border-radius: 0;
          }

          .wshare-header {
            padding: 18px;
          }

          .wshare-header h2 {
            font-size: 18px;
          }

          .wshare-body {
            display: flex;
            flex-direction: column;
            gap: 22px;
            padding: 17px;
          }

          .wshare-preview {
            min-height: 260px;
            padding: 15px;
          }

          .wshare-preview img {
            max-height: 42dvh;
          }

          .wshare-option {
            padding: 11px;
            font-size: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wshare-backdrop * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="wshare-modal">
        <div className="wshare-header">
          <div>
            <h2>✨ Wrapped Share Studio</h2>
            <p>Твой киногод заслуживает красивой публикации.</p>
          </div>

          <button
            className="wshare-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={21} />
          </button>
        </div>

        <div className="wshare-body">
          <div className="wshare-preview">
            {busy ? (
              <div className="wshare-loading">
                <Loader2 className="wshare-spin" size={34} />
                Создаём твою карточку...
              </div>
            ) : preview ? (
              <img src={preview} alt="Предпросмотр Wrapped" />
            ) : (
              <div className="wshare-loading">
                <ImageIcon size={34} />
                Предпросмотр недоступен
              </div>
            )}
          </div>

          <div className="wshare-controls">
            <div>
              <div className="wshare-label">
                01 / Выбери карточку
              </div>

              <div className="wshare-options">
                {CARDS.map((item) => (
                  <button
                    key={item.id}
                    className={
                      card === item.id
                        ? 'wshare-option active'
                        : 'wshare-option'
                    }
                    onClick={() => setCard(item.id)}
                  >
                    <span>{item.emoji}</span>
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="wshare-label">
                02 / Формат изображения
              </div>

              <div className="wshare-options">
                <button
                  className={
                    format === 'story'
                      ? 'wshare-option active'
                      : 'wshare-option'
                  }
                  onClick={() => setFormat('story')}
                >
                  <Smartphone size={17} />
                  История
                </button>

                <button
                  className={
                    format === 'post'
                      ? 'wshare-option active'
                      : 'wshare-option'
                  }
                  onClick={() => setFormat('post')}
                >
                  <RectangleVertical size={17} />
                  Пост
                </button>

                <button
                  className={
                    format === 'square'
                      ? 'wshare-option active'
                      : 'wshare-option'
                  }
                  onClick={() => setFormat('square')}
                >
                  <Square size={17} />
                  Квадрат
                </button>
              </div>

              <div className="wshare-format-info">
                {FORMATS[format].width} × {FORMATS[format].height} px
                · PNG
              </div>
            </div>

            <div className="wshare-actions">
              <div className="wshare-label">
                03 / Поделись результатом
              </div>

              <button
                className="wshare-primary"
                onClick={download}
                disabled={busy || !imageBlob}
              >
                <ArrowDownToLine size={19} />
                Скачать PNG
              </button>

              <button
                className="wshare-secondary"
                onClick={nativeShare}
                disabled={busy || !imageBlob}
              >
                <Share2 size={19} />
                Поделиться изображением
              </button>

              {message && (
                <div className="wshare-message">
                  {message}
                </div>
              )}

              <div className="wshare-note">
                Изображение можно опубликовать в Telegram,
                MAX, ВКонтакте, Instagram или Discord.
                Доступность прямой отправки зависит от
                браузера и приложения.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
