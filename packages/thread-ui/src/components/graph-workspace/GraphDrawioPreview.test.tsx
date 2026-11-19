// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { drawioPreviewDocument } from './GraphDrawioPreview';
import { isDrawioPath } from './explorer/filePreviewPolicy';

describe('draw.io preview document', () => {
  it('keeps diagram XML as escaped data in an isolated, locally hosted viewer', () => {
    const xml = '<mxfile><!-- </script><script>parent.alert("bad")</script> --></mxfile>';
    const html = drawioPreviewDocument(xml, 'https://remote.example');
    expect(html).toContain('src="https://remote.example/vendor/drawio/bootstrap.v2.js"');
    expect(html).not.toContain('https://viewer.diagrams.net');
    expect(html).not.toContain('</script><script>parent.alert');
    expect(html).toContain('\\u003c/script\\u003e');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('type="application/json"');
    expect(html).not.toContain("'unsafe-inline' 'unsafe-eval'");
    expect(html).not.toMatch(/<script>/);
  });
  it('recognizes diagram files without taking over unrelated XML/source files', () => {
    expect(isDrawioPath('/docs/Architecture.DRAWIO')).toBe(true);
    expect(isDrawioPath('/docs/architecture.dio')).toBe(true);
    expect(isDrawioPath('/docs/settings.xml')).toBe(false);
  });
});
