import { cachedShowtimes, ShowtimesInputError } from "@/lib/showtimes";
import { normalizeCity } from "@/lib/city-location";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  const params = new URL(request.url).searchParams,
    city = normalizeCity(params.get("city")),
    date = params.get("date") || "";
  if (!city || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)))
    return Response.json(
      { error: "Некорректный город или дата." },
      { status: 400, headers },
    );
  try {
    return Response.json(await cachedShowtimes(city, date), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ShowtimesInputError
            ? error.message
            : "Источник афиши временно недоступен. Попробуй позже или открой внешний поиск.",
      },
      { status: error instanceof ShowtimesInputError ? 400 : 502, headers },
    );
  }
}
