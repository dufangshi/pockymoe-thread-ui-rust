import type { MouseEvent, ReactNode } from 'react';
import { CornerUpLeft, GitBranch } from 'lucide-react';

import type { ThreadLinkInfo } from '../../adapters';
import { translate, useI18n } from '../../i18n';

/**
 * One line pinned above a sub-thread's conversation: which thread started it
 * (and that thread's workspace when it is another one), with a way back to it.
 * It takes its own row, so it never covers the first message. `parent` is
 * `undefined` while the page looks it up (the short ID stands in) and `null`
 * when the parent is gone or the reader cannot open it.
 */
export function ThreadRelationBar({ parentThreadId, parent, currentWorkspaceId, href, onOpen }: {
  parentThreadId: string;
  parent: ThreadLinkInfo | null | undefined;
  currentWorkspaceId?: string | null | undefined;
  href?: string | undefined;
  onOpen?: ((threadId: string) => void) | undefined;
}) {
  useI18n();
  const back = translate('chat.relationBack');
  const lead = translate('chat.relationSubThread');
  if (parent === null) {
    return (
      <div className="thread-relation-bar" data-unavailable="">
        <div className="thread-relation-row">
          <GitBranch className="thread-relation-icon" aria-hidden="true" />
          <span className="thread-relation-lead">{lead} ·</span>
          <span className="thread-relation-missing">{translate('chat.relationParentUnavailable')}</span>
        </div>
      </div>
    );
  }
  const title = parent?.title.trim() || parentThreadId.slice(0, 8);
  const place = parent?.workspaceId && currentWorkspaceId && parent.workspaceId !== currentWorkspaceId
    ? parent.workspaceLabel?.trim() : '';
  const open = (event: MouseEvent<HTMLElement>) => {
    // Modified clicks keep the browser's own new-tab and new-window handling.
    if (!onOpen || (href && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))) return;
    event.preventDefault();
    onOpen(parentThreadId);
  };
  const link = (className: string, content: ReactNode, label?: string) => href
    ? <a className={className} href={href} onClick={open} title={label ?? title} {...(label ? { 'aria-label': label } : {})}>{content}</a>
    : <button type="button" className={className} onClick={open} title={label ?? title} {...(label ? { 'aria-label': label } : {})}>{content}</button>;
  return (
    <div className="thread-relation-bar" data-loading={parent === undefined ? '' : undefined}>
      <div className="thread-relation-row">
        <GitBranch className="thread-relation-icon" aria-hidden="true" />
        <span className="thread-relation-lead">{lead} · {translate('chat.relationFrom')}</span>
        {link('thread-relation-parent', title)}
        {place ? <span className="thread-relation-place" title={place}>· {place}</span> : null}
        {link('thread-relation-back', <><CornerUpLeft aria-hidden="true" /><span className="thread-relation-back-text">{back}</span></>, back)}
      </div>
    </div>
  );
}
