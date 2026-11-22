import { cinemaCardDimensions, type CinemaCardFormat } from './cinema-card-art';

/** Browser-only PNG export. All assets in the SVG must be embedded to keep the canvas origin-clean. */
export async function cinemaCardPng(svg: string, format: CinemaCardFormat): Promise<Blob> {
  const { width, height } = cinemaCardDimensions(format);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Не удалось подготовить изображение визитки'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Этот браузер не поддерживает экспорт изображений');
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось сохранить PNG')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadCinemaCard(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Let the browser consume the resource before revoking it (notably on Safari).
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
