import { describe, it, expect } from 'vitest';
import { formatWindowDaysLabel } from '../utils/managerWindow';

describe('manager window label', () => {
  it('formats singular and plural day labels', () => {
    expect(formatWindowDaysLabel(1)).toBe('1 dag');
    expect(formatWindowDaysLabel(7)).toBe('7 dagar');
    expect(formatWindowDaysLabel(30)).toBe('30 dagar');
  });
});
