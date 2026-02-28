import { describe, it, expect } from 'vitest';
import { groupNotesByUserDate } from '../utils/managerNotes';

describe('manager notes', () => {
  it('groups notes by user and date', () => {
    const grouped = groupNotesByUserDate([
      { id: 'n1', user_id: 'u1', report_date: '2026-02-27', note: 'A' },
      { id: 'n2', user_id: 'u1', report_date: '2026-02-27', note: 'B' },
      { id: 'n3', user_id: 'u2', report_date: '2026-02-26', note: 'C' }
    ]);

    expect(grouped.u1['2026-02-27'].length).toBe(2);
    expect(grouped.u2['2026-02-26'][0].note).toBe('C');
  });
});
