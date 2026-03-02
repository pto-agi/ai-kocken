import { describe, expect, it } from 'vitest';
import { hasSubmittedExtension } from '../utils/membershipExtensionStatus';

describe('membership extension status', () => {
  it('returns true for Swedish extension statuses', () => {
    expect(hasSubmittedExtension('forlangning')).toBe(true);
    expect(hasSubmittedExtension('Förlängning skickad')).toBe(true);
  });

  it('returns true for English extension statuses', () => {
    expect(hasSubmittedExtension('extension_requested')).toBe(true);
    expect(hasSubmittedExtension('renewal pending')).toBe(true);
  });

  it('returns false for regular statuses', () => {
    expect(hasSubmittedExtension('active')).toBe(false);
    expect(hasSubmittedExtension('paused')).toBe(false);
    expect(hasSubmittedExtension('expired')).toBe(false);
  });

  it('returns false for empty values', () => {
    expect(hasSubmittedExtension('')).toBe(false);
    expect(hasSubmittedExtension(undefined)).toBe(false);
    expect(hasSubmittedExtension(null)).toBe(false);
  });
});
