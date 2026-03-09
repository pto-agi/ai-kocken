import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('startform guest access', () => {
  it('does not protect /start or /start/tack behind AuthGuard', () => {
    const appPath = path.join(process.cwd(), 'App.tsx');
    const app = fs.readFileSync(appPath, 'utf8');

    const startIdx = app.indexOf('path="/start"');
    const startTackIdx = app.indexOf('path="/start/tack"');
    const uppfoljningIdx = app.indexOf('path="/uppfoljning"');

    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(startTackIdx).toBeGreaterThan(startIdx);
    expect(uppfoljningIdx).toBeGreaterThan(startTackIdx);

    const startSection = app.slice(startIdx, startTackIdx);
    expect(startSection).toContain('<Start />');
    expect(startSection).not.toContain('AuthGuard');

    const startTackSection = app.slice(startTackIdx, uppfoljningIdx);
    expect(startTackSection).toContain('<StartTack />');
    expect(startTackSection).not.toContain('AuthGuard');
  });

  it('allows start submission without login and shows guest/account options', () => {
    const startPath = path.join(process.cwd(), 'pages', 'Start.tsx');
    const start = fs.readFileSync(startPath, 'utf8');

    expect(start).not.toContain('Du behöver vara inloggad för att skicka in formuläret.');
    expect(start).toContain('user_id: session?.user?.id ?? null');
    expect(start).toContain('Lämna in som gäst');
    expect(start).toContain('Skapa konto och spara dina uppgifter');
  });

  it('does not protect /uppfoljning or /uppfoljning/tack behind AuthGuard', () => {
    const appPath = path.join(process.cwd(), 'App.tsx');
    const app = fs.readFileSync(appPath, 'utf8');

    const uppfoljningIdx = app.indexOf('path="/uppfoljning"');
    const uppfoljningTackIdx = app.indexOf('path="/uppfoljning/tack"');
    const forlangningIdx = app.indexOf('path="/forlangning"');

    expect(uppfoljningIdx).toBeGreaterThanOrEqual(0);
    expect(uppfoljningTackIdx).toBeGreaterThan(uppfoljningIdx);
    expect(forlangningIdx).toBeGreaterThan(uppfoljningTackIdx);

    const uppfoljningSection = app.slice(uppfoljningIdx, uppfoljningTackIdx);
    expect(uppfoljningSection).toContain('<Uppfoljning />');
    expect(uppfoljningSection).not.toContain('AuthGuard');

    const uppfoljningTackSection = app.slice(uppfoljningTackIdx, forlangningIdx);
    expect(uppfoljningTackSection).toContain('<UppfoljningTack />');
    expect(uppfoljningTackSection).not.toContain('AuthGuard');
  });

  it('allows uppfoljning submission without login and shows guest/account options', () => {
    const uppfoljningPath = path.join(process.cwd(), 'pages', 'Uppfoljning.tsx');
    const uppfoljning = fs.readFileSync(uppfoljningPath, 'utf8');

    expect(uppfoljning).not.toContain('Du behöver vara inloggad för att skicka in formuläret.');
    expect(uppfoljning).toContain('user_id: session?.user?.id ?? null');
    expect(uppfoljning).toContain('Lämna in som gäst');
    expect(uppfoljning).toContain('Skapa konto och spara dina uppgifter');
  });
});
