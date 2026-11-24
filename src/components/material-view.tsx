'use client';
import { useSyncExternalStore } from 'react';
import { Grid2X2, LayoutGrid, List } from 'lucide-react';
import { browserStorage } from '@/lib/browser-preferences';
export type MaterialView = 'cards' | 'compact' | 'list';
let memory: MaterialView = 'cards';
function current(): MaterialView {
  const value = browserStorage.getItem('mg_material_view') || memory;
  return value === 'compact' || value === 'list' ? value : 'cards';
}
function subscribe(callback: () => void) {
  window.addEventListener('mg-material-view', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('mg-material-view', callback);
    window.removeEventListener('storage', callback);
  };
}
export function useMaterialView() {
  const view = useSyncExternalStore(
    subscribe,
    current,
    () => 'cards' as MaterialView,
  );
  return [
    view,
    (value: MaterialView) => {
      memory = value;
      browserStorage.setItem('mg_material_view', value);
      window.dispatchEvent(new Event('mg-material-view'));
    },
  ] as const;
}
export function MaterialViewControls({ en = false }: { en?: boolean }) {
  const [view, setView] = useMaterialView();
  return (
    <div
      className="material-view-control"
      role="group"
      aria-label={en ? 'Title layout' : 'Вид материалов'}
    >
      {(
        [
          { id: 'cards', label: en ? 'Cards' : 'Карточки', Icon: LayoutGrid },
          {
            id: 'compact',
            label: en ? 'More posters' : 'Больше постеров',
            Icon: Grid2X2,
          },
          { id: 'list', label: en ? 'List' : 'Список', Icon: List },
        ] as const
      ).map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => setView(id)}
        >
          <Icon size={15} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
