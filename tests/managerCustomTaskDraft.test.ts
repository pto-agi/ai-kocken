import { describe, expect, it } from 'vitest';
import { normalizeManagerCustomTaskDraft } from '../utils/managerCustomTaskDraft';

describe('manager custom task draft', () => {
  it('normalizes title, estimate and description', () => {
    const normalized = normalizeManagerCustomTaskDraft({
      title: '  Ring kund  ',
      estimated_minutes: ' 45 ',
      details: '  Prioritera kund som väntar  '
    });

    expect(normalized).toEqual({
      title: 'Ring kund',
      estimatedMinutes: 45,
      details: 'Prioritera kund som väntar'
    });
  });

  it('returns null estimate when invalid and null details when empty', () => {
    const normalized = normalizeManagerCustomTaskDraft({
      title: 'Uppgift',
      estimated_minutes: 'abc',
      details: '   '
    });

    expect(normalized).toEqual({
      title: 'Uppgift',
      estimatedMinutes: null,
      details: null
    });
  });
});
