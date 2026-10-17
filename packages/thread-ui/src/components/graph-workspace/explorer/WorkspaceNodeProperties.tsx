import { File, Folder, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { getLocale, translate, useI18n } from '../../../i18n';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../../graph-ui/Dialog';
import type { WorkspaceTreeNode } from '../workspaceTree';
import { PathChip } from '../../copy/PathChip';

const bytes = (size: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  const short = `${value.toLocaleString(getLocale(), { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
  return unit ? translate('files.propertiesBytes', { size: short, bytes: size.toLocaleString(getLocale()) }) : short;
};
const when = (at: string | undefined) => {
  const date = at ? new Date(at) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString(getLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
};

/** What a file manager's Properties shows: kind, place, size, times and permissions.
    A device that does not report a value leaves its row out. */
export function WorkspaceNodeProperties({ node, open, onOpenChange }: {
  node: WorkspaceTreeNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useI18n();
  const info = node.workspaceNode;
  const directory = node.kind === 'directory';
  const extension = !directory && node.name.includes('.') && !node.name.startsWith('.') ? node.name.split('.').pop()!.toUpperCase() : null;
  const folder = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : translate('files.propertiesRoot');
  const size = node.size ?? info?.size;
  const loaded = directory && node.childrenLoaded ? node.children.length : null;
  const rows: [string, ReactNode][] = [
    [translate('files.propertiesKind'), directory ? translate('files.propertiesFolder') : extension ? translate('files.propertiesFileOf', { kind: extension }) : translate('files.propertiesFile')],
    [translate('files.propertiesLocation'), node.path.includes('/') ? <PathChip path={folder} /> : folder],
    ...(size !== undefined ? [[translate('files.propertiesSize'), bytes(size)] as [string, ReactNode]] : []),
    ...(loaded !== null ? [[translate('files.propertiesContains'), translate('files.propertiesItems', { count: loaded })] as [string, ReactNode]] : []),
    ...([['files.propertiesCreated', info?.createdAt], ['files.propertiesModified', info?.modifiedAt], ['files.propertiesAccessed', info?.accessedAt]] as const)
      .flatMap(([label, at]) => when(at) ? [[translate(label), when(at)] as [string, ReactNode]] : []),
    ...(info?.mode || info?.readonly !== undefined ? [[translate('files.propertiesPermissions'), <>
      {info?.mode ? <code>{info.mode}</code> : null}
      {info?.readonly ? <span className="workspace-properties-tag">{translate('files.propertiesReadonly')}</span> : null}
    </>] as [string, ReactNode]] : []),
    ...(info?.symlink ? [[translate('files.propertiesLink'), translate('files.propertiesLinkYes')] as [string, ReactNode]] : []),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="workspace-properties" overlayClassName="workspace-properties-overlay">
        <header>
          {directory ? <Folder aria-hidden="true" /> : <File aria-hidden="true" />}
          <DialogTitle className="workspace-properties-title" title={node.name}>{node.name}</DialogTitle>
          <DialogClose className="workspace-properties-close" aria-label={translate('files.propertiesClose')}><X aria-hidden="true" /></DialogClose>
        </header>
        <dl>
          {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {!info?.modifiedAt ? <p className="workspace-properties-note">{translate('files.propertiesOlderDevice')}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
