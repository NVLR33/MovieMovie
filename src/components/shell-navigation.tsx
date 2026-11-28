"use client";
import { useSyncExternalStore, type MouseEvent } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Shuffle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import BrandLogo from "./brand-logo";
import { browserStorage } from "@/lib/browser-preferences";
import {
  SIDEBAR_LAYOUT_KEY,
  sidebarIsCompact,
  sidebarLayout,
  type SidebarLayout,
} from "@/lib/navigation-preference";
let sessionLayout: SidebarLayout | undefined;
function subscribeLayout(callback: () => void) {
  const storage = (e: StorageEvent) => {
    if (e.key === SIDEBAR_LAYOUT_KEY || e.key === null) {
      sessionLayout = undefined;
      callback();
    }
  };
  window.addEventListener("storage", storage);
  window.addEventListener("mg-sidebar-layout", callback);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("mg-sidebar-layout", callback);
  };
}
function subscribeSize(callback: () => void) {
  const mq = matchMedia("(max-width:1050px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
export function useSidebarLayout() {
  const layout = useSyncExternalStore(
    subscribeLayout,
    () =>
      sessionLayout ??
      sidebarLayout(browserStorage.getItem(SIDEBAR_LAYOUT_KEY)),
    () => "auto" as SidebarLayout,
  );
  const narrow = useSyncExternalStore(
    subscribeSize,
    () => matchMedia("(max-width:1050px)").matches,
    () => false,
  );
  const setLayout = (next: SidebarLayout) => {
    sessionLayout = next;
    browserStorage.setItem(SIDEBAR_LAYOUT_KEY, next);
    window.dispatchEvent(new Event("mg-sidebar-layout"));
    return browserStorage.getItem(SIDEBAR_LAYOUT_KEY) === next;
  };
  return { layout, compact: sidebarIsCompact(layout, narrow), setLayout };
}
export type ShellNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  url: string;
  count?: number;
  requiresAuth?: boolean;
};
type NavGroup = { label: string; items: ShellNavItem[] };
export function AppSidebar({
  groups,
  active,
  signedIn,
  go,
  auth,
  roulette,
  en = false,
  live,
  layout,
  compact,
  onLayout,
}: {
  groups: NavGroup[];
  active: string;
  signedIn: boolean;
  go: (href: string) => void;
  auth: () => void;
  roulette: () => void;
  en?: boolean;
  live: boolean;
  layout: SidebarLayout;
  compact: boolean;
  onLayout: (next: SidebarLayout) => void;
}) {
  return (
    <aside
      className="sidebar"
      aria-label={en ? "Primary navigation" : "Основная навигация"}
    >
      <button
        type="button"
        className="side-brand"
        onClick={() => go("/")}
        aria-label="moviemovie — на главную"
      >
        <BrandLogo sizes="(max-width:1050px) 48px,160px" priority />
      </button>
      <div className="side-scroll" id="sidebar-links">
        {groups.map((group) => (
          <div className="shell-nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            <nav className="nav-list" aria-label={group.label}>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`nav-item ${active === item.id ? "active" : ""}`}
                  aria-label={item.label}
                  aria-current={active === item.id ? "page" : undefined}
                  title={`${item.label}${item.count ? ` · ${item.count}` : ""}`}
                  onClick={() =>
                    item.requiresAuth && !signedIn ? auth() : go(item.url)
                  }
                >
                  <item.icon size={19} aria-hidden="true" />
                  <span className="nav-label">{item.label}</span>
                  {!!item.count && (
                    <small
                      className="nav-count"
                      aria-label={
                        en ? `${item.count} items` : `Количество: ${item.count}`
                      }
                    >
                      {item.count > 99 ? "99+" : item.count}
                    </small>
                  )}
                </button>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebar-discover">
          <span className="discover-icon" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <h4>{en ? "Your next movie night" : "Твой следующий киновечер"}</h4>
          <p>
            {en
              ? "Let the cinema universe surprise you."
              : "Доверь выбор киновселенной."}
          </p>
          <button
            type="button"
            onClick={roulette}
            title={en ? "Choose a random film" : "Подобрать случайный фильм"}
            aria-label={en ? "Spin roulette" : "Крутить рулетку"}
          >
            <Shuffle size={17} />
            <span>{en ? "Random film" : "Случайный фильм"}</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-layout-controls">
          <button
            type="button"
            className="sidebar-toggle"
            aria-controls="sidebar-links"
            aria-expanded={!compact}
            title={
              compact
                ? en
                  ? "Expand sidebar"
                  : "Развернуть меню"
                : en
                  ? "Collapse sidebar"
                  : "Свернуть меню"
            }
            aria-label={
              compact
                ? en
                  ? "Expand sidebar"
                  : "Развернуть меню"
                : en
                  ? "Collapse sidebar"
                  : "Свернуть меню"
            }
            onClick={() => onLayout(compact ? "expanded" : "collapsed")}
          >
            {compact ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span>{en ? "Collapse menu" : "Свернуть меню"}</span>
          </button>
          <button
            type="button"
            className="sidebar-auto"
            aria-label={
              en ? "Automatic sidebar width" : "Автоматическая ширина меню"
            }
            aria-pressed={layout === "auto"}
            title={
              en
                ? "Fit the screen automatically"
                : "Подстраиваться под ширину экрана"
            }
            onClick={() => onLayout("auto")}
          >
            {en ? "Auto" : "Авто"}
          </button>
        </div>
        <div
          className={`side-status ${live ? "is-live" : "is-reconnecting"}`}
          title={
            live
              ? en
                ? "Live updates connected"
                : "Живые обновления подключены"
              : en
                ? "Reconnecting; fallback refresh is enabled"
                : "Переподключение; резервное обновление включено"
          }
        >
          <span className="status-dot" />
          <span>
            {live
              ? en
                ? "Live updates"
                : "Живые обновления"
              : en
                ? "Reconnecting…"
                : "Переподключение…"}
          </span>
        </div>
      </div>
    </aside>
  );
}
function localClick(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  go: (href: string) => void,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  go(href);
}
export function SiteFooter({
  go,
  en = false,
  onTop,
}: {
  go: (href: string) => void;
  en?: boolean;
  onTop: () => void;
}) {
  const groups = [
    {
      title: en ? "Discover cinema" : "Открывай кино",
      links: [
        { url: "/catalog", label: en ? "Catalog" : "Каталог" },
        { url: "/top", label: en ? "Best titles" : "Лучшие материалы" },
        {
          url: "/showtimes",
          label: en ? "Cinema showtimes" : "Афиша и сеансы",
        },
        { url: "/world", label: en ? "Cinema atlas" : "Кино-карта мира" },
      ],
    },
    {
      title: en ? "Better together" : "Вместе интереснее",
      links: [
        {
          url: "/collab",
          label: en ? "Community collections" : "Подборки сообщества",
        },
        { url: "/games", label: en ? "Mini-games" : "Мини-игры" },
        { url: "/leaderboard", label: en ? "Leaderboard" : "Таблица лидеров" },
      ],
    },
  ];
  return (
    <footer
      className="footer shell-footer"
      aria-label={en ? "Site footer" : "Нижняя навигация"}
    >
      <div className="shell-footer-main">
        <div className="shell-footer-brand">
          <button
            type="button"
            className="footer-logo"
            onClick={() => go("/")}
            aria-label="moviemovie — на главную"
          >
            <BrandLogo sizes="140px" />
          </button>
          <p>
            {en
              ? "Your story. Your cinema. Your universe."
              : "Твоя история. Твоё кино. Твоя вселенная."}
          </p>
          <span>
            {en
              ? "Discover, save and share the stories you love."
              : "Открывай новое, сохраняй любимое и делись впечатлениями."}
          </span>
        </div>
        {groups.map((group) => (
          <nav
            key={group.title}
            className="shell-footer-links"
            aria-label={group.title}
          >
            <h2>{group.title}</h2>
            {group.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                onClick={(e) => localClick(e, link.url, go)}
              >
                {link.label}
                <ChevronRight size={13} aria-hidden="true" />
              </a>
            ))}
          </nav>
        ))}
      </div>
      <div className="shell-footer-bottom">
        <small>© {new Date().getUTCFullYear()} moviemovie</small>
        <span>
          {en ? "Made with love for cinema" : "Сделано с любовью к кино"}
        </span>
        <button type="button" className="shell-back-top" onClick={onTop}>
          {en ? "Back to top" : "Наверх"}
          <ArrowUp size={15} />
        </button>
      </div>
    </footer>
  );
}
