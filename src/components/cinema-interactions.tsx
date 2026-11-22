'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Star, X } from 'lucide-react';

const canMove = () => window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches;
export function tiltPoster(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || !canMove()) return;
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  // DOM-only updates: no React render or permanent GPU layer for each catalog tile.
  element.style.setProperty('--tilt-x', `${(0.5 - y) * 7}deg`);
  element.style.setProperty('--tilt-y', `${(x - 0.5) * 7}deg`);
  element.style.setProperty('--gloss-x', `${x * 100}%`);
  element.style.setProperty('--gloss-y', `${y * 100}%`);
}
export function resetTilt(event: PointerEvent<HTMLElement>) {
  for (const property of ['--tilt-x', '--tilt-y', '--gloss-x', '--gloss-y']) event.currentTarget.style.removeProperty(property);
}
export function MagneticButton({ active, kind, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean; kind: 'heart' | 'bookmark' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(active);
  useEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const icon = ref.current?.querySelector('svg');
    const frames = active ? kind === 'heart'
      ? [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }]
      : [{ transform: 'translateY(-4px)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(0)' }]
      : [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-5px)', opacity: .25 }, { transform: 'translateY(0)', opacity: 1 }];
    const animation = icon?.animate(frames, { duration: 420, easing: 'ease-out' });
    return () => animation?.cancel();
  }, [active, kind]);
  const move = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== 'mouse' || !canMove()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    ref.current?.style.setProperty('--magnet-x', `${Math.max(-3, Math.min(3, (event.clientX - rect.left - rect.width / 2) * .12))}px`);
    ref.current?.style.setProperty('--magnet-y', `${Math.max(-3, Math.min(3, (event.clientY - rect.top - rect.height / 2) * .12))}px`);
  };
  const reset = () => { ref.current?.style.removeProperty('--magnet-x'); ref.current?.style.removeProperty('--magnet-y'); };
  return <span ref={ref} className="magnetic-target" onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
    <button {...props} type="button" aria-pressed={active} className={`${className} magnetic-button motion-${kind}`} data-active={active}>
      <span className="collection-motion-icon" key={String(active)}>{children}</span>
    </button>
  </span>;
}

export function ReviewDrawer({ open, close, children }: { open: boolean; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);
  if (!open) return null;
  return createPortal(<dialog ref={dialog} className="review-drawer" aria-labelledby="review-drawer-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <header><div><span className="eyebrow">ДЕЛИСЬ ВПЕЧАТЛЕНИЯМИ</span><h2 id="review-drawer-title">Мнения сообщества</h2></div><button autoFocus type="button" className="icon-button" aria-label="Закрыть мнения сообщества" onClick={close}><X size={21} /></button></header>
    <div className="review-drawer-scroll">{children}</div>
  </dialog>, document.body);
}

export function MovieContextBar({ anchor, title, rating, saved, bookmark }: { anchor: RefObject<HTMLDivElement | null>; title: string; rating: string; saved: boolean; bookmark: () => void }) {
  const [visible, setVisible] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const header = document.querySelector('.topbar');
    const target = document.getElementById('movie-context-slot');
    const poster = anchor.current;
    if (!poster || !header || !target || typeof IntersectionObserver === 'undefined') return;
    // DOM target becomes available only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlot(target);
    let observer: IntersectionObserver;
    const observe = () => {
      observer?.disconnect();
      const bottom = header.getBoundingClientRect().bottom;
      observer = new IntersectionObserver(entries => setVisible(!entries[0].isIntersecting && entries[0].boundingClientRect.bottom <= bottom), { rootMargin: `-${Math.ceil(bottom)}px 0px 0px 0px` });
      observer.observe(poster);
    };
    observe();
    const resize = new ResizeObserver(observe); resize.observe(header);
    return () => { observer.disconnect(); resize.disconnect(); };
  }, [anchor]);
  if (!slot || !visible) return null;
  return createPortal(<div className="movie-context-bar"><strong title={title}>{title}</strong><span><Star size={13} />{rating}</span><MagneticButton active={saved} kind="bookmark" className="outline-btn small" onClick={bookmark}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /><span>{saved ? 'В списке' : 'Буду смотреть'}</span></MagneticButton></div>, slot);
}

export function RatingCelebration({ sequence }: { sequence: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!sequence || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const stars = ref.current?.parentElement?.querySelector('.fancy-stars');
    const animation = stars?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
    return () => animation?.cancel();
  }, [sequence]);
  if (!sequence) return null;
  return <span ref={ref} key={sequence} className="rating-celebration" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--spark-angle': `${i * 45}deg`, '--spark-color': ['#c4b5fd', '#fbbf24', '#6ee7b7'][i % 3] } as CSSProperties} />)}</span>;
}

const revealEvent = 'moviemovie:achievement-reveal';
function subscribeReveal(callback: () => void) {
  window.addEventListener(revealEvent, callback); window.addEventListener('storage', callback);
  return () => { window.removeEventListener(revealEvent, callback); window.removeEventListener('storage', callback); };
}
export function AchievementReveal({ userId, achievementId, tier, icon, name }: { userId: number; achievementId: string; tier: number; icon: string; name: string }) {
  const key = `mg_achievement_reveal:${userId}:${achievementId}:${tier}`;
  const revealed = useSyncExternalStore(subscribeReveal, () => { try { return localStorage.getItem(key) === '1'; } catch { return true; } }, () => false);
  const [flipped, setFlipped] = useState(false);
  return <button type="button" className={`achievement-reveal ${revealed || flipped ? 'is-revealed' : ''}`} aria-label={revealed || flipped ? `${name}: оформление открыто` : `Открыть награду: ${name}`} aria-pressed={revealed || flipped} onClick={event => {
    event.stopPropagation();
    setFlipped(true);
    try { localStorage.setItem(key, '1'); window.dispatchEvent(new Event(revealEvent)); } catch { /* Reveal still works without persistence. */ }
  }}>
    <span className="achievement-flip"><span className="achievement-flip-front" aria-hidden="true">✦</span><span className="achievement-flip-back" aria-hidden="true">{icon}</span></span>
    <small>{revealed || flipped ? 'В коллекции' : 'Открыть награду'}</small>
    {flipped && <span className="achievement-reveal-note" role="status">Награда уже засчитана</span>}
  </button>;
}
