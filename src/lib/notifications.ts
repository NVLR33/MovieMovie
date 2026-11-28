import { resolveSiteRoute } from "./site-routes";
export type HeaderNotice = {
  id: number;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};
export type NoticeKind =
  | "comment"
  | "friend"
  | "suggestion"
  | "recommendation"
  | "system";
/** Legacy notices have no typed event column. Classification is visual only. */
export function noticeKind(
  notice: Pick<HeaderNotice, "message" | "link">,
): NoticeKind {
  const text = notice.message.toLocaleLowerCase("ru");
  if (
    /предлож|отклон|принят.*материал/.test(text) ||
    notice.link?.startsWith("/admin")
  )
    return "suggestion";
  if (/рекоменду|поделил|recommend/.test(text)) return "recommendation";
  if (/комментар|ответил|comment|repl/.test(text)) return "comment";
  if (/друз|заявк|friend/.test(text) || notice.link === "/friends")
    return "friend";
  return "system";
}
/** Never navigate to schemes, protocol-relative or unknown paths from stored content. */
export function noticeHref(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\p{Cc}\p{Cf}]/u.test(value) ||
    value.length > 2048
  )
    return null;
  try {
    const url = new URL(value, "https://moviemovie.invalid");
    if (
      url.origin !== "https://moviemovie.invalid" ||
      !resolveSiteRoute(url.pathname)
    )
      return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
export function orderedNotices(notices: readonly HeaderNotice[]) {
  return [...notices].sort(
    (a, b) =>
      (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) ||
      b.id - a.id,
  );
}
export function noticeDay(
  date: string,
  now: Date,
): "today" | "yesterday" | "earlier" {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return "earlier";
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (key(value) === key(now)) return "today";
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  return key(value) === key(previous) ? "yesterday" : "earlier";
}
export function noticeTime(date: string, now: Date, en = false): string {
  const ms = Date.parse(date);
  if (!Number.isFinite(ms)) return en ? "Date unknown" : "Дата неизвестна";
  const seconds = Math.max(0, (now.getTime() - ms) / 1000);
  const locale = en ? "en" : "ru";
  if (seconds < 60) return en ? "Just now" : "Только что";
  if (seconds < 86400) {
    const unit = seconds < 3600 ? "minute" : "hour";
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -Math.floor(seconds / (unit === "minute" ? 60 : 3600)),
      unit,
    );
  }
  return new Date(ms).toLocaleDateString(en ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
    ...(new Date(ms).getFullYear() !== now.getFullYear()
      ? { year: "numeric" }
      : {}),
  });
}
