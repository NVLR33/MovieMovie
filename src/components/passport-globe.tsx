'use client';
import { useMemo, useState, useId } from 'react';
import {
  geoCentroid,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoPermissibleObjects,
} from 'd3-geo';
import { ChevronLeft, ChevronRight, Globe2, MapPin } from 'lucide-react';
import geography from '@/data/world-globe.json';
import { allCountryCodes, countryName } from '@/lib/cinema-countries';
import type { PassportFilm } from '@/lib/cinema-passport';

export default function PassportGlobe({
  countries,
  unmapped,
  go,
}: {
  countries: Map<string, PassportFilm[]>;
  unmapped: number;
  go: (path: string) => void;
}) {
  const [longitude, setLongitude] = useState(-25),
    [selected, setSelected] = useState('');
  const id = useId().replace(/:/g, '');
  const projection = useMemo(
    () =>
      geoOrthographic()
        .translate([180, 170])
        .scale(149)
        .rotate([longitude, -18])
        .clipAngle(90),
    [longitude],
  );
  const path = useMemo(() => geoPath(projection).digits(1), [projection]);
  const codes = allCountryCodes().sort(
    (a, b) =>
      Number(countries.has(b)) - Number(countries.has(a)) ||
      countryName(a).localeCompare(countryName(b), 'ru'),
  );
  const pick = (code: string) => {
    setSelected(code);
    const country = geography.countries.find((c) => c.code === code);
    if (country) {
      const center = geoCentroid(country.geometry as GeoPermissibleObjects);
      setLongitude(-center[0]);
    }
  };
  const entries = selected ? (countries.get(selected) ?? []) : [];
  return (
    <div className="passport-globe-content">
      <div className="passport-globe-stage">
        <svg
          viewBox="0 0 360 340"
          className="passport-globe"
          role="img"
          aria-label={`Глобус кино: открыто стран ${countries.size}. Управление поворотом и выбор страны ниже.`}
        >
          <defs>
            <radialGradient id={id}>
              <stop stopColor="var(--passport-ocean-light)" />
              <stop offset="1" stopColor="var(--passport-ocean)" />
            </radialGradient>
          </defs>
          <circle cx="180" cy="170" r="159" className="passport-orbit" />
          <circle cx="180" cy="170" r="149" fill={`url(#${id})`} />
          <path
            d={path(geoGraticule10()) || ''}
            className="passport-graticule"
          />
          {geography.countries.map((country, i) => (
            <path
              key={country.code || i}
              d={path(country.geometry as GeoPermissibleObjects) || ''}
              data-country={country.code ?? undefined}
              className={`passport-country ${country.code && countries.has(country.code) ? 'is-visited' : ''} ${selected === country.code ? 'is-picked' : ''}`}
              onClick={() => country.code && pick(country.code)}
            >
              <title>
                {country.code
                  ? `${countryName(country.code)}: ${countries.get(country.code)?.length ?? 0} просмотрено`
                  : 'Территория без ISO-кода'}
              </title>
            </path>
          ))}
        </svg>
        <span className="passport-globe-coordinate" aria-hidden="true">
          ЛИЧНЫЙ АТЛАС / {Math.round(-longitude)}°
        </span>
        <div
          className="passport-globe-controls"
          role="group"
          aria-label="Поворот глобуса"
        >
          <button
            type="button"
            onClick={() => setLongitude((v) => v + 40)}
            aria-label="Повернуть глобус влево"
          >
            <ChevronLeft size={16} />
          </button>
          <Globe2 size={15} aria-hidden="true" />
          <button
            type="button"
            onClick={() => setLongitude((v) => v - 40)}
            aria-label="Повернуть глобус вправо"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="passport-geography-copy">
        <span className="passport-big-number">
          {countries.size.toLocaleString('ru-RU')}
          <small>стран открыто через кино</small>
        </span>
        <p>Каждая история — новый штамп в твоём кинопаспорте.</p>
        <label className="passport-country-label">
          <MapPin size={14} />
          Твои страны
          <select
            value={selected}
            onChange={(e) => pick(e.target.value)}
            aria-label="Страна в кинопаспорте"
          >
            <option value="">Выбери страну</option>
            {codes.map((code) => (
              <option key={code} value={code}>
                {countryName(code)} · {countries.get(code)?.length ?? 0}
              </option>
            ))}
          </select>
        </label>
        <div className="passport-country-detail" aria-live="polite">
          {selected ? (
            <>
              <b>{countryName(selected)}</b>
              {entries.length ? (
                <div>
                  {entries.slice(0, 2).map((film) => (
                    <button
                      type="button"
                      key={film.id}
                      onClick={() => go(`/movie/${film.id}`)}
                    >
                      {film.title}
                      <ChevronRight size={13} />
                    </button>
                  ))}
                  {entries.length > 2 && (
                    <small>И ещё {entries.length - 2} в полном атласе</small>
                  )}
                </div>
              ) : (
                <small>Ты ещё не смотрел кино этой страны.</small>
              )}
            </>
          ) : (
            <small>
              {countries.size
                ? 'Выбери страну на глобусе или в списке.'
                : 'Отметь первый просмотр — и на глобусе появится цвет.'}
            </small>
          )}
        </div>
        <button
          type="button"
          className="passport-text-link"
          onClick={() =>
            go(`/world?mode=watched${selected ? `&country=${selected}` : ''}`)
          }
        >
          Открыть полный атлас <ChevronRight size={14} />
        </button>
        <small className="passport-geography-note">
          Страны производства, не места съёмок. Копродукция отмечает несколько
          стран.{unmapped > 0 && ` Без определённой страны: ${unmapped}.`}
        </small>
      </div>
    </div>
  );
}
