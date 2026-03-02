import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORDER_IMPORT_ENDPOINT,
  DEFAULT_SHIPMENTS_TABLE,
  resolveOrderImportEndpoint,
  resolveShipmentsTableFromEnv,
  resolveShipmentsTableFallback,
  type ShipmentsTable,
} from '../utils/intranetShippingConfig';

describe('intranet shipping config', () => {
  it('uses default order import endpoint when env is blank', () => {
    expect(resolveOrderImportEndpoint(undefined)).toBe(DEFAULT_ORDER_IMPORT_ENDPOINT);
    expect(resolveOrderImportEndpoint('')).toBe(DEFAULT_ORDER_IMPORT_ENDPOINT);
    expect(resolveOrderImportEndpoint('   ')).toBe(DEFAULT_ORDER_IMPORT_ENDPOINT);
  });

  it('uses explicit order import endpoint when configured', () => {
    expect(resolveOrderImportEndpoint(' https://example.com/order-import ')).toBe('https://example.com/order-import');
  });

  it('uses default shipments table when env is missing or invalid', () => {
    expect(resolveShipmentsTableFromEnv(undefined)).toBe(DEFAULT_SHIPMENTS_TABLE);
    expect(resolveShipmentsTableFromEnv('not_a_table')).toBe(DEFAULT_SHIPMENTS_TABLE);
  });

  it('uses configured shipments table when allowed', () => {
    expect(resolveShipmentsTableFromEnv('agenda_shipments')).toBe('agenda_shipments');
    expect(resolveShipmentsTableFromEnv('staff_shipments')).toBe('staff_shipments');
  });

  it('falls back to suggested table from PostgREST hint', () => {
    const fallback = resolveShipmentsTableFallback('staff_shipments', {
      code: 'PGRST205',
      hint: "Perhaps you meant the table 'public.agenda_shipments'",
      message: "Could not find the table 'public.staff_shipments' in the schema cache",
    });

    expect(fallback).toBe('agenda_shipments');
  });

  it('falls back to the other known table when hint is missing', () => {
    const fallback = resolveShipmentsTableFallback('agenda_shipments', {
      code: 'PGRST205',
      hint: null,
      message: "Could not find the table 'public.agenda_shipments' in the schema cache",
    });

    expect(fallback).toBe('staff_shipments');
  });

  it('returns null fallback for non-missing-table errors', () => {
    const fallback = resolveShipmentsTableFallback('agenda_shipments', {
      code: '23505',
      hint: null,
      message: 'duplicate key value violates unique constraint',
    });

    expect(fallback).toBeNull();
  });

  it('falls back to the other known table when hint suggests an unknown table', () => {
    const fallback = resolveShipmentsTableFallback('agenda_shipments' as ShipmentsTable, {
      code: 'PGRST205',
      hint: "Perhaps you meant the table 'public.unknown_shipments'",
      message: "Could not find the table 'public.agenda_shipments' in the schema cache",
    });

    expect(fallback).toBe('staff_shipments');
  });
});
