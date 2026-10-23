'use client';

import { useState } from 'react';
import {
  FaTelegramPlane,
  FaVk,
  FaInstagram,
  FaDiscord,
} from 'react-icons/fa';

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
    icon: <FaTelegramPlane size={25} />,
    color: '#27A7E7',
  },
  {
    id: 'max',
    name: 'MAX',
    icon: <span className="max-logo">M</span>,
    color: '#685BFF',
  },
  {
    id: 'vk',
    name: 'ВКонтакте',
    icon: <FaVk size={25} />,
    color: '#0077FF',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: <FaInstagram size={25} />,
    color: '#E4405F',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: <FaDiscord size={25} />,
    color: '#5865F2',
  },
  {
    id: 'copy',
    name: 'Копировать',
    icon: <Link2 size={24} />,
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
  if (exporting) return;

  setExporting(true);
  setMessage('');

  try {
    const canvas = document.createElement('canvas');

    canvas.width = 1080;
    canvas.height = 1350;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas unavailable');
    }

    const W = canvas.width;
    const H = canvas.height;

    // Фоновый градиент
    const background = ctx.createLinearGradient(0, 0, W, H);

    background.addColorStop(0, '#18112D');
    background.addColorStop(0.48, '#111321');
    background.addColorStop(1, '#070911');

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);

    // Атмосферное свечение
    const glow = ctx.createRadialGradient(
      540, 360, 0,
      540, 360, 720
    );

    glow.addColorStop(0, 'rgba(174,136,255,.23)');
    glow.addColorStop(1, 'rgba(174,136,255,0)');

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Верхняя декоративная линия
    const line = ctx.createLinearGradient(90, 0, 990, 0);

    line.addColorStop(0, 'transparent');
    line.addColorStop(0.5, '#B49AFF');
    line.addColorStop(1, 'transparent');

    ctx.fillStyle = line;
    ctx.fillRect(90, 45, 900, 3);

    // Брендинг
    ctx.textAlign = 'center';

    ctx.fillStyle = '#B7A2FF';
    ctx.font = '900 48px Arial';

    ctx.fillText('moviemovie', 540, 125);

    ctx.fillStyle = '#858AA6';
    ctx.font = '700 20px Arial';

    ctx.fillText('ТВОЯ КИНОВСЕЛЕННАЯ', 540, 168);

    // Постер
    let posterLoaded = false;

    if (content.image) {
      try {
        const img = new Image();

        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = content.image!;
        });

        // Большой постер в центре
        const posterX = 270;
        const posterY = 225;
        const posterW = 540;
        const posterH = 720;

        ctx.save();

        ctx.beginPath();
        ctx.roundRect(
          posterX,
          posterY,
          posterW,
          posterH,
          26
        );

        ctx.clip();

        const scale = Math.max(
          posterW / img.width,
          posterH / img.height
        );

        const drawW = img.width * scale;
        const drawH = img.height * scale;

        ctx.drawImage(
          img,
          posterX + (posterW - drawW) / 2,
          posterY + (posterH - drawH) / 2,
          drawW,
          drawH
        );

        ctx.restore();

        posterLoaded = true;
      } catch {
        posterLoaded = false;
      }
    }

    // Заглушка, если постер недоступен
    if (!posterLoaded) {
      ctx.fillStyle = '#242039';

      ctx.beginPath();
      ctx.roundRect(270, 225, 540, 720, 26);
      ctx.fill();

      ctx.fillStyle = '#A990FF';
      ctx.font = '900 100px Arial';
      ctx.textAlign = 'center';

      ctx.fillText('M', 540, 600);
    }

    // Рамка постера
    ctx.strokeStyle = 'rgba(183,162,255,.45)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(270, 225, 540, 720, 26);
    ctx.stroke();

    // Название
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 48px Arial';
    ctx.textAlign = 'center';

    const title =
      content.title.length > 34
        ? content.title.slice(0, 34) + '…'
        : content.title;

    ctx.fillText(title, 540, 1040);

    // Дополнительная информация
    ctx.fillStyle = '#BEB4DD';
    ctx.font = '28px Arial';

    const subtitle = content.subtitle || '';

    ctx.fillText(
      subtitle.slice(0, 60),
      540,
      1100
    );

    // Подпись
    ctx.fillStyle = '#9295AA';
    ctx.font = '24px Arial';

    ctx.fillText(
      'Смотри. Оценивай. Делись.',
      540,
      1195
    );

    // Ссылка на платформу
    ctx.fillStyle = '#B7A2FF';
    ctx.font = '700 25px Arial';

    ctx.fillText(
      'moviemovie',
      540,
      1250
    );

    // Экспорт
    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });

    if (!blob) {
      throw new Error('PNG export failed');
    }

    const downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = downloadUrl;
    link.download = `moviemovie-${content.type}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 2000);

    setMessage('Красивая карточка сохранена!');
  } catch {
    setMessage('Не удалось создать PNG-карточку');
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
