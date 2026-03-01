import { describe, expect, it } from 'vitest';
import { resolveUniversalAgendaUserId } from '../utils/managerUniversalAgenda';

describe('resolveUniversalAgendaUserId', () => {
  it('prefers non-manager staff id when manager is in staff list', () => {
    const result = resolveUniversalAgendaUserId(
      [
        { id: 'manager-1', is_staff: true, is_manager: true },
        { id: 'staff-1', is_staff: true, is_manager: false }
      ],
      'manager-1'
    );
    expect(result).toBe('staff-1');
  });

  it('falls back to manager id when no staff exists', () => {
    const result = resolveUniversalAgendaUserId([], 'manager-1');
    expect(result).toBe('manager-1');
  });
});
