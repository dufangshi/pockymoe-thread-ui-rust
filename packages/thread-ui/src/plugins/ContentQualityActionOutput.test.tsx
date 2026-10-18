/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { ContentQualityActionOutput } from './ContentQualityActionOutput';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  setLocale('en', false);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const skipped = {
  status: 'skipped',
  reason: 'replyExceedsContextBudget',
  maxChars: 10000,
  turnId: 't',
  itemId: 'i',
};

it('explains a reply skipped for exceeding the context limit instead of showing its code', async () => {
  await act(async () =>
    root.render(
      <ContentQualityActionOutput action="rewriteReply" output={skipped} />,
    ),
  );
  expect(container.textContent).toContain(
    'The reply is longer than the context limit (10,000 characters), so it was not polished.',
  );
  expect(container.textContent).not.toContain('replyExceedsContextBudget');
  await act(async () => setLocale('zh-CN', false));
  expect(container.textContent).toContain(
    '回复原文超过参考字数上限（10,000 字），未润色',
  );
  await act(async () =>
    root.render(
      <ContentQualityActionOutput
        action="afterTurn"
        output={{ documents: [], reply: { ...skipped, maxChars: undefined } }}
      />,
    ),
  );
  expect(container.textContent).toContain(
    '回复原文超过参考字数上限，未润色；可在设置中调高上限。',
  );
});
