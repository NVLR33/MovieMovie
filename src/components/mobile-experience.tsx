'use client';
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type RefObject,
  type MouseEvent,
} from 'react';
import {
  Home,
  Clapperboard,
  Gamepad2,
  UserRound,
  Ellipsis,
  X,
  ChevronRight,
  Bookmark,
  Star,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  keyboardOccludesNavigation,
  mobileTabFor,
  MOBILE_BREAKPOINT,
} from '@/lib/mobile-experience';

type Destination = {
  id: string;
  label: string;
  url: string;
  icon: LucideIcon;
  count?: number;
  requiresAuth?: boolean;
};
function useMobileViewport() {
  useEffect(() => {
    const root = document.documentElement,
      viewport = window.visualViewport;
    let baseline = window.innerHeight,
      width = window.innerWidth,
      frame = 0;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      if (Math.abs(window.innerWidth - width) > 100) {
        baseline = window.innerHeight;
        width = window.innerWidth;
      }
      baseline = Math.max(baseline, window.innerHeight, height);
      const focused = document.activeElement;
      const editable =
        focused instanceof HTMLElement &&
        (focused.matches(
          'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,select',
        ) ||
          focused.isContentEditable);
      const hidden =
        window.innerWidth <= MOBILE_BREAKPOINT &&
        keyboardOccludesNavigation({
          baseline,
          height,
          editable,
          scale: viewport?.scale,
        });
      if (hidden) root.dataset.mobileKeyboard = 'open';
      else delete root.dataset.mobileKeyboard;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    viewport?.addEventListener('resize', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      delete root.dataset.mobileKeyboard;
    };
  }, []);
}
export function MobileSheet({
  title,
  eyebrow,
  close,
  children,
  className = '',
  restoreFocus,
}: {
  title: string;
  eyebrow?: string;
  close: () => void;
  children: ReactNode;
  className?: string;
  restoreFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!,
      previous =
        restoreFocus?.current || (document.activeElement as HTMLElement | null),
      overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const resized = () => {
      if (!media.matches) close();
    };
    media.addEventListener('change', resized);
    return () => {
      media.removeEventListener('change', resized);
      element.close();
      document.body.style.overflow = overflow;
      // Native dialog close queues a browser task which otherwise steals restored focus.
      window.setTimeout(() => {
        const target = previous;
        if (
          target?.isConnected &&
          !document.querySelector(
            'dialog[open], .modal-backdrop, [role=dialog]',
          )
        )
          target.focus({ preventScroll: true });
      });
    };
  }, [close, restoreFocus]);
  return (
    <dialog
      ref={ref}
      className={`mobile-sheet ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientY < rect.top ||
          event.clientY > rect.bottom ||
          event.clientX < rect.left ||
          event.clientX > rect.right
        )
          close();
      }}
    >
      <div className="mobile-sheet-grip" aria-hidden="true" />
      <header>
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <button type="button" aria-label="Закрыть панель" onClick={close}>
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function MobileNavigation({
  page,
  go,
  auth,
  signedIn,
  destinations,
  en,
}: {
  page: string;
  go: (url: string) => void;
  auth: () => void;
  signedIn: boolean;
  destinations: Destination[];
  en: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const trigger = useRef<HTMLButtonElement>(null);
  useMobileViewport();
  const selected = mobileTabFor(page);
  const primary: Destination[] = [
    { id: 'home', label: en ? 'Home' : 'Главная', url: '/', icon: Home },
    {
      id: 'catalog',
      label: en ? 'Catalogue' : 'Каталог',
      url: '/catalog',
      icon: Clapperboard,
    },
    {
      id: 'games',
      label: en ? 'Games' : 'Мини-игры',
      url: '/games',
      icon: Gamepad2,
    },
    {
      id: 'profile',
      label: en ? 'Profile' : 'Профиль',
      url: '/profile',
      icon: UserRound,
      requiresAuth: true,
    },
  ];
  const navigate = (
    event: MouseEvent<HTMLAnchorElement>,
    destination: Destination,
  ) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    close();
    if (destination.requiresAuth && !signedIn) {
      // Restore focus before opening another modal, not to an unmounted sheet link.
      trigger.current?.focus({ preventScroll: true });
      auth();
    } else go(destination.url);
  };
  return (
    <>
      <nav
        className="mobile-bottom-nav"
        aria-label={en ? 'Mobile navigation' : 'Мобильная навигация'}
      >
        {primary.map(({ icon: Icon, ...item }) => (
          <a
            key={item.id}
            href={item.url}
            aria-current={selected === item.id ? 'page' : undefined}
            onClick={(event) => navigate(event, { ...item, icon: Icon })}
          >
            <span className="mobile-tab-icon">
              <Icon size={21} />
            </span>
            <span>{item.label}</span>
          </a>
        ))}
        <button
          type="button"
          ref={trigger}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-current={selected === 'more' ? 'page' : undefined}
          onClick={() => setOpen(true)}
        >
          <span className="mobile-tab-icon">
            <Ellipsis size={23} />
          </span>
          <span>{en ? 'More' : 'Ещё'}</span>
        </button>
      </nav>
      {open && (
        <MobileSheet
          title={en ? 'More to explore' : 'Ещё в moviemovie'}
          eyebrow={en ? 'YOUR CINEMA UNIVERSE' : 'ТВОЯ КИНОВСЕЛЕННАЯ'}
          close={close}
          className="mobile-more-sheet"
          restoreFocus={trigger}
        >
          <nav className="mobile-more-links" aria-label="Все разделы сайта">
            {destinations
              .filter((item) => !['home', 'catalog', 'games'].includes(item.id))
              .map((item) => (
                <a
                  href={item.url}
                  key={item.id}
                  aria-current={page === item.id ? 'page' : undefined}
                  onClick={(event) => navigate(event, item)}
                >
                  <span className="mobile-more-icon">
                    <item.icon size={20} />
                  </span>
                  <span>{item.label}</span>
                  {!!item.count && (
                    <b>{item.count > 99 ? '99+' : item.count}</b>
                  )}
                  <ChevronRight size={16} />
                </a>
              ))}
          </nav>
          <button
            className="mobile-sheet-dismiss"
            type="button"
            onClick={close}
          >
            {en ? 'Done' : 'Готово'}
          </button>
        </MobileSheet>
      )}
    </>
  );
}
export function MobileMovieActions({
  title,
  rating,
  saved,
  bookmark,
  reviews,
  rate,
}: {
  title: string;
  rating: number;
  saved: boolean;
  bookmark: () => void;
  reviews: () => void;
  rate: () => void;
}) {
  return (
    <div
      className="mobile-movie-actions"
      role="group"
      aria-label={`Быстрые действия: ${title}`}
    >
      <button
        type="button"
        className="mobile-save-action"
        aria-label={
          saved ? 'Убрать из списка просмотра' : 'Добавить в список просмотра'
        }
        aria-pressed={saved}
        onClick={bookmark}
      >
        <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        className="mobile-rate-action"
        aria-haspopup="dialog"
        aria-label="Оценить материал"
        onClick={rate}
      >
        <Star size={18} fill={rating ? 'currentColor' : 'none'} />
        <span>{rating ? `Моя оценка ${rating}` : 'Оценить'}</span>
      </button>
      <button type="button" aria-haspopup="dialog" onClick={reviews}>
        <MessageCircle size={18} />
        <span>Отзывы</span>
      </button>
    </div>
  );
}
export function MobileRatingSheet({
  rating,
  title,
  save,
  close,
}: {
  rating: number;
  title: string;
  save: (value: number) => void;
  close: () => void;
}) {
  const [selected, setSelected] = useState(rating);
  const submitting = useRef(false);
  return (
    <MobileSheet
      title="Твоя оценка"
      eyebrow="КАЖДЫЙ БАЛЛ — ТВОЙ ГОЛОС"
      close={close}
      className="mobile-rating-sheet"
    >
      <p className="mobile-rating-title">{title}</p>
      <div
        className="mobile-rating-values"
        role="group"
        aria-label="Выберите оценку от 0.5 до 10"
      >
        {Array.from({ length: 20 }, (_, index) => (index + 1) / 2).map(
          (value) => (
            <button
              type="button"
              aria-pressed={selected === value}
              aria-label={`Выбрать ${value} из 10`}
              onClick={() => setSelected(value)}
              key={value}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <p className="mobile-rating-hint" aria-live="polite">
        {selected
          ? `${selected} из 10 · ${selected >= 9 ? 'Любовь с первого кадра' : selected >= 7 ? 'Хорошая история' : selected >= 5 ? 'Есть свои моменты' : 'Не моё кино'}`
          : 'Шаг 0,5 — без крошечных звёзд и случайных нажатий'}
      </p>
      <button
        type="button"
        className="primary-btn mobile-sheet-confirm"
        disabled={!selected}
        onClick={() => {
          if (submitting.current) return;
          submitting.current = true;
          save(selected);
          close();
        }}
      >
        Сохранить оценку
      </button>
    </MobileSheet>
  );
}
