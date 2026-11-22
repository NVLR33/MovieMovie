// Never allow javascript/data URLs, same-origin pages or arbitrary unsandboxed iframes.
export function playerEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port || value.length > 4096) return null;
    const host = url.hostname.toLowerCase();
    if (['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com','youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? url.pathname.slice(1) : url.pathname.startsWith('/embed/') ? url.pathname.slice(7) : url.searchParams.get('v');
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (['rutube.ru','www.rutube.ru'].includes(host)) {
      const match = url.pathname.match(/^\/(?:video|play\/embed)\/([a-zA-Z0-9]+)\/?$/);
      return match ? `https://rutube.ru/play/embed/${match[1]}` : null;
    }
    if (['vk.com','www.vk.com','vkvideo.ru','www.vkvideo.ru'].includes(host)) {
      const oid = url.searchParams.get('oid'), id = url.searchParams.get('id');
      if (url.pathname !== '/video_ext.php' || !oid || !/^-?\d+$/.test(oid) || !id || !/^\d+$/.test(id)) return null;
      const embed = new URL('https://vk.com/video_ext.php');
      embed.searchParams.set('oid', oid); embed.searchParams.set('id', id);
      const hash = url.searchParams.get('hash');
      if (hash && /^[a-zA-Z0-9]+$/.test(hash)) embed.searchParams.set('hash', hash);
      return embed.href;
    }
  } catch { /* Invalid URL is a validation result, never an iframe src. */ }
  return null;
}
