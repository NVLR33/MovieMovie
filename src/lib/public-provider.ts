/** Fixed-origin public API clients only; callers build URLs, never accept a user URL. */
export type FetchJson = (url: string) => Promise<unknown>;
export const publicProviderJson: FetchJson = async (url) => {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json",
      "User-Agent": "moviemovie/1.0 (+https://moviemovie.ru)",
    },
  });
  if (!response.ok) throw new Error("Provider unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing provider response");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2000000) {
        await reader.cancel();
        throw new Error("Provider response too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function providerText(value: unknown, limit = 160): string {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, "")
        .replace(/[\p{Cc}\p{Cf}]/gu, " ")
        .trim()
        .slice(0, limit)
    : "";
}
