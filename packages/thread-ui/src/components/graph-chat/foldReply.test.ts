import { expect, it } from 'vitest';
import { foldReply } from './GraphChatMessageBody';

it('folds a reply at a line or sentence end near the limit, never inside a marker', () => {
  expect(foldReply('First line here.\nSecond line goes on and on', 24)).toBe('First line here.\n\n...');
  expect(foldReply('一句话说完了。另一句话还在继续说下去说下去', 10)).toBe('一句话说完了。\n\n...');
  expect(foldReply('Done. **Why the 4 cores** matter is long', 20)).toBe('Done.\n\n...');
  expect(foldReply('Plain words without any break at all here', 22)).toBe('Plain words without\n\n...');
  expect(foldReply('Run `pnpm test --filter ws2` then', 18).includes('`')).toBe(false);
});
