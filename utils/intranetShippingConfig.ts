export const SHIPMENTS_TABLES = ['agenda_shipments', 'staff_shipments'] as const;

export type ShipmentsTable = (typeof SHIPMENTS_TABLES)[number];

type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
};

export const DEFAULT_SHIPMENTS_TABLE: ShipmentsTable = 'agenda_shipments';
export const DEFAULT_ORDER_IMPORT_ENDPOINT = '/api/order-import';

function normalizeInput(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function asKnownShipmentsTable(value?: string | null): ShipmentsTable | null {
  const normalized = normalizeInput(value);
  if (!normalized) return null;
  if ((SHIPMENTS_TABLES as readonly string[]).includes(normalized)) {
    return normalized as ShipmentsTable;
  }
  return null;
}

function extractKnownTableName(raw?: string | null): ShipmentsTable | null {
  const normalized = normalizeInput(raw);
  if (!normalized) return null;

  const patterns = [
    /public\.([a-z0-9_]+)/i,
    /table ['\"]?public\.([a-z0-9_]+)['\"]?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const candidate = match[1];
    const known = asKnownShipmentsTable(candidate);
    if (known) return known;
  }

  return null;
}

export function resolveOrderImportEndpoint(configuredEndpoint?: string | null): string {
  const normalized = normalizeInput(configuredEndpoint);
  return normalized || DEFAULT_ORDER_IMPORT_ENDPOINT;
}

export function resolveShipmentsTableFromEnv(configuredTable?: string | null): ShipmentsTable {
  return asKnownShipmentsTable(configuredTable) || DEFAULT_SHIPMENTS_TABLE;
}

export function resolveShipmentsTableFallback(
  currentTable: ShipmentsTable,
  error: PostgrestErrorLike | null | undefined,
): ShipmentsTable | null {
  if (!error || error.code !== 'PGRST205') {
    return null;
  }

  const suggestedTable = extractKnownTableName(error.hint) || extractKnownTableName(error.message);
  if (suggestedTable && suggestedTable !== currentTable) {
    return suggestedTable;
  }

  return SHIPMENTS_TABLES.find((table) => table !== currentTable) || null;
}
