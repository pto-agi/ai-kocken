import { describe, it, expect } from 'vitest';
import { isManagerProfile } from '../utils/roles';

describe('roles', () => {
  it('returns true when profile has is_manager true', () => {
    expect(isManagerProfile({ is_manager: true })).toBe(true);
  });

  it('returns false for missing or false manager flag', () => {
    expect(isManagerProfile(null)).toBe(false);
    expect(isManagerProfile(undefined)).toBe(false);
    expect(isManagerProfile({})).toBe(false);
    expect(isManagerProfile({ is_manager: false })).toBe(false);
  });
});
