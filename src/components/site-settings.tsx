'use client';
import {CitySettings} from './city-cinema';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  CircleOff,
  Snowflake,
  Flower2,
  Sun,
  Check,
  Globe2,
  Leaf,
  Lightbulb,
  Monitor,
  Palette,
  RotateCcw,
  Settings2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useAmbientPreference } from './ambient-canvas';
const themes = [
  { id: 'dark', ru: 'Тёмная', en: 'Dark' },
  { id: 'light', ru: 'Светлая', en: 'Light' },
  { id: 'pink', ru: 'Розовая', en: 'Pink' },
  { id: 'purple', ru: 'Фиолетовая', en: 'Purple' },
  { id: 'yellow', ru: 'Жёлтая', en: 'Yellow' },
];
const seasons = [
  { id: 'auto', icon: RotateCcw, ru: 'Автоматически', en: 'Automatic' },
  { id: 'off', icon: CircleOff, ru: 'Выключено', en: 'Off' },
  { id: 'winter', icon: Snowflake, ru: 'Зима', en: 'Winter' },
  { id: 'spring', icon: Flower2, ru: 'Весна', en: 'Spring' },
  { id: 'summer', icon: Sun, ru: 'Лето', en: 'Summer' },
  { id: 'autumn', icon: Leaf, ru: 'Осень', en: 'Autumn' },
];
function subscribeMotion(callback: () => void) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function Switch({
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const helpId = useId();
  return (
    <label
      className={`settings-switch-row ${disabled ? 'settings-inactive' : ''}`}
    >
      <span>
        <b>{label}</b>
        <small id={helpId}>{help}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-describedby={helpId}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="settings-switch-track" aria-hidden="true">
        <i>{checked && <Check size={11} />}</i>
      </span>
    </label>
  );
}
function Panel({
  children,
  title,
  close,
  trigger,
  en,
}: {
  children: ReactNode;
  title: string;
  close: () => void;
  trigger: { current: HTMLButtonElement | null };
  en: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current!,
      overflow = document.body.style.overflow;
    const target = trigger.current;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      let attempt = 0;
      const restore = () => {
        if (
          !target?.isConnected ||
          document.querySelector('dialog[open],.modal-backdrop,[role="dialog"]')
        )
          return;
        const active = document.activeElement;
        if (
          active &&
          active !== document.body &&
          active !== target &&
          !dialog.contains(active)
        )
          return;
        if (getComputedStyle(target).visibility === 'visible')
          target.focus({ preventScroll: true });
        if (document.activeElement !== target && attempt++ < 8)
          requestAnimationFrame(restore);
      };
      requestAnimationFrame(restore);
    };
  }, [trigger]);
  return createPortal(
    <dialog
      className="site-settings-dialog"
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          close();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const nodes = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),summary,a[href],[tabindex="0"]',
          ),
        ].filter((node) => node.getClientRects().length);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="settings-header">
        <div>
          <span className="eyebrow">
            MOVIEMOVIE / {en ? 'YOUR SPACE' : 'ТВОЁ ПРОСТРАНСТВО'}
          </span>
          <h2 id={titleId}>
            <Settings2 size={23} />
            {title}
          </h2>
          <p>
            {en
              ? 'Make the site feel right for you. Changes apply instantly.'
              : 'Настрой сайт под себя. Изменения видны сразу.'}
          </p>
        </div>
        <button
          type="button"
          className="settings-close"
          aria-label={en ? 'Close settings' : 'Закрыть настройки'}
          onClick={close}
          autoFocus
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
export default function SiteSettings({
  theme,
  lang,
  season,
  calendarSeason,
  animations,
  glow,
  signedIn,
  onTheme,
  onLang,
  onSeason,
  onAnimations,
  onGlow,
  onReset,
  onSync,
  onProfile,
  onOpen,
}: {
  theme: string;
  lang: string;
  season: string;
  calendarSeason: string;
  animations: boolean;
  glow: boolean;
  signedIn: boolean;
  onTheme: (value: string) => Promise<boolean>;
  onLang: (value: string) => Promise<boolean>;
  onSeason: (value: string) => void;
  onAnimations: (value: boolean) => void;
  onGlow: (value: boolean) => void;
  onReset: () => Promise<boolean>;
  onSync: () => Promise<boolean>;
  onProfile: () => void;
  onOpen?: () => void;
}) {
  const en = lang === 'en',
    [open, setOpen] = useState(false),
    [sync, setSync] = useState<'idle' | 'busy' | 'ok' | 'failed'>('idle');
  const trigger = useRef<HTMLButtonElement>(null),
    [ambient, setAmbient] = useAmbientPreference(),
    themeGroup = useId(),
    languageGroup = useId(),
    seasonGroup = useId();
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
  const run = async (job: () => Promise<boolean>) => {
    if (sync === 'busy') return;
    setSync('busy');
    try {
      setSync((await job()) ? 'ok' : 'failed');
    } catch {
      setSync('failed');
    }
  };
  const busy = sync === 'busy',
    seasonOff = season === 'off';
  const resolved = seasons.find((option) => option.id === calendarSeason);
  const close = () => setOpen(false);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="site-settings-trigger"
        aria-label={en ? 'Site settings' : 'Настройки сайта'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={en ? 'Theme, language and atmosphere' : 'Тема, язык и атмосфера'}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <Settings2 size={20} />
        <span>{en ? 'Settings' : 'Настройки'}</span>
      </button>
      {open && (
        <Panel
          title={en ? 'Site settings' : 'Настройки сайта'}
          close={close}
          trigger={trigger}
          en={en}
        >
          <div className="settings-body">
            <section className="settings-section">
              <div className="settings-section-heading">
                <Palette size={18} />
                <div>
                  <h3>{en ? 'Appearance' : 'Внешний вид'}</h3>
                  <p>
                    {en
                      ? 'Choose the colors and contrast of the interface.'
                      : 'Выбери цвета и контраст интерфейса.'}
                  </p>
                </div>
              </div>
              <fieldset className="settings-theme-grid">
                <legend className="settings-sr-only">
                  {en ? 'Site theme' : 'Тема сайта'}
                </legend>
                {themes.map((option) => (
                  <label
                    key={option.id}
                    className={`settings-theme-card settings-theme-${option.id}`}
                  >
                    <input
                      type="radio"
                      name={themeGroup}
                      aria-label={en ? option.en : option.ru}
                      checked={theme === option.id}
                      disabled={busy && theme !== option.id}
                      onChange={() => void run(() => onTheme(option.id))}
                    />
                    <span className="settings-theme-preview" aria-hidden="true">
                      <i />
                      <span>
                        <b />
                        <em />
                        <small />
                      </span>
                    </span>
                    <span className="settings-choice-name">
                      {en ? option.en : option.ru}
                      {theme === option.id && (
                        <Check size={13} aria-hidden="true" />
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>
            <section className="settings-section">
              <div className="settings-section-heading">
                <Globe2 size={18} />
                <div>
                  <h3>{en ? 'Interface language' : 'Язык интерфейса'}</h3>
                  <p>
                    {en
                      ? 'Core navigation and supported controls. Titles, descriptions and reviews are not translated.'
                      : 'Основная навигация и поддерживаемые элементы. Названия, описания и отзывы не переводятся.'}
                  </p>
                </div>
              </div>
              <fieldset className="settings-language-grid">
                <legend className="settings-sr-only">
                  {en ? 'Interface language' : 'Язык интерфейса'}
                </legend>
                {[
                  { id: 'ru', title: 'Русский', small: 'RU' },
                  { id: 'en', title: 'English', small: 'EN' },
                ].map((option) => (
                  <label className="settings-language-card" key={option.id}>
                    <input
                      type="radio"
                      name={languageGroup}
                      checked={lang === option.id}
                      disabled={busy && lang !== option.id}
                      aria-label={option.title}
                      onChange={() => void run(() => onLang(option.id))}
                    />
                    <b aria-hidden="true">{option.small}</b>
                    <span>{option.title}</span>
                    {lang === option.id && (
                      <Check size={15} aria-hidden="true" />
                    )}
                  </label>
                ))}
              </fieldset>
            </section>
            <section className="settings-section">
              <div className="settings-section-heading">
                <Leaf size={18} />
                <div>
                  <h3>{en ? 'Seasonal atmosphere' : 'Сезонная атмосфера'}</h3>
                  <p>
                    {en
                      ? 'Seasonal accents, particles and a soft glow around the site.'
                      : 'Сезонные акценты, частицы и мягкое свечение вокруг интерфейса.'}
                  </p>
                </div>
              </div>
              <fieldset className="settings-season-grid">
                <legend className="settings-sr-only">
                  {en ? 'Season mode' : 'Режим сезона'}
                </legend>
                {seasons.map((option) => (
                  <label
                    key={option.id}
                    className={`settings-season-card settings-season-${option.id}`}
                  >
                    <input
                      type="radio"
                      name={seasonGroup}
                      aria-label={en ? option.en : option.ru}
                      checked={season === option.id}
                      onChange={() => onSeason(option.id)}
                    />
                    <span aria-hidden="true">
                      <option.icon size={18} />
                    </span>
                    <b>{en ? option.en : option.ru}</b>
                    {season === option.id && (
                      <Check size={13} aria-hidden="true" />
                    )}
                  </label>
                ))}
              </fieldset>
              <p className="settings-context-note">
                {season === 'auto'
                  ? en
                    ? `Follows the calendar on your device. Current season: ${resolved?.en || calendarSeason}.`
                    : `Следует календарю на твоём устройстве. Сейчас — ${resolved?.ru.toLocaleLowerCase() || calendarSeason}.`
                  : seasonOff
                    ? en
                      ? 'Seasonal accents are off. The options below are remembered for next time.'
                      : 'Сезонные акценты выключены. Значения ниже сохранятся для следующего включения.'
                    : en
                      ? 'The selected season stays active regardless of the calendar.'
                      : 'Выбранный сезон действует независимо от календаря.'}
              </p>
              <Switch
                label={en ? 'Seasonal particles' : 'Сезонные частицы'}
                help={
                  reduced
                    ? en
                      ? 'Your system requests reduced motion. Particles stay off even when this preference is on.'
                      : 'Система просит уменьшить движение: частицы не появятся, даже если настройка включена.'
                    : en
                      ? 'Falling seasonal decorations. Does not control all site animations.'
                      : 'Движущиеся сезонные украшения. Не управляет всеми анимациями сайта.'
                }
                checked={animations}
                disabled={seasonOff}
                onChange={onAnimations}
              />
              <Switch
                label={en ? 'Seasonal glow' : 'Сезонное свечение'}
                help={
                  en
                    ? 'A soft seasonal light around the interface. Separate from poster colors.'
                    : 'Мягкая подсветка по сезону. Не связана с цветами постера фильма.'
                }
                checked={glow}
                disabled={seasonOff}
                onChange={onGlow}
              />
            </section>
            <section className="settings-section">
              <div className="settings-section-heading">
                <WandSparkles size={18} />
                <div>
                  <h3>{en ? 'Film atmosphere' : 'Атмосфера фильма'}</h3>
                  <p>
                    {en
                      ? 'Applies on a title page, not across every page of the site.'
                      : 'Работает на странице материала, а не на всех страницах сайта.'}
                  </p>
                </div>
              </div>
              <Switch
                label={en ? 'Film atmosphere' : 'Атмосфера фильма'}
                help={
                  en
                    ? 'Uses poster or backdrop colors for the page background and accents. Unavailable images and data saving may limit the effect.'
                    : 'Берёт цвета постера или фона для оформления страницы. Недоступные изображения и экономия трафика могут ограничить эффект.'
                }
                checked={ambient}
                onChange={setAmbient}
              />
            </section>
            <CitySettings en={en}/>
            <div className="settings-system-note">
              <Monitor size={17} />
              <span>
                {reduced
                  ? en
                    ? 'Reduced motion is active in your system. The site respects this preference.'
                    : 'В системе включено уменьшение движения. Сайт учитывает эту настройку.'
                  : en
                    ? 'You can reduce motion in your device accessibility settings.'
                    : 'Уменьшить движение можно в системных настройках универсального доступа.'}
              </span>
            </div>
            <div className="settings-storage-note">
              <Lightbulb size={16} />
              <p>
                {signedIn
                  ? en
                    ? 'Changes apply in this browser. Theme and language are also sent to your profile; seasonal and film effects stay local to this browser.'
                    : 'Изменения применяются в этом браузере. Тема и язык также отправляются в профиль; сезонные эффекты и атмосфера фильма остаются только в этом браузере.'
                  : en
                    ? 'Preferences are kept in this browser. Sign in to also save theme and language to your profile.'
                    : 'Настройки сохраняются в этом браузере. После входа тему и язык можно сохранить и в профиль.'}{' '}
                {en
                  ? 'If browser storage is blocked, changes work for the current page session.'
                  : 'Если хранилище браузера запрещено, изменения работают в текущем сеансе страницы.'}
              </p>
            </div>
            <p
              className={`settings-sync-status settings-sync-${sync}`}
              role="status"
            >
              {sync === 'busy'
                ? en
                  ? 'Applying settings…'
                  : 'Применяем настройки…'
                : sync === 'failed'
                  ? en
                    ? 'Applied in this browser, but profile sync failed. You can retry below.'
                    : 'В браузере применено, но профиль не синхронизирован. Можно повторить ниже.'
                  : sync === 'ok'
                    ? en
                      ? 'Settings applied.'
                      : 'Настройки применены.'
                    : en
                      ? 'No save button needed.'
                      : 'Нажимать «Сохранить» не нужно.'}
            </p>
            {sync === 'failed' && (
              <button
                type="button"
                className="outline-btn"
                onClick={() => void run(onSync)}
              >
                {en ? 'Retry profile sync' : 'Повторить синхронизацию профиля'}
              </button>
            )}
            <details className="settings-reset">
              <summary>
                <RotateCcw size={14} />
                {en ? 'Restore defaults' : 'Вернуть стандартное оформление'}
              </summary>
              <p>
                {en
                  ? 'Dark theme, Russian language, automatic season, particles, glow and film atmosphere on. Your profile decorations, ratings and watch history are not affected.'
                  : 'Тёмная тема, русский язык, автоматический сезон, частицы, свечение и атмосфера фильма включены. Украшения профиля, оценки и история не изменятся.'}
              </p>
              <button
                type="button"
                className="outline-btn"
                disabled={busy}
                onClick={() => {
                  setAmbient(true);
                  void run(onReset);
                }}
              >
                {en ? 'Restore these settings' : 'Восстановить эти настройки'}
              </button>
            </details>
          </div>
          <footer className="settings-footer">
            <button
              type="button"
              className="settings-profile-link"
              onClick={() => {
                close();
                onProfile();
              }}
            >
              {en ? 'Profile decorations' : 'Украшения профиля'}
              <ArrowUpRight size={14} />
            </button>
            <button type="button" className="primary-btn" onClick={close}>
              <Check size={15} />
              {en ? 'Done' : 'Готово'}
            </button>
          </footer>
        </Panel>
      )}
    </>
  );
}
