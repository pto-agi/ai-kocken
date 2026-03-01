import { describe, it, expect } from 'vitest';
import { buildAgendaCustomTaskRange } from '../utils/agendaCustomTaskRange';

describe('agenda custom task range', () => {
  it('includes selected date even when outside weekday range', () => {
    const range = buildAgendaCustomTaskRange({
      selectedDateKey: '2026-03-01',
      workweekDateKeys: ['2026-02-23', '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27']
    });

    expect(range).toEqual({ startKey: '2026-02-23', endKey: '2026-03-01' });
  });
});
