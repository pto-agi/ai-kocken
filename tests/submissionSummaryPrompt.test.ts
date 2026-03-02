import { describe, expect, it } from 'vitest';
import { buildSubmissionSummaryPrompts, shouldReuseCachedSummary } from '../utils/submissionSummaryPrompt';

describe('submission summary prompt helpers', () => {
  it('reuses cached summary when hash matches and no force refresh', () => {
    expect(shouldReuseCachedSummary({ cachedHash: 'abc', incomingHash: 'abc', forceRefresh: false })).toBe(true);
  });

  it('does not reuse cache when force refresh is true', () => {
    expect(shouldReuseCachedSummary({ cachedHash: 'abc', incomingHash: 'abc', forceRefresh: true })).toBe(false);
  });

  it('builds prompt that requests strict JSON fields', () => {
    const prompt = buildSubmissionSummaryPrompts({ language: 'sv', submissionType: 'start', payload: { goal: 'Bygga styrka' } });
    expect(prompt.system).toContain('overview');
    expect(prompt.system).toContain('coaching_actions');
    expect(prompt.user).toContain('Bygga styrka');
  });
});
