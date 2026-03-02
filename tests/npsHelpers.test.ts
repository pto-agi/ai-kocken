import { describe, expect, it } from 'vitest';
import { categorizeNps, categoryLabel, computeNpsSummary, type NpsResponse } from '../utils/npsHelpers';

describe('categorizeNps', () => {
    it('scores 9-10 are promoters', () => {
        expect(categorizeNps(9)).toBe('promoter');
        expect(categorizeNps(10)).toBe('promoter');
    });

    it('scores 7-8 are passive', () => {
        expect(categorizeNps(7)).toBe('passive');
        expect(categorizeNps(8)).toBe('passive');
    });

    it('scores 0-6 are detractors', () => {
        expect(categorizeNps(0)).toBe('detractor');
        expect(categorizeNps(6)).toBe('detractor');
    });
});

describe('categoryLabel', () => {
    it('returns Swedish labels', () => {
        expect(categoryLabel('promoter')).toBe('Ambassadör');
        expect(categoryLabel('passive')).toBe('Passiv');
        expect(categoryLabel('detractor')).toBe('Kritiker');
    });
});

describe('computeNpsSummary', () => {
    const makeResponse = (overrides: Partial<NpsResponse> = {}): NpsResponse => ({
        id: 'r1',
        user_id: 'u1',
        score: 10,
        comment: null,
        created_at: '2026-03-01T10:00:00Z',
        full_name: 'Test User',
        ...overrides,
    });

    it('returns zeroed summary for empty array', () => {
        const result = computeNpsSummary([]);
        expect(result.total).toBe(0);
        expect(result.npsScore).toBe(0);
    });

    it('computes NPS score correctly', () => {
        const responses = [
            makeResponse({ id: '1', score: 10 }),   // promoter
            makeResponse({ id: '2', score: 9 }),    // promoter
            makeResponse({ id: '3', score: 7 }),    // passive
            makeResponse({ id: '4', score: 3 }),    // detractor
        ];
        const result = computeNpsSummary(responses);
        expect(result.promoters).toBe(2);
        expect(result.passives).toBe(1);
        expect(result.detractors).toBe(1);
        // NPS = ((2-1)/4)*100 = 25
        expect(result.npsScore).toBe(25);
    });

    it('extracts recent comments sorted by date', () => {
        const responses = [
            makeResponse({ id: '1', score: 10, comment: 'Bra!', created_at: '2026-01-01T00:00:00Z' }),
            makeResponse({ id: '2', score: 8, comment: 'OK', created_at: '2026-03-01T00:00:00Z' }),
            makeResponse({ id: '3', score: 5, comment: null, created_at: '2026-02-01T00:00:00Z' }),
        ];
        const result = computeNpsSummary(responses);
        expect(result.recentComments).toHaveLength(2);
        expect(result.recentComments[0].comment).toBe('OK');
        expect(result.recentComments[1].comment).toBe('Bra!');
    });
});
