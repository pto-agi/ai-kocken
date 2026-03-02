import { describe, expect, it } from 'vitest';
import { buildProgressTimeline } from '../utils/progressTracker';

describe('buildProgressTimeline', () => {
    it('returns empty for no submissions', () => {
        const result = buildProgressTimeline([]);
        expect(result.points).toHaveLength(0);
        expect(result.totalMonths).toBe(0);
        expect(result.milestones).toHaveLength(0);
    });

    it('handles a single start submission', () => {
        const result = buildProgressTimeline([
            { created_at: '2026-01-01T10:00:00Z', kind: 'start', goal_description: 'Gå ner i vikt' },
        ]);
        expect(result.points).toHaveLength(1);
        expect(result.points[0].kind).toBe('start');
        expect(result.points[0].goal).toBe('Gå ner i vikt');
        expect(result.milestones).toHaveLength(0);
    });

    it('sorts chronologically', () => {
        const result = buildProgressTimeline([
            { created_at: '2026-03-01T10:00:00Z', kind: 'uppfoljning', goal: 'B' },
            { created_at: '2026-01-01T10:00:00Z', kind: 'start', goal_description: 'A' },
        ]);
        expect(result.points[0].kind).toBe('start');
        expect(result.points[1].kind).toBe('uppfoljning');
    });

    it('adds 3 month milestone when span >= 3 months', () => {
        const result = buildProgressTimeline([
            { created_at: '2025-10-01T10:00:00Z', kind: 'start', goal_description: 'Start' },
            { created_at: '2026-01-15T10:00:00Z', kind: 'uppfoljning', goal: 'Uppföljning' },
        ]);
        expect(result.milestones).toContain('3 månader');
        expect(result.totalMonths).toBe(3);
    });

    it('adds multiple milestones for long span', () => {
        const result = buildProgressTimeline([
            { created_at: '2024-01-01T10:00:00Z', kind: 'start', goal_description: 'Start' },
            { created_at: '2026-01-15T10:00:00Z', kind: 'uppfoljning', goal: 'Sen' },
        ]);
        expect(result.milestones).toContain('3 månader');
        expect(result.milestones).toContain('6 månader');
        expect(result.milestones).toContain('1 år');
        expect(result.milestones).toContain('2 år');
    });

    it('preserves feedback text', () => {
        const result = buildProgressTimeline([
            { created_at: '2026-01-01T10:00:00Z', kind: 'uppfoljning', goal: 'Mål', summary_feedback: 'Bra jobbat' },
        ]);
        expect(result.points[0].feedback).toBe('Bra jobbat');
    });
});
