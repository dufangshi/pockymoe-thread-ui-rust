import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { MiddleName } from './MiddleName';
it('keeps an extensionless model suffix while truncating the middle', () => {
  const html = renderToStaticMarkup(<MiddleName name="provider-a-very-long-model-name-2026-11-02" />);
  expect(html).toContain('middle-name-tail">26-11-02</span>');
  expect(html).toContain('provider-a-very-long-model-name-20');
});
it('retains a short extension and leaves short names intact', () => {
  expect(renderToStaticMarkup(<MiddleName name="a-very-long-file-name.test.tsx" />)).toContain('middle-name-tail">.test.tsx</span>');
  const html = renderToStaticMarkup(<MiddleName name="grok-4.7" />);
  expect(html).toContain('grok-4.7'); expect(html).not.toContain('middle-name-tail');
});
