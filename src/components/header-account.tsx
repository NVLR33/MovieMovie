"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  BellOff,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Heart,
  Layers3,
  LogOut,
  MessageCircle,
  Search,
  Settings2,
  Shield,
  Star,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { experienceProgress } from "@/lib/hud-progress";
import { canAccessAdmin } from "@/lib/permissions";
import {
  noticeDay,
  noticeHref,
  noticeKind,
  noticeTime,
  orderedNotices,
  type HeaderNotice,
} from "@/lib/notifications";

type AccountUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  isEditor?: boolean;
  xp: number | null;
};
type Panel = "notifications" | "account" | null;
type Props = {
  user: AccountUser | null;
  notices: HeaderNotice[];
  open: Panel;
  onOpen: (value: Panel) => void;
  go: (href: string) => void;
  auth: () => void;
  action: (payload: Record<string, unknown>) => Promise<boolean>;
  logout: () => Promise<void>;
  settings: () => void;
  triggerAvatar: ReactNode;
  portrait: ReactNode;
  counts: { watchlist: number; favorites: number };
  en?: boolean;
};

function AccountDialog({
  title,
  trigger,
  close,
  children,
  kind,
}: {
  title: string;
  trigger: RefObject<HTMLButtonElement | null>;
  close: () => void;
  children: ReactNode;
  kind: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = trigger.current,
      overflow = document.body.style.overflow;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      el.style.setProperty(
        "--account-top",
        `${Math.min(Math.max(8, r.bottom + 12), Math.max(8, innerHeight - 200))}px`,
      );
      el.style.setProperty(
        "--account-right",
        `${Math.min(Math.max(12, innerWidth - r.right), Math.max(12, innerWidth - Math.min(430, innerWidth - 24) - 12))}px`,
      );
    };
    place();
    el.showModal();
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      el.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [trigger]);
  return createPortal(
    <dialog
      ref={ref}
      className={`header-account-dialog ${kind}`}
      aria-labelledby={id}
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
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const nodes = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === e.currentTarget)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <header className="account-panel-heading">
        <h2 id={id}>{title}</h2>
        <button
          autoFocus
          type="button"
          className="account-close"
          aria-label={
            title === "Notifications" || title === "Your account"
              ? "Close panel"
              : "Закрыть панель"
          }
          onClick={close}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
const noticeIcons = {
  comment: MessageCircle,
  friend: Users,
  suggestion: Clapperboard,
  recommendation: Heart,
  system: Bell,
};
function NotificationCenter({
  user,
  notices,
  action,
  go,
  auth,
  en = false,
}: Pick<Props, "user" | "notices" | "action" | "go" | "auth" | "en">) {
  const [filter, setFilter] = useState<"all" | "unread">("all"),
    [search, setSearch] = useState(""),
    [limit, setLimit] = useState(20),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(() => new Date());
  const pending = useRef(false),
    mounted = useRef(true),
    tools = useRef<HTMLDivElement>(null),
    searchId = useId();
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  const unread = notices.filter((n) => !n.read).length;
  const sorted = orderedNotices(notices).filter(
      (n) =>
        (filter === "all" || !n.read) &&
        (!search.trim() ||
          n.message
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase())),
    ),
    shown = sorted.slice(0, limit);
  const mutate = async (payload: Record<string, unknown>) => {
    if (pending.current) return false;
    const focused = document.activeElement as HTMLElement | null;
    pending.current = true;
    setBusy(true);
    setError("");
    let ok = false;
    try {
      ok = await action({ action: "notifyRead", ...payload });
    } catch {
      /* Network failures remain retryable. */
    }
    pending.current = false;
    if (mounted.current) {
      setBusy(false);
      if (!ok)
        setError(
          en
            ? "Could not update notifications. Please try again."
            : "Не удалось обновить уведомления. Попробуй ещё раз.",
        );
    }
    requestAnimationFrame(() => {
      if (!mounted.current || !tools.current) return;
      const active = document.activeElement;
      if (
        active !== document.body &&
        active !== tools.current.closest("dialog")
      )
        return;
      if (
        focused?.isConnected &&
        !(focused instanceof HTMLButtonElement && focused.disabled)
      )
        focused.focus();
      else
        tools.current
          .querySelector<HTMLElement>('.notice-filters [aria-pressed="true"]')
          ?.focus();
    });
    return ok;
  };
  if (!user)
    return (
      <div className="account-empty">
        <Bell size={28} />
        <h3>
          {en ? "Your movie world, in one place" : "Всё важное — в одном месте"}
        </h3>
        <p>
          {en
            ? "Sign in to see replies, friend requests and recommendations."
            : "Войди, чтобы видеть ответы, заявки в друзья и рекомендации."}
        </p>
        <button className="primary-btn" type="button" onClick={auth}>
          {en ? "Sign in" : "Войти"}
        </button>
      </div>
    );
  const labels = {
    today: en ? "Today" : "Сегодня",
    yesterday: en ? "Yesterday" : "Вчера",
    earlier: en ? "Earlier" : "Ранее",
  };
  return (
    <>
      <div ref={tools} className="notice-tools">
        <div className="notice-summary">
          <span>
            {unread
              ? en
                ? `${unread} unread`
                : `Непрочитанных: ${unread}`
              : en
                ? "You are all caught up"
                : "Всё прочитано"}
          </span>
          <button
            type="button"
            disabled={!unread || busy}
            onClick={() => void mutate({})}
          >
            <CheckCheck size={15} />
            {en ? "Read all" : "Прочитать всё"}
          </button>
        </div>
        <div
          className="notice-filters"
          role="group"
          aria-label={en ? "Notification filter" : "Фильтр уведомлений"}
        >
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              setLimit(20);
            }}
          >
            {en ? "All" : "Все"} <span>{notices.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={filter === "unread"}
            onClick={() => {
              setFilter("unread");
              setLimit(20);
            }}
          >
            {en ? "Unread" : "Непрочитанные"} <span>{unread}</span>
          </button>
        </div>
        {notices.length > 0 && (
          <label className="notice-search" htmlFor={searchId}>
            <Search size={16} />
            <input
              id={searchId}
              type="search"
              placeholder={
                en ? "Search notifications" : "Поиск по уведомлениям"
              }
              aria-label={en ? "Search notifications" : "Поиск по уведомлениям"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(20);
              }}
            />
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <div className="notice-scroll" aria-busy={busy}>
        {shown.length ? (
          <ul className="notice-list">
            {shown.map((n, index) => {
              const kind = noticeKind(n),
                Icon = noticeIcons[kind],
                href = noticeHref(n.link),
                day = noticeDay(n.createdAt, now),
                heading =
                  index === 0 ||
                  noticeDay(shown[index - 1].createdAt, now) !== day;
              const validDate = Number.isFinite(Date.parse(n.createdAt));
              return (
                <li key={n.id}>
                  {heading && (
                    <h3 className="notice-date-group">{labels[day]}</h3>
                  )}
                  <div
                    className={`notice-entry notice-${kind}${n.read ? "" : " is-unread"}`}
                  >
                    <span className="notice-event-icon" aria-hidden="true">
                      <Icon size={17} />
                    </span>
                    <div className="notice-entry-content">
                      <button
                        type="button"
                        className="notice-open"
                        disabled={!href || busy}
                        onClick={async () => {
                          if (!href) return;
                          if (!n.read && !(await mutate({ id: n.id }))) return;
                          go(href);
                        }}
                      >
                        {n.message}
                      </button>
                      <div className="notice-entry-meta">
                        <time
                          dateTime={validDate ? n.createdAt : undefined}
                          title={
                            validDate
                              ? new Date(n.createdAt).toLocaleString(
                                  en ? "en-GB" : "ru-RU",
                                )
                              : undefined
                          }
                        >
                          {noticeTime(n.createdAt, now, en)}
                        </time>
                        <span>
                          {n.read
                            ? en
                              ? "Read"
                              : "Прочитано"
                            : en
                              ? "New"
                              : "Новое"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="notice-state"
                      disabled={busy}
                      title={
                        n.read
                          ? en
                            ? "Mark unread"
                            : "Отметить непрочитанным"
                          : en
                            ? "Mark read"
                            : "Отметить прочитанным"
                      }
                      aria-label={`${n.read ? (en ? "Mark unread" : "Отметить непрочитанным") : en ? "Mark read" : "Отметить прочитанным"}: ${n.message}`}
                      onClick={() => void mutate({ id: n.id, read: !n.read })}
                    >
                      {n.read ? <Bell size={14} /> : <Check size={15} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="account-empty">
            <BellOff size={28} />
            <h3>
              {search.trim()
                ? en
                  ? "Nothing found"
                  : "Ничего не найдено"
                : filter === "unread"
                  ? en
                    ? "All caught up"
                    : "Всё прочитано"
                  : en
                    ? "Quiet for now"
                    : "Пока здесь тихо"}
            </h3>
            <p>
              {search.trim()
                ? en
                  ? "Try another word or clear the search."
                  : "Попробуй другое слово или очисти поиск."
                : filter === "unread"
                  ? en
                    ? "Replies and new events will appear here."
                    : "Новые ответы и события появятся здесь."
                  : en
                    ? "Replies, friend requests and recommendations will appear here."
                    : "Здесь появятся ответы, заявки в друзья и рекомендации."}
            </p>
            {(search || filter === "unread") && (
              <button
                className="outline-btn"
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                  setLimit(20);
                }}
              >
                {en ? "Show all" : "Показать все"}
              </button>
            )}
          </div>
        )}
        {sorted.length > limit && (
          <button
            className="notice-load-more"
            type="button"
            onClick={() => setLimit((n) => n + 20)}
          >
            {en ? "Show more" : "Показать ещё"} · {sorted.length - limit}
          </button>
        )}
      </div>
      <footer className="account-panel-footnote">
        {en
          ? "Opening this panel does not mark messages as read."
          : "Открытие панели не отмечает уведомления прочитанными."}
      </footer>
    </>
  );
}
function AccountMenu({
  user,
  portrait,
  counts,
  go,
  logout,
  settings,
  en = false,
}: Pick<
  Props,
  "user" | "portrait" | "counts" | "go" | "logout" | "settings" | "en"
>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  if (!user) return null;
  const progress = experienceProgress(user.xp),
    role =
      user.role === "admin"
        ? en
          ? "Administrator"
          : "Администратор"
        : user.role === "moderator"
          ? en
            ? "Moderator"
            : "Модератор"
          : user.isEditor
            ? en
              ? "Editor"
              : "Редактор"
            : user.role === "vip"
              ? "VIP"
              : en
                ? "Member"
                : "Участник";
  const links = [
    {
      href: "/profile",
      label: en ? "My profile" : "Мой профиль",
      Icon: UserRound,
    },
    {
      href: "/watchlist",
      label: en ? "Watch later" : "Буду смотреть",
      Icon: Bookmark,
      count: counts.watchlist,
    },
    {
      href: "/favorites",
      label: en ? "Favorites" : "Любимое",
      Icon: Heart,
      count: counts.favorites,
    },
    { href: "/friends", label: en ? "Friends" : "Друзья", Icon: Users },
    {
      href: "/achievements",
      label: en ? "Achievements" : "Достижения",
      Icon: Trophy,
    },
    { href: "/collab", label: en ? "Collections" : "Подборки", Icon: Layers3 },
    ...(canAccessAdmin(user)
      ? [
          {
            href: "/admin",
            label: en ? "Control center" : "Центр управления",
            Icon: Shield,
          },
        ]
      : []),
  ];
  return (
    <div className="account-menu-scroll">
      <div className="account-identity">
        {portrait}
        <div>
          <strong title={user.username}>{user.username}</strong>
          <span className="account-role">{role}</span>
          <small title={user.email}>{user.email}</small>
        </div>
      </div>
      <div className="account-progression">
        <div>
          <b>
            <Star size={14} />
            {en ? "Level" : "Уровень"} {progress.level}
          </b>
          <span>
            {progress.total.toLocaleString(en ? "en-US" : "ru-RU")} XP
          </span>
        </div>
        <progress
          value={progress.current}
          max={500}
          aria-label={
            en ? "Progress to the next level" : "Прогресс до следующего уровня"
          }
        />
        <small>
          {en
            ? `${progress.remaining} XP to level ${progress.level + 1}`
            : `До ${progress.level + 1} уровня — ${progress.remaining} XP`}
        </small>
      </div>
      <nav
        className="account-links"
        aria-label={en ? "Account navigation" : "Навигация пользователя"}
      >
        {links.map(({ href, label, Icon, count }) => (
          <a
            href={href}
            key={href}
            onClick={(e) => {
              if (
                e.button !== 0 ||
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey
              )
                return;
              e.preventDefault();
              go(href);
            }}
          >
            <Icon size={17} />
            <span>{label}</span>
            {count !== undefined && <b>{count}</b>}
            <ChevronRight size={14} />
          </a>
        ))}
        <button type="button" onClick={settings}>
          <Settings2 size={17} />
          <span>{en ? "Site settings" : "Настройки сайта"}</span>
          <ChevronRight size={14} />
        </button>
      </nav>
      <div className="account-logout">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setError("");
            try {
              await logout();
            } catch {
              pending.current = false;
              setBusy(false);
              setError(
                en
                  ? "Could not sign out. Try again."
                  : "Не удалось выйти. Попробуй ещё раз.",
              );
            }
          }}
        >
          <LogOut size={17} />
          {busy
            ? en
              ? "Signing out…"
              : "Выходим…"
            : en
              ? "Sign out"
              : "Выйти из аккаунта"}
        </button>
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
export default function HeaderAccount(props: Props) {
  const { user, notices, open, onOpen, triggerAvatar, en = false } = props,
    noticeRef = useRef<HTMLButtonElement>(null),
    userRef = useRef<HTMLButtonElement>(null),
    id = useId();
  const unread = user ? notices.filter((n) => !n.read).length : 0;
  return (
    <>
      <button
        ref={noticeRef}
        type="button"
        className="icon-button notice-button"
        aria-label={
          en
            ? `Notifications${unread ? `, ${unread} unread` : ""}`
            : `Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`
        }
        aria-haspopup="dialog"
        aria-expanded={open === "notifications"}
        aria-controls={open === "notifications" ? id : undefined}
        onClick={() =>
          onOpen(open === "notifications" ? null : "notifications")
        }
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="notice-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <span className="top-divider" />
      <button
        ref={userRef}
        type="button"
        className="user-trigger"
        aria-label={
          user
            ? en
              ? "Open account menu"
              : "Открыть меню пользователя"
            : en
              ? "Sign in"
              : "Войти"
        }
        aria-haspopup={user ? "dialog" : undefined}
        aria-expanded={user ? open === "account" : undefined}
        onClick={() =>
          user ? onOpen(open === "account" ? null : "account") : props.auth()
        }
      >
        {triggerAvatar}
        <span className="user-trigger-name">
          {user?.username || (en ? "Sign in" : "Войти")}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <AccountDialog
          key={open}
          title={
            open === "notifications"
              ? en
                ? "Notifications"
                : "Уведомления"
              : en
                ? "Your account"
                : "Твой аккаунт"
          }
          trigger={open === "notifications" ? noticeRef : userRef}
          close={() => onOpen(null)}
          kind={open === "notifications" ? "notifications" : "user-pop"}
        >
          <div id={id} className="account-panel-content">
            {open === "notifications" ? (
              <NotificationCenter
                {...props}
                auth={() => {
                  onOpen(null);
                  props.auth();
                }}
              />
            ) : (
              <AccountMenu {...props} />
            )}
          </div>
        </AccountDialog>
      )}
    </>
  );
}
