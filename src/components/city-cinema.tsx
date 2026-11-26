'use client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ExternalLink, LocateFixed, MapPin, X } from 'lucide-react';
import { browserStorage } from '@/lib/browser-preferences';
import {
  CITY_CHOICES,
  CITY_STORAGE_KEY,
  normalizeCity,
  savedCity,
  nearbyCity,
  cinemaSearchUrl,
} from '@/lib/city-location';
let sessionCity: string | undefined;
function currentCity() {
  return sessionCity ?? savedCity(browserStorage.getItem(CITY_STORAGE_KEY));
}
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === CITY_STORAGE_KEY || event.key === null) {
      sessionCity = undefined;
      callback();
    }
  };
  window.addEventListener('mg-city', callback);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener('mg-city', callback);
    window.removeEventListener('storage', storage);
  };
}
export function useCity() {
  return useSyncExternalStore(subscribe, currentCity, () => '');
}
function changeCity(city: string, remember: boolean) {
  sessionCity = normalizeCity(city);
  browserStorage.setItem(
    CITY_STORAGE_KEY,
    JSON.stringify({ city: remember ? sessionCity : '' }),
  );
  window.dispatchEvent(new Event('mg-city'));
  return (
    !remember ||
    savedCity(browserStorage.getItem(CITY_STORAGE_KEY)) === sessionCity
  );
}
export function CityChooser({ en = false }: { en?: boolean }) {
  const city = useCity(),
    id = useId(),
    [draft, setDraft] = useState(city),
    [remember, setRemember] = useState(() =>
      Boolean(savedCity(browserStorage.getItem(CITY_STORAGE_KEY))),
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const locate = () => {
    if (busy) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setMessage(
        en
          ? 'Location is unavailable. Enter your city manually.'
          : 'Определение недоступно. Введи город вручную.',
      );
      return;
    }
    setBusy(true);
    setMessage(
      en
        ? 'Your browser will ask permission.'
        : 'Браузер запросит разрешение на геолокацию.',
    );
    const token = ++request.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request.current !== token) return;
        setBusy(false);
        const proposed = nearbyCity(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
        );
        if (proposed) {
          setDraft(proposed);
          setMessage(
            en
              ? 'Approximate city found offline. Confirm or correct it, then press Apply.'
              : 'Город определён приблизительно по локальному справочнику. Проверь или исправь его и нажми «Применить».',
          );
        } else
          setMessage(
            en
              ? 'No reliable city suggestion. Our offline index is limited; enter a city manually.'
              : 'Не удалось надёжно определить город: локальный справочник ограничен. Введи любой город вручную.',
          );
      },
      (error) => {
        if (request.current !== token) return;
        setBusy(false);
        setMessage(
          error.code === 1
            ? en
              ? 'Permission denied. Manual city selection still works.'
              : 'Доступ к геолокации запрещён. Город можно выбрать вручную.'
            : en
              ? 'Location could not be determined. Enter a city manually.'
              : 'Не удалось определить местоположение. Введи город вручную.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };
  return (
    <div className="city-chooser">
      <p className="city-help">
        {en
          ? 'City only — no background tracking. Browser coordinates are used locally, never sent to MovieMovie or stored.'
          : 'Только город, без фонового отслеживания. Координаты браузера обрабатываются на устройстве, не отправляются MovieMovie и не сохраняются.'}
      </p>
      <label htmlFor={id}>{en ? 'City' : 'Город'}</label>
      <div className="city-input-row">
        <input
          id={id}
          list={id + '-cities'}
          type="text"
          maxLength={80}
          value={draft}
          placeholder={en ? 'Enter any city' : 'Например, Каменск-Уральский'}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage('');
          }}
        />
        <button
          type="button"
          className="outline-btn"
          disabled={busy}
          onClick={() => {
            const value = normalizeCity(draft);
            if (!value) {
              setMessage(
                en
                  ? 'Enter a city name (2–80 characters).'
                  : 'Введи название города (2–80 символов).',
              );
              return;
            }
            const stored = changeCity(value, remember);
            setMessage(
              stored
                ? en
                  ? 'City applied.'
                  : 'Город выбран.'
                : en
                  ? 'City applied for this page only; browser storage is unavailable.'
                  : 'Город выбран до перезагрузки: браузер не разрешает запоминание.',
            );
          }}
        >
          {en ? 'Apply' : 'Применить'}
        </button>
      </div>
      <datalist id={id + '-cities'}>
        {CITY_CHOICES.map((item) => (
          <option key={item.name} value={item.name} />
        ))}
      </datalist>
      <label className="city-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        {en
          ? 'Remember after I press Apply'
          : 'Запомнить на этом устройстве после «Применить»'}
      </label>
      <div className="city-buttons">
        <button
          type="button"
          className="outline-btn"
          disabled={busy}
          onClick={locate}
        >
          <LocateFixed size={15} />
          {busy
            ? en
              ? 'Locating…'
              : 'Определяем…'
            : en
              ? 'Use my location'
              : 'Определить местоположение'}
        </button>
        {city && (
          <button
            type="button"
            className="outline-btn"
            onClick={() => {
              request.current++;
              setBusy(false);
              changeCity('', false);
              setDraft('');
              setRemember(false);
              setMessage(en ? 'City cleared.' : 'Город сброшен.');
            }}
          >
            <X size={14} />
            {en ? 'Clear city' : 'Сбросить город'}
          </button>
        )}
      </div>
      <p className="city-feedback" role="status" aria-live="polite">
        {message ||
          (en
            ? 'Without Remember, the city is kept only until page reload.'
            : 'Без запоминания город действует только до перезагрузки страницы.')}
      </p>
    </div>
  );
}
export default function CityCinema({ en = false }: { en?: boolean }) {
  const city = useCity(),
    url = cinemaSearchUrl(city);
  return (
    <details className="city-cinema">
      <summary>
        <MapPin size={17} />
        <span>
          {en ? 'Cinema near you' : 'Афиша кинотеатров'}
          <small>{city || (en ? 'Choose a city' : 'Выбрать город')}</small>
        </span>
      </summary>
      <div className="city-cinema-body">
        <CityChooser key={city} en={en} />
        {url && (
          <a
            className="outline-btn city-afisha-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            {en ? 'Find screenings in' : 'Найти сеансы в городе'} {city}
            <ExternalLink size={15} />
          </a>
        )}
        <p className="city-help">
          {en
            ? 'Current schedules open in an external search service. No live showtimes or ticket prices are loaded into MovieMovie yet. Check date, cinema and availability at the source.'
            : 'Откроется поиск актуальной афиши во внешнем сервисе. Живые сеансы и цены пока не загружаются в MovieMovie. Дату, кинотеатр и наличие билетов проверяй у источника.'}
        </p>
      </div>
    </details>
  );
}
export function CinemaSearchLink({ title }: { title: string }) {
  const city = useCity(),
    url = cinemaSearchUrl(city, title);
  return url ? (
    <a
      className="outline-btn"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      title="Поиск во внешнем сервисе, не подтверждение наличия сеансов"
    >
      <MapPin size={15} />
      Искать сеансы · {city}
      <ExternalLink size={14} />
    </a>
  ) : null;
}

export function CitySettings({ en = false }: { en?: boolean }) {
  const city = useCity();
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <MapPin size={18} />
        <div>
          <h3>{en ? 'City and cinema' : 'Город и кинотеатры'}</h3>
          <p>
            {city ||
              (en
                ? 'Optional, manual or by permission.'
                : 'Необязательно: вручную или с разрешения.')}
          </p>
        </div>
      </div>
      <CityChooser key={city} en={en} />
    </section>
  );
}
