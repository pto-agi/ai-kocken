import { describe, expect, it } from 'vitest';
import { computeOnboardingState } from '../utils/onboardingProgress';

describe('computeOnboardingState', () => {
    it('marks only account as done for a brand new user', () => {
        const result = computeOnboardingState({
            hasAccount: true,
            hasStartForm: false,
            hasWeeklyPlan: false,
            hasVisitedChat: false,
        });
        expect(result.completedCount).toBe(1);
        expect(result.totalCount).toBe(4);
        expect(result.allDone).toBe(false);
        expect(result.steps[0].completed).toBe(true);
        expect(result.steps[1].completed).toBe(false);
    });

    it('marks start form as done when present', () => {
        const result = computeOnboardingState({
            hasAccount: true,
            hasStartForm: true,
            hasWeeklyPlan: false,
            hasVisitedChat: false,
        });
        expect(result.completedCount).toBe(2);
    });

    it('returns allDone when everything is complete', () => {
        const result = computeOnboardingState({
            hasAccount: true,
            hasStartForm: true,
            hasWeeklyPlan: true,
            hasVisitedChat: true,
        });
        expect(result.completedCount).toBe(4);
        expect(result.allDone).toBe(true);
    });

    it('has correct hrefs for each step', () => {
        const result = computeOnboardingState({
            hasAccount: true,
            hasStartForm: false,
            hasWeeklyPlan: false,
            hasVisitedChat: false,
        });
        expect(result.steps.find((s) => s.id === 'startform')?.href).toBe('/start');
        expect(result.steps.find((s) => s.id === 'weeklyplan')?.href).toBe('/recept');
        expect(result.steps.find((s) => s.id === 'chat')?.href).toBe('/support');
    });
});
