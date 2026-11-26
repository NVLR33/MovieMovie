export type PlaybackSource = {
  kind: 'video' | 'embed';
  provider: 'MP4' | 'VK Видео' | 'Rutube';
  url: string;
  externalUrl: string;
};
/** Pure URL normalization, never fetches/unwraps a page or accepts embed HTML. */
export function playbackSource(value: unknown): PlaybackSource | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096)
    return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      host.endsWith('.') ||
      !host.includes('.') ||
      /^[\d.]+$/.test(host) ||
      host.includes(':') ||
      /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host) ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    )
      return null;
    if (['rutube.ru', 'www.rutube.ru'].includes(host)) {
      const id = url.pathname.match(
        /^\/(?:video|play\/embed)\/([a-f0-9]{32})\/?$/i,
      )?.[1];
      if (!id) return null;
      const embed = new URL(`https://rutube.ru/play/embed/${id}/`);
      const key = url.searchParams.get('p');
      if (key && /^[a-zA-Z0-9_-]{1,128}$/.test(key))
        embed.searchParams.set('p', key);
      return {
        kind: 'embed',
        provider: 'Rutube',
        url: embed.href,
        externalUrl: embed.href.replace('/play/embed/', '/video/'),
      };
    }
    if (
      ['vk.com', 'www.vk.com', 'vkvideo.ru', 'www.vkvideo.ru'].includes(host)
    ) {
      const match = url.pathname.match(/^\/video(-?\d+)_(\d+)\/?$/);
      const oid =
        match?.[1] ||
        (url.pathname === '/video_ext.php'
          ? url.searchParams.get('oid')
          : null);
      const id =
        match?.[2] ||
        (url.pathname === '/video_ext.php'
          ? url.searchParams.get('id')
          : null);
      if (!oid || !/^-?\d{1,20}$/.test(oid) || !id || !/^\d{1,20}$/.test(id))
        return null;
      const embed = new URL('https://vk.com/video_ext.php');
      embed.searchParams.set('oid', oid);
      embed.searchParams.set('id', id);
      const hash = url.searchParams.get('hash');
      if (hash && /^[a-zA-Z0-9_-]{1,128}$/.test(hash))
        embed.searchParams.set('hash', hash);
      return {
        kind: 'embed',
        provider: 'VK Видео',
        url: embed.href,
        externalUrl: embed.searchParams.has('hash')
          ? embed.href
          : `https://vkvideo.ru/video${oid}_${id}`,
      };
    }
    if (/\.mp4$/i.test(url.pathname)) {
      url.hash = '';
      return {
        kind: 'video',
        provider: 'MP4',
        url: url.href,
        externalUrl: url.href,
      };
    }
  } catch {
    /* Invalid references never become player sources. */
  }
  return null;
}
export function playbackUrl(value: unknown): string {
  if (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && !value.trim())
  )
    return '';
  const source = playbackSource(value);
  if (!source)
    throw new Error(
      'Источник просмотра: нужна HTTPS-ссылка на видео VK, Rutube или прямой MP4. HTML-код и ссылки на другие страницы не поддерживаются.',
    );
  return source.url;
}
