import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Referral register auth links', () => {
  it('uses /auth and not /login', () => {
    const file = readFileSync(resolve(process.cwd(), 'pages/ReferralRegister.tsx'), 'utf8');
    expect(file.includes('to="/login"')).toBe(false);
    expect(file.includes('to="/auth"')).toBe(true);
  });
});

describe('Referral migration safety', () => {
  it('defines uniqueness constraint for referrer/referred-user pair', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase_migration.sql'), 'utf8');
    expect(sql).toMatch(/UNIQUE\s*\(\s*referrer_id\s*,\s*referred_user_id\s*\)/i);
  });

  it('ensures caller can only match their own user id', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase_migration.sql'), 'utf8');
    expect(sql).toMatch(/auth\.uid\(\)\s*<>\s*p_user_id/i);
  });
});
