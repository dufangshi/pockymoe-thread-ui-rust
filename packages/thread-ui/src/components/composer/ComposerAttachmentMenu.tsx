import { translate, useI18n } from '../../i18n';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import { InputGroupButton } from '../graph-ui/InputGroup';
import { PlusIcon } from './composerPresentation';
import { FileText, ImageIcon, Paperclip } from 'lucide-react';
import { useThemeFeature } from '../themeHooks';

export function ComposerAttachmentMenu({
  open,
  iconButtonClassName,
  menuClassName,
  menuItemClassName,
  onToggle,
  onPickPhoto,
  onPickFile,
}: {
  open: boolean;
  iconButtonClassName: string;
  menuClassName: string;
  menuItemClassName: string;
  onToggle: () => void;
  onPickPhoto: () => void;
  onPickFile: () => void;
}) {
  useI18n();
  // Rich menus: a paperclip trigger and icon rows.
  const rich = useThemeFeature('composer.richMenus');
  return (
    <div className="relative">
      <InputGroupButton
        type="button"
        variant="ghost"
        size="icon-xs"
        data-composer-menu-trigger="true"
        aria-label={translate("chat.addAttachment")}
        title={translate("chat.addAttachment")}
        onClick={onToggle}
        className={`${iconButtonClassName} h-9 w-9 rounded-full sm:h-8 sm:w-8`}
      >
        {rich ? <Paperclip aria-hidden="true" className="h-4 w-4" strokeWidth={2} /> : <PlusIcon />}
      </InputGroupButton>

      {open && (
        <ComposerMenuSurface
          align="start"
          className={`${menuClassName} w-32 rounded-2xl border bg-stone-900/72 shadow-2xl shadow-stone-950/20`}
        >
          <div className="p-2">
            <button
              type="button"
              onClick={onPickPhoto}
              className={`${menuItemClassName} block w-full rounded-xl px-3 py-2 text-left text-sm transition`}
            >
              {rich ? <ImageIcon aria-hidden="true" className="composer-attach-icon" /> : null}
              {translate("chat.photo")}</button>
            <button
              type="button"
              onClick={onPickFile}
              className={`${menuItemClassName} mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm transition`}
            >
              {rich ? <FileText aria-hidden="true" className="composer-attach-icon" /> : null}
              {translate("chat.file")}</button>
          </div>
        </ComposerMenuSurface>
      )}
    </div>
  );
}
