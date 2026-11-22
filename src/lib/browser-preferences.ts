// Optional browser capabilities must not crash navigation in private/restricted contexts.
export const browserStorage = {
  getItem(key: string): string | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch { /* preferences remain in memory */ }
  },
};
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
