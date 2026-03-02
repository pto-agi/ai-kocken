import { describe, expect, it } from 'vitest';
import { buildLatestTaskNoteMap } from '../utils/agendaTaskNotes';

describe('agenda task notes', () => {
  it('picks latest manager note per task id', () => {
    const map = buildLatestTaskNoteMap([
      { task_id: 't1', note: 'Äldre', created_at: '2026-03-02T08:00:00.000Z' },
      { task_id: 't1', note: 'Nyare', created_at: '2026-03-02T10:00:00.000Z' },
      { task_id: 'custom:c9', note: 'Custom-kommentar', created_at: '2026-03-02T09:00:00.000Z' }
    ]);

    expect(map).toEqual({
      t1: 'Nyare',
      'custom:c9': 'Custom-kommentar'
    });
  });

  it('ignores empty notes and missing task ids', () => {
    const map = buildLatestTaskNoteMap([
      { task_id: null, note: 'Ska ignoreras', created_at: '2026-03-02T09:00:00.000Z' },
      { task_id: 't2', note: '   ', created_at: '2026-03-02T09:01:00.000Z' },
      { task_id: 't2', note: 'Synlig', created_at: '2026-03-02T09:02:00.000Z' }
    ]);

    expect(map).toEqual({
      t2: 'Synlig'
    });
  });
});
