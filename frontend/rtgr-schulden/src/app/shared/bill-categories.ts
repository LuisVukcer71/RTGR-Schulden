export interface BillCategory {
  id: string;
  label: string;
}

/**
 * Feste Kategorie-Liste für Rechnungen. Bewusst eine kleine, kuratierte
 * Auswahl statt freier Tags - macht die Presets beim Erfassen schnell
 * antippbar und hält "Top-Anlässe"/Icons in der Liste konsistent.
 */
export const BILL_CATEGORIES: BillCategory[] = [
  { id: 'food', label: 'Essen' },
  { id: 'shopping', label: 'Einkaufen' },
  { id: 'transport', label: 'Transport' },
  { id: 'home', label: 'Wohnen' },
  { id: 'leisure', label: 'Freizeit' },
  { id: 'travel', label: 'Reise' },
  { id: 'other', label: 'Sonstiges' }
];

export function getCategoryLabel(id: string | null | undefined): string | null {
  return BILL_CATEGORIES.find(c => c.id === id)?.label ?? null;
}
