import { readJsonObject, RequestError } from "@/lib/request-validation";
import { reverseGeocode, validCoordinates } from "@/lib/geolocation";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Public Nominatim policy: at most one request/second per app instance, no autocomplete.
// Multi-instance/high-traffic deployments need a shared quota or a dedicated geocoder.
let lastLookup = 0;
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  try {
    const body = await readJsonObject(request);
    if (!validCoordinates(body.latitude, body.longitude))
      throw new RequestError("Некорректные координаты");
    if (
      typeof body.accuracy !== "number" ||
      !Number.isFinite(body.accuracy) ||
      body.accuracy < 0 ||
      body.accuracy > 20000
    )
      throw new RequestError(
        "Точности геолокации недостаточно. Выбери город вручную.",
      );
    if (process.env.GEOLOCATION_ENABLED === "false")
      return Response.json(
        {
          error: "Определение города временно отключено. Введи город вручную.",
        },
        { status: 503, headers },
      );
    if (Date.now() - lastLookup < 1100)
      return Response.json(
        { error: "Повтори определение через несколько секунд." },
        { status: 429, headers: { ...headers, "Retry-After": "2" } },
      );
    lastLookup = Date.now();
    const location = await reverseGeocode(body.latitude, body.longitude);
    if (!location)
      return Response.json(
        { error: "Населённый пункт не найден. Введи город вручную." },
        { status: 404, headers },
      );
    return Response.json(location, { headers });
  } catch (error) {
    // Never log request bodies, coordinates or third-party geocoder error URLs.
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : "Геокодер недоступен. Введи город вручную или попробуй позже.",
      },
      { status: error instanceof RequestError ? error.status : 502, headers },
    );
  }
}
