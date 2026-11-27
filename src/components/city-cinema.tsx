"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LocateFixed, MapPin, X, ChevronDown, Ticket } from "lucide-react";
import { browserStorage } from "@/lib/browser-preferences";
import {
  CITY_CHOICES,
  CITY_STORAGE_KEY,
  normalizeCity,
  savedCity,
  nearbyCity,
  cinemaSearchUrl,
} from "@/lib/city-location";
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
  window.addEventListener("mg-city", callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("mg-city", callback);
    window.removeEventListener("storage", storage);
  };
}
export function useCity() {
  return useSyncExternalStore(subscribe, currentCity, () => "");
}
function changeCity(city: string, remember: boolean) {
  sessionCity = normalizeCity(city);
  browserStorage.setItem(
    CITY_STORAGE_KEY,
    JSON.stringify({ city: remember ? sessionCity : "" }),
  );
  window.dispatchEvent(new Event("mg-city"));
  return (
    !remember ||
    savedCity(browserStorage.getItem(CITY_STORAGE_KEY)) === sessionCity
  );
}
export function CityChooser({ en = false }: { en?: boolean }) {
  const city = useCity(),
    id = useId(),
    [draftState, setDraftState] = useState({ city, value: city }),
    [remember, setRemember] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    request = useRef(0),
    lookup = useRef<AbortController | null>(null);
  const draft = draftState.city === city ? draftState.value : city;
  const setDraft = (value: string) => setDraftState({ city, value });
  useEffect(
    () => () => {
      request.current++;
      lookup.current?.abort();
    },
    [],
  );
  const locate = () => {
    if (busy) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setMessage(
        en
          ? "Location is unavailable. Enter your city manually."
          : "Определение недоступно. Введи город вручную.",
      );
      return;
    }
    setBusy(true);
    setMessage(
      en
        ? "Your browser will ask permission."
        : "Браузер запросит разрешение на геолокацию.",
    );
    const token = ++request.current;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (request.current !== token) return;
        const controller = new AbortController();
        lookup.current?.abort();
        lookup.current = controller;
        try {
          const response = await fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: Number(position.coords.latitude.toFixed(2)),
              longitude: Number(position.coords.longitude.toFixed(2)),
              accuracy: position.coords.accuracy,
            }),
            signal: controller.signal,
          });
          const result = await response.json();
          if (request.current !== token) return;
          const proposed = normalizeCity(result.city);
          if (!response.ok || !proposed)
            throw new Error(result.error || "Не удалось определить город.");
          setDraft(proposed);
          setMessage(
            en
              ? `Suggested city: ${proposed}. Confirm with Apply.`
              : `Найден город: ${[proposed, normalizeCity(result.region), normalizeCity(result.country)].filter(Boolean).join(", ")}. Проверь и нажми «Применить».`,
          );
        } catch (error) {
          if (request.current !== token || controller.signal.aborted) return;
          const fallback = nearbyCity(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
          );
          if (fallback) setDraft(fallback);
          setMessage(
            (error instanceof Error
              ? error.message
              : "Не удалось связаться с геокодером.") +
              (fallback
                ? ` Доступна приблизительная локальная подсказка: ${fallback}. Проверь и подтверди город.`
                : " Можно ввести любой город вручную."),
          );
        } finally {
          if (request.current === token) setBusy(false);
        }
      },
      (error) => {
        if (request.current !== token) return;
        setBusy(false);
        setMessage(
          error.code === 1
            ? en
              ? "Permission denied. Manual city selection still works."
              : "Доступ к геолокации запрещён. Город можно выбрать вручную."
            : en
              ? "Location could not be determined. Enter a city manually."
              : "Не удалось определить местоположение. Введи город вручную.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };
  return (
    <div className="city-chooser">
      <p className="city-help">
        {en
          ? "Location is optional. Only after you press Locate, rounded coordinates are sent through moviemovie to OpenStreetMap / Nominatim to find the city. No background tracking; coordinates are not saved in your browser or our database."
          : "Геолокация необязательна. Только после нажатия «Определить» округлённые координаты передаются через moviemovie в OpenStreetMap / Nominatim для определения города. Без фонового отслеживания; координаты не сохраняются в браузере или нашей БД."}
      </p>
      <label htmlFor={id}>{en ? "City" : "Город"}</label>
      <div className="city-input-row">
        <input
          id={id}
          list={id + "-cities"}
          type="text"
          maxLength={80}
          value={draft}
          placeholder={en ? "Enter any city" : "Например, Каменск-Уральский"}
          onChange={(event) => {
            request.current++;
            lookup.current?.abort();
            setBusy(false);
            setDraft(event.target.value);
            setMessage("");
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
                  ? "Enter a city name (2–80 characters)."
                  : "Введи название города (2–80 символов).",
              );
              return;
            }
            const stored = changeCity(value, remember);
            setMessage(
              stored
                ? en
                  ? "City applied."
                  : "Город выбран."
                : en
                  ? "City applied for this page only; browser storage is unavailable."
                  : "Город выбран до перезагрузки: браузер не разрешает запоминание.",
            );
          }}
        >
          {en ? "Apply" : "Применить"}
        </button>
      </div>
      <datalist id={id + "-cities"}>
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
          ? "Remember after I press Apply"
          : "Запомнить на этом устройстве после «Применить»"}
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
              ? "Locating…"
              : "Определяем…"
            : en
              ? "Use my location"
              : "Определить местоположение"}
        </button>
        {city && (
          <button
            type="button"
            className="outline-btn"
            onClick={() => {
              request.current++;
              lookup.current?.abort();
              setBusy(false);
              changeCity("", false);
              setDraft("");
              setRemember(true);
              setMessage(en ? "City cleared." : "Город сброшен.");
            }}
          >
            <X size={14} />
            {en ? "Clear city" : "Сбросить город"}
          </button>
        )}
      </div>
      <p className="city-feedback" role="status" aria-live="polite">
        {message ||
          (en
            ? "The city is remembered on this device by default. Turn Remember off for this visit only."
            : "Город запоминается на этом устройстве по умолчанию. Сними галочку, если выбираешь только на этот визит.")}
      </p>
    </div>
  );
}
export function CitySettings({ en = false }: { en?: boolean }) {
  const city = useCity();
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <MapPin size={18} />
        <div>
          <h3>{en ? "City and cinema" : "Город и кинотеатры"}</h3>
          <p>
            {city ||
              (en
                ? "Optional, manual or by permission."
                : "Необязательно: вручную или с разрешения.")}
          </p>
        </div>
      </div>
      <CityChooser en={en} />
    </section>
  );
}

/** Sitewide city entry. No geolocation/provider requests until the user asks. */
export function HeaderLocation({
  en = false,
  go,
}: {
  en?: boolean;
  go: (url: string) => void;
}) {
  const city = useCity();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const showtimesHref = "/showtimes";
  useEffect(() => {
    if (!open) return;
    const element = dialog.current,
      previous = trigger.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <div className="location-bar">
      <button
        ref={trigger}
        type="button"
        className="header-city-button"
        aria-label={
          en
            ? `City: ${city || "Choose a city"}`
            : `Город: ${city || "Выбрать город"}`
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
      >
        <MapPin size={14} />
        <span>{city || (en ? "Choose a city" : "Выбрать город")}</span>
        <ChevronDown size={12} />
      </button>
      <a
        href={showtimesHref}
        className="header-showtimes-link"
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          go("/showtimes");
        }}
      >
        <Ticket size={14} />
        {en ? "Cinema showtimes" : "Афиша и сеансы"}
      </a>
      {open && (
        <dialog
          ref={dialog}
          id={id}
          className="city-dialog"
          aria-label={en ? "Your city" : "Ваш город"}
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const r = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < r.left ||
              event.clientX > r.right ||
              event.clientY < r.top ||
              event.clientY > r.bottom
            )
              setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not([disabled]),input:not([disabled]),a[href]",
              ),
            ].filter((node) => node.checkVisibility());
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
        >
          <header>
            <div>
              <span className="eyebrow">
                {en ? "CINEMA NEAR YOU" : "КИНО РЯДОМ"}
              </span>
              <h2>{en ? "Your city" : "Ваш город"}</h2>
            </div>
            <button
              type="button"
              autoFocus
              className="icon-button"
              aria-label={en ? "Close city selection" : "Закрыть выбор города"}
              onClick={() => setOpen(false)}
            >
              <X size={21} />
            </button>
          </header>
          <CityChooser en={en} />
          <footer>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              © OpenStreetMap contributors · Nominatim
            </a>
            <button
              type="button"
              className="primary-btn small"
              onClick={() => {
                setOpen(false);
                go("/showtimes");
              }}
            >
              {en ? "Showtimes" : "К афише"}
              <Ticket size={14} />
            </button>
          </footer>
        </dialog>
      )}
    </div>
  );
}
