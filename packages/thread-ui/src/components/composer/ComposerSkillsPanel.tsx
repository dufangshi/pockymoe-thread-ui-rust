import { translate, useI18n } from '../../i18n';
import type { ThreadSkillsDto } from '@pockymoe/shared';

import { ErrorMark } from '../copy/ErrorMark';
import { ClipboardIcon, skillScopeLabel } from './composerPresentation';
import type { SlashPanelState } from './types';

interface ComposerSkillsPanelProps {
  skillsState: SlashPanelState<ThreadSkillsDto>;
  copiedSkillName: string | null;
  composerChipButtonClassName: string;
  onCopySkillInvokeName: (skillName: string) => Promise<void> | void;
}

export function ComposerSkillsPanel({
  skillsState,
  copiedSkillName,
  composerChipButtonClassName,
  onCopySkillInvokeName,
}: ComposerSkillsPanelProps) {
  useI18n();
  return (
    <div className="p-2">
      {skillsState.status === 'loading' && !skillsState.data ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.loadingSkills")}</p>
      ) : null}
      {/* A failed reload keeps the skills already listed; only an empty list says so. */}
      {skillsState.error && !skillsState.data?.skills.length ? (
        <p className="mb-2 flex items-center gap-1 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          <span className="min-w-0">{translate("workbench.unableToLoadSkills")}</span>
          <ErrorMark message={skillsState.error} />
        </p>
      ) : null}
      {skillsState.data?.skills.length ? (
        <div className="space-y-2">
          {skillsState.data.skills.map((skill) => (
            <div
              key={skill.path}
              className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2.5"
            >
              <div className="space-y-2">
                <p className="truncate text-sm font-medium text-stone-100">
                  {skill.interface?.displayName ?? skill.name}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
                  <span className="rounded-full border border-stone-700 px-2 py-1 text-stone-400">
                    {skillScopeLabel(skill.scope)}
                  </span>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 normal-case tracking-normal transition ${
                      copiedSkillName === skill.name
                        ? 'border-emerald-400/45 bg-emerald-400/12 text-emerald-100'
                        : `${composerChipButtonClassName} border-stone-700 text-stone-300 hover:border-stone-500`
                    }`}
                    onClick={() => void onCopySkillInvokeName(skill.name)}
                    title={translate("chat.copy_fad8c8", { value1: skill.name })}
                    aria-label={translate("chat.copy_fad8c8", { value1: skill.name })}
                  >
                    <ClipboardIcon />${skill.name}
                  </button>
                </div>
                <p className="text-xs leading-5 text-stone-400">
                  {skill.interface?.shortDescription ??
                    skill.shortDescription ??
                    skill.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {/* A skill file that could not be read: its path, and why behind a mark. */}
      {skillsState.data?.errors.length ? (
        <div className="mt-2 space-y-2">
          {skillsState.data.errors.map((entry) => (
            <div
              key={`${entry.path}:${entry.message}`}
              className="flex items-center gap-1 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2 text-xs text-stone-400"
            >
              <p className="min-w-0 break-all">{entry.path}</p>
              <ErrorMark message={entry.message} />
            </div>
          ))}
        </div>
      ) : null}
      {skillsState.status !== 'loading' &&
      !skillsState.error &&
      (skillsState.data?.skills.length ?? 0) === 0 &&
      (skillsState.data?.errors.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.noSkillsAvailableRightNow")}</p>
      ) : null}
    </div>
  );
}
