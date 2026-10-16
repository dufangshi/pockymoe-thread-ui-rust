import { translate, useI18n } from '../i18n';
import type { PhoneHand } from './AppShellNavContext';

/** Right or left thumb for the one-handed phone layout, as a two-way switch. */
export function PhoneHandChoice({ hand, onChange }: { hand: PhoneHand; onChange: (hand: PhoneHand) => void }) {
  useI18n();
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--theme-fg)]">{translate('workbench.phoneHand')}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--theme-fg-muted)]">{translate('workbench.phoneHandHint')}</p>
      </div>
      <div role="radiogroup" aria-label={translate('workbench.phoneHand')}
        className="inline-flex shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-0.5">
        {(['left', 'right'] as const).map(value => (
          <button key={value} type="button" role="radio" aria-checked={hand === value} onClick={() => onChange(value)}
            className={`min-h-9 rounded-full px-4 text-xs font-medium ${hand === value
              ? 'bg-[var(--theme-accent-solid)] text-[var(--theme-accent-solid-fg)]'
              : 'text-[var(--theme-fg-soft)]'}`}>
            {translate(value === 'left' ? 'workbench.phoneHandLeft' : 'workbench.phoneHandRight')}
          </button>
        ))}
      </div>
    </div>
  );
}
