import { describe, expect, it } from 'vitest';
import { resolveIntranetMirrorUserId } from '../utils/intranetMirrorUser';

describe('resolveIntranetMirrorUserId', () => {
  it('uses session user id when user is not manager', () => {
    const result = resolveIntranetMirrorUserId({
      sessionUserId: 'staff-1',
      isManager: false,
      staffCandidates: [{ id: 'staff-2', is_staff: true, is_manager: false }]
    });
    expect(result).toBe('staff-1');
  });

  it('prefers non-manager staff id for manager mirror', () => {
    const result = resolveIntranetMirrorUserId({
      sessionUserId: 'manager-1',
      isManager: true,
      staffCandidates: [
        { id: 'manager-1', is_staff: true, is_manager: true },
        { id: 'staff-1', is_staff: true, is_manager: false }
      ]
    });
    expect(result).toBe('staff-1');
  });

  it('falls back to session user id if no other staff exists', () => {
    const result = resolveIntranetMirrorUserId({
      sessionUserId: 'manager-1',
      isManager: true,
      staffCandidates: [{ id: 'manager-1', is_staff: true, is_manager: true }]
    });
    expect(result).toBe('manager-1');
  });
});
