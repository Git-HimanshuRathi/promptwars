import { describe, it, expect } from 'vitest';
import { extractText } from '../services/extract.js';

describe('extractText', () => {
  it('extracts plain text from text/plain', async () => {
    const text = 'This is a sample contract clause that is long enough to pass validation.';
    const buf = Buffer.from(text, 'utf-8');
    const result = await extractText(buf, 'sample.txt', 'text/plain');
    expect(result.text).toContain('sample contract');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.detectedMime).toBe('text/plain');
  });

  it('rejects too-small documents', async () => {
    const buf = Buffer.from('short', 'utf-8');
    await expect(extractText(buf, 'tiny.txt', 'text/plain')).rejects.toThrow(/empty/i);
  });

  it('infers mime from filename when missing', async () => {
    const buf = Buffer.from('A '.repeat(80) + 'longer markdown body.', 'utf-8');
    const result = await extractText(buf, 'note.md', '');
    expect(result.detectedMime).toBe('text/markdown');
  });

  it('rejects oversized buffers', async () => {
    const big = Buffer.alloc(20 * 1024 * 1024);
    await expect(extractText(big, 'big.txt', 'text/plain')).rejects.toThrow(/too large/i);
  });

  it('rejects unsupported types', async () => {
    const buf = Buffer.from('A '.repeat(80) + 'long enough.', 'utf-8');
    await expect(extractText(buf, 'image.png', 'image/png')).rejects.toThrow(/Unsupported/);
  });

  it('rejects files where magic bytes do not match declared type', async () => {
    const fakePdf = Buffer.from('NOT A PDF — just text claiming to be one'.repeat(3), 'utf-8');
    await expect(extractText(fakePdf, 'fake.pdf', 'application/pdf')).rejects.toThrow(
      /Malformed file/,
    );
  });
});
