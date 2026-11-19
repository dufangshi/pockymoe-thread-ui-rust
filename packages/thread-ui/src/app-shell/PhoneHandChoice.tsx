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
      {/* The host's one segmented control (colour mode uses the same), not a variant. */}
      <div role="radiogroup" aria-label={translate('workbench.phoneHand')} className="product-segmented is-compact shrink-0">
        {(['left', 'right'] as const).map(value => (
          <button key={value} type="button" role="radio" aria-checked={hand === value} onClick={() => onChange(value)}
            className="product-segment">
            {translate(value === 'left' ? 'workbench.phoneHandLeft' : 'workbench.phoneHandRight')}
          </button>
        ))}
      </div>
    </div>
  );
}
