import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateFullWeeklyDetails,
  generateWeeklyPlan,
  swapMeal,
  type WeeklyPlanRequest,
} from '../services/geminiService';

const baseRequest: WeeklyPlanRequest = {
  language: 'sv',
  days: 2,
  servings: 2,
  mealsPerDay: 3,
  targets: { kcal: 2200, p: 35, c: 35, f: 30 },
  diet: {
    type: 'omnivore',
    allergies: 'nötter',
    excludeIngredients: 'selleri',
    mustInclude: 'lax',
  },
  preferences: {
    categories: ['husmanskost'],
    spiceLevel: 'medium',
    varietyLevel: 'balanced',
    leftoversPlan: 'some',
    optimizeShopping: true,
  },
};

function geminiOk(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ text }),
  } as unknown as Response;
}

describe('geminiService weekly plan quality', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries when a day has wrong number of meals and returns exact mealsPerDay', async () => {
    const firstDraft = JSON.stringify([
      {
        day: 'Dag 1',
        meals: [{ type: 'Frukost', name: 'Overnight oats', kcal: 450 }],
      },
      {
        day: 'Dag 2',
        meals: [
          { type: 'Frukost', name: 'Yoghurt bowl', kcal: 420 },
          { type: 'Lunch', name: 'Kycklingsallad', kcal: 780 },
        ],
      },
    ]);

    const secondDraft = JSON.stringify([
      {
        day: 'Dag 1',
        meals: [
          { type: 'Frukost', name: 'Overnight oats', kcal: 450 },
          { type: 'Lunch', name: 'Lax med ris', kcal: 900 },
          { type: 'Middag', name: 'Kycklinggryta', kcal: 850 },
        ],
      },
      {
        day: 'Dag 2',
        meals: [
          { type: 'Frukost', name: 'Yoghurt bowl', kcal: 420 },
          { type: 'Lunch', name: 'Taco bowl', kcal: 860 },
          { type: 'Middag', name: 'Pasta tonno', kcal: 920 },
        ],
      },
    ]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiOk(firstDraft))
      .mockResolvedValueOnce(geminiOk(secondDraft));
    vi.stubGlobal('fetch', fetchMock);

    const plan = await generateWeeklyPlan(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(plan).toHaveLength(baseRequest.days);
    expect(plan.every((day) => Array.isArray(day.meals) && day.meals.length === baseRequest.mealsPerDay)).toBe(true);
  });

  it('includes allergy and exclusion constraints when swapping meals', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiOk(JSON.stringify({ name: 'Laxgryta', type: 'Lunch', kcal: 780 })));
    vi.stubGlobal('fetch', fetchMock);

    await swapMeal('Kycklingwok', 'Lunch', baseRequest);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { contents: string };

    expect(payload.contents).toContain('Allergier');
    expect(payload.contents).toContain('nötter');
    expect(payload.contents).toContain('Uteslut ingredienser');
    expect(payload.contents).toContain('selleri');
    expect(payload.contents).toContain('Måste inkludera');
    expect(payload.contents).toContain('lax');
  });

  it('passes diet constraints to detail generation for weekly recipes', async () => {
    const overview = [
      {
        day: 'Dag 1',
        meals: [{ type: 'Lunch', name: 'Lax med potatis', kcal: 700, protein: 50, carbs: 60, fat: 20 }],
      },
    ];

    const details = JSON.stringify([
      {
        day: 'Dag 1',
        meals: [
          {
            name: 'Lax med potatis',
            type: 'Lunch',
            ingredients: ['200 g lax', '300 g potatis'],
            instructions: 'Tillaga allt och servera.',
          },
        ],
      },
    ]);

    const fetchMock = vi.fn().mockResolvedValue(geminiOk(details));
    vi.stubGlobal('fetch', fetchMock);

    await generateFullWeeklyDetails(overview, baseRequest as unknown as Record<string, unknown>);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { contents: string };

    expect(payload.contents).toContain('Allergier');
    expect(payload.contents).toContain('nötter');
    expect(payload.contents).toContain('Uteslut ingredienser');
    expect(payload.contents).toContain('selleri');
    expect(payload.contents).toContain('Måste inkludera');
    expect(payload.contents).toContain('lax');
  });
});
