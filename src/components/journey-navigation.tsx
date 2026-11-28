"use client";
import Link from "next/link";
import { ArrowUpRight, Globe2, Ticket } from "lucide-react";
export default function JourneyNavigation({
  active,
  en = false,
}: {
  active: "world" | "showtimes";
  en?: boolean;
}) {
  return (
    <nav
      className="journey-navigation"
      aria-label={en ? "Cinema destinations" : "Направления поиска"}
    >
      <div>
        {[
          {
            id: "world",
            icon: Globe2,
            ru: "Кино-карта мира",
            en: "Cinema atlas",
          },
          {
            id: "showtimes",
            icon: Ticket,
            ru: "Афиша и сеансы",
            en: "Local showtimes",
          },
        ].map((item) => (
          <Link
            prefetch={false}
            key={item.id}
            href={"/" + item.id}
            aria-current={active === item.id ? "page" : undefined}
          >
            <item.icon size={16} />
            {en ? item.en : item.ru}
          </Link>
        ))}
      </div>
      <Link prefetch={false} href="/catalog">
        {en ? "Catalog" : "В каталог"}
        <ArrowUpRight size={15} />
      </Link>
    </nav>
  );
}
