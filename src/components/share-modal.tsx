'use client';

import { useState } from 'react';
import {
  X,
  Link2,
  Check,
  Download,
  Share2,
  Send,
  Image as ImageIcon,
} from 'lucide-react';

export type ShareContent = {
  type: 'movie' | 'collection' | 'wrapped' | 'achievement' | 'profile';
  title: string;
  description?: string;
  url: string;
  image?: string;
  subtitle?: string;
};

type ShareCenterProps = {
  content: ShareContent;
  onClose: () => void;
};

const SOCIALS = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈',
    color: '#27A7E7',
  },
  {
    id: 'max',
    name: 'MAX',
    icon: 'M',
    color: '#685BFF',
  },
  {
    id: 'vk',
    name: 'ВКонтакте',
    icon: 'VK',
    color: '#0077FF',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '◎',
    color: '#E4405F',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '◈',
    color: '#5865F2',
  },
  {
    id: 'copy',
    name: 'Копировать',
    icon: '🔗',
    color: '#8B8BFF',
  },
] as const;

export default function ShareCenter({
  content,
  onClose,
}: ShareCenterProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  const shareUrl = content.url.startsWith('http')
    ? content.url
    : typeof window !== 'undefined'
      ? window.location.origin + content.url
      : content.url;

  const shareText = `${content.title} — moviemovie`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setMessage('Ссылка скопирована!');

      setTimeout(() => {
        setCopied(false);
        setMessage('');
      }, 2500);

      return true;
    } catch {
      setMessage('Не удалось скопировать ссылку');
      return false;
    }
  };

  const openSocial = async (id: string) => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(shareText);

    if (id === 'copy') {
      await copyLink();
      return;
    }

    if (id === 'telegram') {
      window.open(
        `https://t.me/share/url?url=${url}&text=${text}`,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    if (id === 'vk') {
      window.open(
        `https://vk.com/share.php?url=${url}`,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    // MAX, Instagram и Discord:
    // копируем ссылку и открываем приложение/сайт.
    const success = await copyLink();

    if (!success) return;

    const destinations: Record<string, string> = {
      max: 'https://max.ru/',
      instagram: 'https://www.instagram.com/',
      discord: 'https://discord.com/app',
    };

    const destination = destinations[id];

    if (destination) {
      window.open(destination, '_blank', 'noopener,noreferrer');
    }
  };

  const systemShare = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({
        title: content.title,
        text: content.description || shareText,
        url: shareUrl,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return;
      }

      setMessage('Не удалось открыть меню отправки');
    }
  };

  const exportPNG = async () => {
    setExporting(true);

    try {
      const canvas = document.createElement('canvas');

      canvas.width = 1080;
      canvas.height = 1350;

      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas unavailable');

      // Фон
      const gradient = ctx.createLinearGradient(
        0,
        0,
        1080,
        1350
      );

      gradient.addColorStop(0, '#171329');
      gradient.addColorStop(0.5, '#10121D');
      gradient.addColorStop(1, '#080A12');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1350);

      // Декоративное свечение
      const glow = ctx.createRadialGradient(
        540,
        300,
        0,
        540,
        300,
        650
      );

      glow.addColorStop(0, 'rgba(170,130,255,.25)');
      glow.addColorStop(1, 'rgba(170,130,255,0)');

      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 1080, 1350);

      // Брендинг
      ctx.textAlign = 'center';
      ctx.fillStyle = '#B7A2FF';
      ctx.font = '800 48px Arial';

      ctx.fillText('moviemovie', 540, 110);

      ctx.fillStyle = '#888CA8';
      ctx.font = '24px Arial';

      ctx.fillText(
        'ТВОЯ КИНОВСЕЛЕННАЯ',
        540,
        155
      );

      // Рамка контента
      ctx.strokeStyle = 'rgba(183,162,255,.35)';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.roundRect(90, 220, 900, 900, 36);
      ctx.stroke();

      // Тип карточки
      const typeLabels: Record<string, string> = {
        movie: '🎬 ФИЛЬМ',
        collection: '🎞 ПОДБОРКА',
        wrapped: '🏆 ИТОГИ КИНОГОДА',
        achievement: '⭐ ДОСТИЖЕНИЕ',
        profile: '👤 КИНОПРОФИЛЬ',
      };

      ctx.fillStyle = '#B7A2FF';
      ctx.font = '700 30px Arial';

      ctx.fillText(
        typeLabels[content.type] || 'MOVIEMOVIE',
        540,
        310
      );

      // Изображение
      if (content.image) {
        try {
          const img = new Image();

          img.crossOrigin = 'anonymous';

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();

            img.src = content.image!;
          });

          const maxWidth = 540;
          const maxHeight = 520;

          const scale = Math.min(
            maxWidth / img.width,
            maxHeight / img.height
          );

          const width = img.width * scale;
          const height = img.height * scale;

          ctx.drawImage(
            img,
            (1080 - width) / 2,
            365,
            width,
            height
          );
        } catch {
          // Если внешний сервер запрещает Canvas,
          // карточка сохранится без изображения.
        }
      }

      // Название
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 48px Arial';
      ctx.textAlign = 'center';

      const title = content.title.length > 32
        ? content.title.slice(0, 32) + '…'
        : content.title;

      ctx.fillText(title, 540, 975);

      // Подзаголовок
      if (content.subtitle) {
        ctx.fillStyle = '#C1B7E9';
        ctx.font = '28px Arial';

        ctx.fillText(
          content.subtitle.slice(0, 55),
          540,
          1035
        );
      }

      // Нижняя часть
      ctx.fillStyle = '#A5A8BC';
      ctx.font = '25px Arial';

      ctx.fillText(
        'Смотри. Оценивай. Делись.',
        540,
        1210
      );

      ctx.fillStyle = '#B7A2FF';
      ctx.font = '22px Arial';

      ctx.fillText(
        'moviemovie',
        540,
        1260
      );

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) throw new Error('PNG export failed');

      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `moviemovie-${content.type}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

      setMessage('Карточка PNG готова!');
    } catch {
      setMessage('Не удалось создать изображение');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="share-center-overlay"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="share-center-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Поделиться"
      >
        <div className="share-center-header">
          <div>
            <span className="share-center-kicker">
              MOVIEMOVIE SOCIAL
            </span>

            <h2>Поделиться</h2>
            <p>Расскажи друзьям о своей находке</p>
          </div>

          <button
            className="share-center-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="share-center-preview">
          {content.image ? (
            <img
              src={content.image}
              alt=""
              className="share-center-image"
            />
          ) : (
            <div className="share-center-placeholder">
              <ImageIcon size={30} />
            </div>
          )}

          <div className="share-center-preview-info">
            <span>moviemovie</span>
            <h3>{content.title}</h3>

            <p>
              {content.description ||
                content.subtitle ||
                'Твоя история. Твоё кино.'}
            </p>
          </div>
        </div>

        <div className="share-center-label">
          ОТПРАВИТЬ В СОЦСЕТЬ
        </div>

        <div className="share-center-socials">
          {SOCIALS.map(social => (
            <button
              key={social.id}
              className="share-center-social"
              onClick={() => openSocial(social.id)}
            >
              <span
                className="share-center-social-icon"
                style={{
                  background: social.color,
                }}
              >
                {social.id === 'copy' && copied
                  ? <Check size={23} />
                  : social.icon}
              </span>

              <span>{social.name}</span>
            </button>
          ))}
        </div>

        <div className="share-center-actions">
          <button
            className="share-center-download"
            onClick={exportPNG}
            disabled={exporting}
          >
            <Download size={18} />
            {exporting
              ? 'Создаём карточку...'
              : 'Скачать красивую карточку PNG'}
          </button>

          <button
            className="share-center-native"
            onClick={systemShare}
          >
            <Share2 size={18} />
            Поделиться через устройство
          </button>
        </div>

        <div className="share-center-url">
          <Link2 size={16} />

          <span>{shareUrl}</span>

          <button onClick={copyLink}>
            {copied ? <Check size={17} /> : <Send size={17} />}
          </button>
        </div>

        {message && (
          <div className="share-center-message">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
