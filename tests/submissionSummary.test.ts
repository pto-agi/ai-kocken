import { describe, expect, it } from 'vitest';
import {
  buildSubmissionSourceHash,
  normalizeSubmissionPayload,
  parseSubmissionSummaryJson,
} from '../utils/submissionSummary';

describe('submission summary utils', () => {
  it('builds stable hash for same semantic payload', () => {
    const a = normalizeSubmissionPayload({ b: 2, a: 1, empty: '  ' });
    const b = normalizeSubmissionPayload({ a: 1, b: 2 });
    expect(buildSubmissionSourceHash(a)).toBe(buildSubmissionSourceHash(b));
  });

  it('throws for invalid summary json shape', () => {
    expect(() => parseSubmissionSummaryJson({ overview: 123 })).toThrow();
  });

  it('parses valid summary json shape', () => {
    const parsed = parseSubmissionSummaryJson({
      overview: 'Kort översikt',
      client_profile: 'Profil',
      key_goals: ['Mål 1'],
      risks_or_flags: [],
      coaching_actions: ['Action 1'],
      followup_focus: ['Fokus 1'],
      missing_info: [],
      confidence: 0.82,
    });

    expect(parsed.confidence).toBe(0.82);
    expect(parsed.coaching_actions.length).toBe(1);
  });
});
