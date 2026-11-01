import { Select } from '../components/Select';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { en } from './en';
import { zhCN } from './zh-CN';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, detectLocale, normalizeLocale, type Locale } from './locales';
export * from './locales';
export { en, zhCN };
export type TranslationKey = keyof typeof en;
export type TranslationValues = Record<string, string | number | boolean | null | undefined>;
type Message = string | { one: string; other: string };
export const resources = { en, 'zh-CN': zhCN };

// Keep lazy workspace-panel and host imports on one preference even if a bundler duplicates this module.
interface LocaleStore { locale: Locale; initialized: boolean; listeners: Set<() => void> }
const storeKey = Symbol.for('remote-codex.i18n');
const globalStore = globalThis as typeof globalThis & { [storeKey]?: LocaleStore };
const store = globalStore[storeKey] ??= { locale: DEFAULT_LOCALE, initialized: false, listeners: new Set() };
function applyDocumentLocale() {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = store.locale;
    document.documentElement.dir = 'ltr';
  }
}
export function initializeI18n() {
  if (!store.initialized) {
    let stored: string | null = null;
    try { stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCALE_STORAGE_KEY); } catch { /* Private browsers may deny storage. */ }
    store.locale = detectLocale(stored, typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]);
    store.initialized = true;
    applyDocumentLocale();
  }
  return store.locale;
}
export function getLocale(): Locale { return initializeI18n(); }
export function setLocale(value: string, persist = true) {
  initializeI18n();
  const locale = normalizeLocale(value);
  if (persist) { try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* Switching still works without persistence. */ } }
  const changed = store.locale !== locale;
  store.locale = locale;
  applyDocumentLocale();
  if (changed) store.listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => { store.listeners.delete(listener); };
}
export function resolveTranslation(locale: Locale, key: TranslationKey, values: TranslationValues = {}, bundles: Partial<Record<Locale, Partial<Record<TranslationKey, Message>>>> = resources): string {
  const entry = bundles[locale]?.[key] ?? bundles.en?.[key] ?? en[key];
  if (!entry) throw new Error(`Missing translation key: ${key}`);
  const template = typeof entry === 'string' ? entry : entry[new Intl.PluralRules(locale).select(Number(values.count)) === 'one' ? 'one' : 'other'];
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    if (!(name in values)) throw new Error(`Missing interpolation value ${name} for ${key}`);
    return String(values[name] ?? '');
  });
}
/** Use only for product copy. User/model text, commands, IDs and raw server errors stay untouched. */
export function translate(key: TranslationKey, values?: TranslationValues): string { return resolveTranslation(getLocale(), key, values); }
export const t = translate;
export function formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat(getLocale(), options).format(date);
}
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) { return new Intl.NumberFormat(getLocale(), options).format(value); }
const I18nContext = createContext<Locale | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
  useEffect(() => {
    const change = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY || event.key === null) setLocale(event.newValue ?? detectLocale(null, navigator.languages), false);
    };
    window.addEventListener('storage', change);
    return () => window.removeEventListener('storage', change);
  }, []);
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  useContext(I18nContext);
  const locale = useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
  return useMemo(() => ({ locale, setLocale, t: translate, formatDate, formatNumber }), [locale]);
}
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return <label className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <span>{t('common.language')}</span>
    <Select aria-label={t('common.language')} value={locale} onValueChange={selectedValue => setLocale(selectedValue)}
      style={{ background: 'var(--theme-panel)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border)', borderRadius: 6, padding: '8px 10px', minHeight: 40 }}>
      <option value="en">English</option><option value="zh-CN">简体中文</option>
    </Select>
  </label>;
}
