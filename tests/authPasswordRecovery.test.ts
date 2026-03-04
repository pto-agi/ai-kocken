import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Auth password recovery', () => {
  it('exposes forgot password UI and recovery actions in AuthScreen', () => {
    const file = path.join(process.cwd(), 'components', 'AuthScreen.tsx');
    const src = fs.readFileSync(file, 'utf8');

    expect(src.includes('Glömt lösenord?')).toBe(true);
    expect(src.includes('resetPasswordForEmail')).toBe(true);
    expect(src.includes('updateUser({ password:')).toBe(true);
  });
});
