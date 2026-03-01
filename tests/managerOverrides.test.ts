import { describe, it, expect } from 'vitest';
import { applyCompletedTaskToggle } from '../utils/managerOverrides';

describe('manager override toggle', () => {
  it('adds missing task id when currently unchecked', () => {
    expect(applyCompletedTaskToggle(['a'], 'b', false)).toEqual(['a', 'b']);
  });

  it('removes existing task id when currently checked', () => {
    expect(applyCompletedTaskToggle(['a', 'b'], 'b', true)).toEqual(['a']);
  });

  it('deduplicates task id when adding', () => {
    expect(applyCompletedTaskToggle(['a', 'a'], 'a', false)).toEqual(['a']);
  });
});
