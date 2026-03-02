import { describe, expect, it } from 'vitest';
import { resolveCopyText } from '../utils/copyValue';

describe('copy value', () => {
  it('returns trimmed string text', () => {
    expect(resolveCopyText('  test@example.com  ')).toBe('test@example.com');
  });

  it('returns null for placeholders and empty values', () => {
    expect(resolveCopyText('—')).toBeNull();
    expect(resolveCopyText('   ')).toBeNull();
    expect(resolveCopyText(null)).toBeNull();
    expect(resolveCopyText(undefined)).toBeNull();
  });

  it('stringifies numbers', () => {
    expect(resolveCopyText(42)).toBe('42');
  });
});

