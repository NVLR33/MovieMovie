export const MOBILE_BREAKPOINT = 760;
export function keyboardOccludesNavigation({
  baseline,
  height,
  editable,
  scale = 1,
}: {
  baseline: number;
  height: number;
  editable: boolean;
  scale?: number;
}) {
  // Do not mistake browser chrome changes or pinch zoom for the software keyboard.
  return editable && scale <= 1.05 && baseline - height > 120;
}
export const MOBILE_PRIMARY_ROUTES = [
  'home',
  'catalog',
  'games',
  'profile',
] as const;
export function mobileTabFor(page: string) {
  if (page === 'movie') return 'catalog';
  return MOBILE_PRIMARY_ROUTES.some((route) => route === page) ? page : 'more';
}
