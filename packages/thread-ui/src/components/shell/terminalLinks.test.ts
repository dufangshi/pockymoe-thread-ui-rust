/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmAsync } from '../menu/confirmAsync';
import { activateTerminalLink } from './terminalLinks';

vi.mock('../menu/confirmAsync', () => ({ confirmAsync: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

describe('terminal links', () => {
  it.each(['file:///tmp/private', 'javascript:alert(1)', 'pockymoe://devices', 'mailto:a@example.com', 'not a URL'])('keeps %s blocked', async uri => {
    vi.mocked(confirmAsync).mockClear();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await activateTerminalLink(new MouseEvent('click'), uri);
    expect(confirmAsync).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it.each(['http://example.com/terminal', 'https://example.com/terminal'])('opens the confirmed URL directly: %s', async uri => {
    vi.mocked(confirmAsync).mockResolvedValue(true);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await activateTerminalLink(new MouseEvent('click'), uri);
    expect(open).toHaveBeenCalledExactlyOnceWith(uri, '_blank', 'noopener,noreferrer');
  });

  it('does not open a cancelled link', async () => {
    vi.mocked(confirmAsync).mockResolvedValue(false);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await activateTerminalLink(new MouseEvent('click'), 'https://example.com/terminal');
    expect(open).not.toHaveBeenCalled();
  });
});
