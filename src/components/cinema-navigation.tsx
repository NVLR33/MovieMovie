"use client";
import { trapDialogFocus } from "@/lib/dialog-focus";
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowUpRight, Compass, Library, Menu, Users, X } from "lucide-react";
import BrandLogo from "./brand-logo";
import type { ShellNavItem } from "./shell-navigation";
import { cinemaSpace } from "@/lib/cinema-spaces";

type Group = { label: string; items: ShellNavItem[] };
function follow(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  navigate: (url: string) => void,
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
  navigate(href);
}
export default function CinemaNavigation({
  page,
  groups,
  go,
  auth,
  signedIn,
  en = false,
}: {
  page: string;
  groups: Group[];
  go: (url: string) => void;
  auth: () => void;
  signedIn: boolean;
  en?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const space = cinemaSpace(page);
  const items = groups.flatMap((group) => group.items);
  const tabs = [
    {
      id: "discover",
      href: "/",
      label: en ? "Discover" : "Открывать",
      icon: Compass,
    },
    {
      id: "library",
      href: "/watchlist",
      label: en ? "My cinema" : "Моё кино",
      icon: Library,
    },
    {
      id: "together",
      href: "/collab",
      label: en ? "Together" : "Вместе",
      icon: Users,
    },
  ];
  const localIds =
    space === "discover"
      ? ["catalog", "top", "showtimes", "world"]
      : space === "library"
        ? ["watchlist", "favorites", "profile", "wrapped"]
        : ["collab", "friends", "watchroom", "games", "leaderboard"];
  const enter = (item: ShellNavItem) => {
    if (item.requiresAuth && !signedIn) auth();
    else go(item.url);
  };
  return (
    <>
      <div className="cinema-nav">
        <Link
          prefetch={false}
          className="cinema-brand"
          href="/"
          aria-label="moviemovie — на главную"
          onClick={(e) => follow(e, "/", go)}
        >
          <BrandLogo sizes="(max-width:760px) 108px,148px" priority />
        </Link>
        <nav
          className="cinema-spaces"
          aria-label={en ? "Cinema spaces" : "Пространства кино"}
        >
          {tabs.map((tab) => (
            <Link
              prefetch={false}
              key={tab.id}
              href={tab.href}
              data-active={space === tab.id}
              aria-current={space === tab.id ? "location" : undefined}
              onClick={(e) => follow(e, tab.href, go)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="cinema-explore"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={19} />
          <span>{en ? "All sections" : "Все разделы"}</span>
        </button>
      </div>
      <nav
        className="cinema-subnav"
        aria-label={en ? "In this space" : "В этом пространстве"}
      >
        {localIds
          .map((id) => items.find((item) => item.id === id))
          .filter((item): item is ShellNavItem => !!item)
          .map((item) => (
            <Link
              prefetch={false}
              key={item.id}
              href={item.url}
              aria-current={page === item.id ? "page" : undefined}
              onClick={(e) => follow(e, item.url, () => enter(item))}
            >
              {item.label}
              {!!item.count && (
                <small>{item.count > 99 ? "99+" : item.count}</small>
              )}
            </Link>
          ))}
      </nav>
      {open && (
        <NavigationDialog
          groups={groups}
          page={page}
          en={en}
          close={() => setOpen(false)}
          navigate={(item) => {
            setOpen(false);
            enter(item);
          }}
        />
      )}
    </>
  );
}
function NavigationDialog({
  groups,
  page,
  en,
  close,
  navigate,
}: {
  groups: Group[];
  page: string;
  en: boolean;
  close: () => void;
  navigate: (item: ShellNavItem) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="cinema-navigation-dialog"
      onKeyDown={trapDialogFocus}
      aria-labelledby="cinema-navigation-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <header>
        <div>
          <span className="eyebrow">
            moviemovie / {en ? "YOUR WAY IN" : "ТОЧКА ВХОДА"}
          </span>
          <h2 id="cinema-navigation-title">
            {en ? "A whole world of cinema." : "Целый мир кино."}
          </h2>
        </div>
        <button
          type="button"
          autoFocus
          aria-label={en ? "Close navigation" : "Закрыть навигацию"}
          onClick={close}
        >
          <X size={22} />
        </button>
      </header>
      <div className="cinema-navigation-groups">
        {groups.map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <h3>{group.label}</h3>
            {group.items.map((item) => (
              <Link
                prefetch={false}
                key={item.id}
                href={item.url}
                aria-current={
                  (page === "room" ? "watchroom" : page) === item.id
                    ? "page"
                    : undefined
                }
                onClick={(e) => follow(e, item.url, () => navigate(item))}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {!!item.count && <small>{item.count}</small>}
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <p className="cinema-navigation-note">
        {en
          ? "Discover stories. Keep your favorites close. Share the experience."
          : "Открывай истории. Собирай любимое. Разделяй впечатления."}
      </p>
    </dialog>
  );
}
