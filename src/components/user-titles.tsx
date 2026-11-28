"use client";
import "./profile-identity.css";
import { useRef, useState } from "react";
import {
  Check,
  Crown,
  LockKeyhole,
  ArrowUpRight,
  EyeOff,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import {
  resolveUserTitle,
  type UserTitleCollection,
  type UserTitleDisplay,
} from "@/lib/user-titles";

import {
  titleStudioView,
  type TitleStudioFilter,
} from "@/lib/profile-identity";

export function UserTitleBadge({ title }: { title?: UserTitleDisplay | null }) {
  if (!title) return null;
  return (
    <span
      className="user-title-badge"
      data-tone={title.tone}
      title={title.description}
      aria-label={`Титул: ${title.name}`}
    >
      <span aria-hidden="true">{title.icon}</span>
      {title.name}
    </span>
  );
}

export default function UserTitleStudio({
  collection,
  username,
  action,
}: {
  collection?: UserTitleCollection | null;
  username: string;
  action: (
    payload: Record<string, unknown>,
    message?: string,
  ) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<TitleStudioFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const lastChoice = useRef<string | null>(null);
  if (!collection) return null;
  const view = titleStudioView(collection, filter);
  const automatic = resolveUserTitle(collection.options, null);
  const equip = async (titleId: string | null) => {
    if (pending.current) return;
    pending.current = true;
    lastChoice.current = titleId;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await action(
        { action: "titleEquip", titleId },
        titleId === "none" ? "Титул скрыт" : "Титул обновлён",
      );
      if (saved)
        setMessage(
          titleId === "none"
            ? "Титул скрыт. В профиле и комментариях останется только имя."
            : "Выбор сохранён. Титул обновлён в профиле и комментариях.",
        );
      else
        setError("Сохранение титула не подтверждено. Можно повторить попытку.");
    } catch {
      setError(
        "Не удалось сохранить титул. Проверь соединение и попробуй ещё раз.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      className="user-title-studio identity-titles"
      aria-label="Коллекция титулов"
      aria-busy={busy}
    >
      <header>
        <div>
          <span className="eyebrow">ЛИЧНАЯ КИНОСТУДИЯ / ТИТУЛЫ</span>
          <h2>
            Имя, за которым <em>твои истории.</em>
          </h2>
          <p>
            Не новая роль и не привилегия. Просто знак твоего пути в кино —
            рядом с именем.
          </p>
        </div>
        <span className="identity-title-count">
          <Crown size={18} />
          <b>
            {view.unlocked} / {view.total}
          </b>
          <small>открыто</small>
        </span>
      </header>
      <div className="identity-title-stage">
        <div className="user-title-preview">
          <span className="eyebrow">СЕЙЧАС В ТВОЁМ ПРОФИЛЕ</span>
          <div className="identity-title-person">
            <span className="user-title-avatar" aria-hidden="true">
              {[...username].slice(0, 2).join("").toUpperCase()}
            </span>
            <div>
              <b>{username}</b>
              {collection.active ? (
                <UserTitleBadge title={collection.active} />
              ) : (
                <small>Без титула</small>
              )}
            </div>
          </div>
          <p>
            {collection.equipped === null
              ? "Автоматический режим: самый высокий доступный зрительский титул."
              : collection.equipped === "none"
                ? "Титул скрыт. Достижения и открытые названия остаются с тобой."
                : "Выбран вручную. Можно сменить в любой момент."}
          </p>
        </div>
        <aside className="identity-next-title">
          <span className="eyebrow">ЗРИТЕЛЬСКИЙ ПУТЬ</span>
          {view.next ? (
            <>
              <h3>Следующая ступень</h3>
              <UserTitleBadge title={view.next} />
              <p>{view.next.description}</p>
              <span>
                {Math.min(view.next.progress, view.next.required)} /{" "}
                {view.next.required} разных материалов
              </span>
            </>
          ) : (
            <>
              <Sparkles size={24} />
              <h3>Все зрительские титулы открыты</h3>
              <p>
                Можно выбирать любимый или оставить автоматический режим.
                История продолжается без гонки за количеством.
              </p>
            </>
          )}
        </aside>
      </div>
      <div
        className="user-title-modes"
        role="group"
        aria-label="Режим отображения титула"
      >
        <button
          type="button"
          disabled={busy}
          aria-pressed={collection.equipped === null}
          onClick={() => void equip(null)}
        >
          <Sparkles size={18} />
          <b>Автоматически</b>
          <small>{automatic?.name || "Доступный зрительский титул"}</small>
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={collection.equipped === "none"}
          onClick={() => void equip("none")}
        >
          <EyeOff size={18} />
          <b>Без титула</b>
          <small>Только твой ник, без потери коллекции</small>
        </button>
      </div>
      {error && (
        <div className="identity-title-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="outline-btn small"
            disabled={busy}
            onClick={() => void equip(lastChoice.current)}
          >
            <RotateCcw size={14} />
            Повторить сохранение
          </button>
        </div>
      )}
      <p className="identity-title-status" role="status" aria-live="polite">
        {busy ? "Сохраняем выбор…" : message}
      </p>
      <div className="identity-title-library-heading">
        <div>
          <span className="eyebrow">КОЛЛЕКЦИЯ / БЕЗ СРОКА ДАВНОСТИ</span>
          <h3>Твои знаки отличия</h3>
        </div>
        <div
          className="identity-title-filters"
          role="group"
          aria-label="Фильтр титулов"
        >
          {(
            [
              ["all", "Все", view.total],
              ["unlocked", "Открытые", view.unlocked],
              ["locked", "Ещё впереди", view.locked],
            ] as const
          ).map(([id, label, count]) => (
            <button
              type="button"
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
      </div>
      {!view.options.length && (
        <div className="identity-title-empty">
          <Crown size={26} />
          <h3>В этой части коллекции пока пусто</h3>
          <p>Открытые титулы никуда не исчезают. Посмотри всю коллекцию.</p>
          <button
            className="outline-btn small"
            type="button"
            onClick={() => setFilter("all")}
          >
            Показать все титулы
          </button>
        </div>
      )}
      {["Зрительский путь", "Особые заслуги"].map((category) => {
        const options = view.options.filter(
          (option) => option.category === category,
        );
        if (!options.length) return null;
        return (
          <div key={category} className="user-title-category">
            <h3>
              {category}
              <small>{options.length}</small>
            </h3>
            <div className="user-title-grid">
              {options.map((option) => (
                <article
                  key={option.id}
                  className={`user-title-option ${option.unlocked ? "is-unlocked" : ""} ${collection.equipped === option.id ? "is-equipped" : ""}`}
                >
                  <span className="identity-title-card-state">
                    {option.unlocked ? (
                      <Check size={14} />
                    ) : (
                      <LockKeyhole size={14} />
                    )}{" "}
                    {option.earned
                      ? "В коллекции навсегда"
                      : option.unlocked
                        ? "Доступен для выбора"
                        : "Ещё впереди"}
                  </span>
                  <UserTitleBadge title={option} />
                  <p>{option.description}</p>
                  <div className="user-title-progress">
                    <span>
                      {option.earned
                        ? "Получен навсегда"
                        : option.unlocked
                          ? "Условие выполнено"
                          : `${Math.min(option.progress, option.required)} / ${option.required}`}
                    </span>
                    {collection.equipped === option.id && (
                      <b>
                        <Check size={12} />
                        Выбран
                      </b>
                    )}
                  </div>
                  <div
                    className="bar-track"
                    role="progressbar"
                    aria-label={`Прогресс: ${option.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      option.unlocked
                        ? 100
                        : Math.min(
                            100,
                            (option.progress / Math.max(1, option.required)) *
                              100,
                          ),
                    )}
                  >
                    <i
                      style={{
                        width: `${option.unlocked ? 100 : Math.min(100, (option.progress / Math.max(1, option.required)) * 100)}%`,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !option.unlocked ||
                      collection.equipped === option.id
                    }
                    onClick={() => void equip(option.id)}
                  >
                    {!option.unlocked ? (
                      <>
                        <LockKeyhole size={12} />
                        Пока закрыт
                      </>
                    ) : collection.equipped === option.id ? (
                      <>
                        <Check size={12} />
                        Активен
                      </>
                    ) : (
                      <>
                        Носить титул
                        <ArrowUpRight size={13} />
                      </>
                    )}
                  </button>
                </article>
              ))}
            </div>
          </div>
        );
      })}
      <details className="identity-title-rules">
        <summary>Как открываются и сохраняются титулы</summary>
        <p className="user-title-note">
          Доступный по старой истории титул закрепится после выбора или нового
          просмотра, оценки либо отзыва. Прогресс считается по разным
          материалам. Франшизы и фестивальные отметки заполняет редакция, а не
          поиск по названию. Закрытый титул нельзя выбрать через API.
        </p>
        <p className="user-title-note">
          Выбор не начисляет XP или попкорн. Титул возле имени и коронная ачивка
          на киновизитке — разные вещи: награда для визитки определяется по
          твоим достижениям и статистике редкости.
        </p>
      </details>
    </section>
  );
}
