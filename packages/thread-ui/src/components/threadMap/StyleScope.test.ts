/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps compact offline labels scoped to the map and ordinary path/cost labels visible', () => {
  const style = document.createElement('style');
  style.textContent = readFileSync('src/styles/thread-map.css', 'utf8');
  const host = document.createElement('div');
  host.innerHTML = '<button><strong>Workspace</strong><small data-outside>/project · $2.14</small></button><div class="thread-map" data-presentation="page"><div class="thread-map-offline-strip"><button><span class="thread-map-device-state"></span><b>Offline device</b><span data-offline>Offline</span><small data-cache>Cached</small></button></div></div>';
  document.head.append(style); document.body.append(host);
  try {
    expect(getComputedStyle(host.querySelector('[data-outside]')!).display).not.toBe('none');
    expect(getComputedStyle(host.querySelector('[data-offline]')!).display).toBe('none');
    expect(getComputedStyle(host.querySelector('[data-cache]')!).display).toBe('none');
    expect(getComputedStyle(host.querySelector('.thread-map-device-state')!).display).not.toBe('none');
  } finally { host.remove(); style.remove(); }
});
