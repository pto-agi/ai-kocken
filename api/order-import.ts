import { OpenAI } from 'openai';

type ProductHint = {
  id?: string;
  title?: string;
  aliases?: string[];
  sku?: string;
  price?: number;
  memberPrice?: number;
};

type ParsedOrderItem = {
  product_id: string | null;
  name: string | null;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  currency: string | null;
};

type ParsedOrder = {
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  shipping: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    postal_code: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
  };
  items: ParsedOrderItem[];
  totals: {
    subtotal: number | null;
    shipping: number | null;
    discount: number | null;
    total: number | null;
    currency: string | null;
  };
  order_reference: string | null;
  notes: string[];
  shipping_requirements: {
    required_fields: string[];
    missing_fields: string[];
    can_ship: boolean;
  };
  customer_requirements: {
    required_fields: string[];
    missing_fields: string[];
    has_minimum: boolean;
  };
};

const REQUIRED_SHIPPING_FIELDS = ['line1', 'postal_code', 'city', 'country', 'phone'] as const;
const REQUIRED_CUSTOMER_FIELDS = ['name', 'email'] as const;

const DEFAULT_MODEL = process.env.ORDER_IMPORT_MODEL || 'gpt-4.1-mini';

function toStr(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchProductId(name: string | null, products: ProductHint[]): string | null {
  if (!name) return null;
  const normalized = normalizeKey(name);
  for (const product of products) {
    const candidates = [
      product.id,
      product.title,
      ...(product.aliases || []),
      product.sku,
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      if (normalizeKey(candidate) === normalized) {
        return product.id || null;
      }
    }
  }
  return null;
}

function buildPrompt(products: ProductHint[], defaultCountry: string | null) {
  const productList = products.map((p) => ({
    id: p.id,
    title: p.title,
    aliases: p.aliases || [],
    sku: p.sku,
    price: p.price,
    memberPrice: p.memberPrice,
  }));

  return `You extract structured order data from raw text copied from an order page.

Return ONLY valid JSON. No markdown, no commentary.

Rules:
- Extract customer info, shipping address, order items, totals, and order reference if present.
- If a field is missing, return null for that field.
- Quantities must be integers when possible.
- Prices should be numeric (use decimal dot).
- If you can map items to a product in the provided list, set product_id to the matching id.
- If the order mentions delivery or shipping requirements, include it in notes.
- If country is missing, default to "${defaultCountry || 'Sverige'}".

Product list (for product_id mapping):
${JSON.stringify(productList)}

Output JSON schema:
{
  "customer": { "name": string|null, "email": string|null, "phone": string|null },
  "shipping": {
    "name": string|null,
    "line1": string|null,
    "line2": string|null,
    "postal_code": string|null,
    "city": string|null,
    "country": string|null,
    "phone": string|null
  },
  "items": [
    {
      "product_id": string|null,
      "name": string|null,
      "sku": string|null,
      "quantity": number|null,
      "unit_price": number|null,
      "total_price": number|null,
      "currency": string|null
    }
  ],
  "totals": {
    "subtotal": number|null,
    "shipping": number|null,
    "discount": number|null,
    "total": number|null,
    "currency": string|null
  },
  "order_reference": string|null,
  "notes": string[]
}`;
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return raw.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonSafe(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    const extracted = extractJsonObject(raw);
    if (!extracted) return null;
    try {
      return JSON.parse(extracted);
    } catch {
      return null;
    }
  }
}

function finalizeResult(data: any, products: ProductHint[], defaultCountry: string | null): ParsedOrder {
  const customer = {
    name: toStr(data?.customer?.name),
    email: toStr(data?.customer?.email),
    phone: toStr(data?.customer?.phone),
  };

  const shipping = {
    name: toStr(data?.shipping?.name) || customer.name,
    line1: toStr(data?.shipping?.line1),
    line2: toStr(data?.shipping?.line2),
    postal_code: toStr(data?.shipping?.postal_code),
    city: toStr(data?.shipping?.city),
    country: toStr(data?.shipping?.country) || (defaultCountry || 'Sverige'),
    phone: toStr(data?.shipping?.phone) || customer.phone,
  };

  const items: ParsedOrderItem[] = Array.isArray(data?.items) ? data.items : [];
  const normalizedItems = items.map((item) => {
    const name = toStr(item?.name);
    const productId =
      toStr(item?.product_id) ||
      matchProductId(name, products);
    return {
      product_id: productId,
      name,
      sku: toStr(item?.sku),
      quantity: toNum(item?.quantity),
      unit_price: toNum(item?.unit_price),
      total_price: toNum(item?.total_price),
      currency: toStr(item?.currency),
    };
  });

  const totals = {
    subtotal: toNum(data?.totals?.subtotal),
    shipping: toNum(data?.totals?.shipping),
    discount: toNum(data?.totals?.discount),
    total: toNum(data?.totals?.total),
    currency: toStr(data?.totals?.currency),
  };

  const orderReference = toStr(data?.order_reference);
  const notes = Array.isArray(data?.notes) ? data.notes.map((n: any) => String(n)).filter(Boolean) : [];

  const missingShipping = REQUIRED_SHIPPING_FIELDS.filter((field) => !shipping[field]);
  const missingCustomer = REQUIRED_CUSTOMER_FIELDS.filter((field) => !customer[field]);

  return {
    customer,
    shipping,
    items: normalizedItems,
    totals,
    order_reference: orderReference,
    notes,
    shipping_requirements: {
      required_fields: [...REQUIRED_SHIPPING_FIELDS],
      missing_fields: missingShipping,
      can_ship: missingShipping.length === 0,
    },
    customer_requirements: {
      required_fields: [...REQUIRED_CUSTOMER_FIELDS],
      missing_fields: missingCustomer,
      has_minimum: missingCustomer.length === 0,
    },
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    return;
  }

  const { text, products, defaultCountry } = req.body || {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Invalid payload: text is required' });
    return;
  }

  const productHints: ProductHint[] = Array.isArray(products) ? products : [];

  const client = new OpenAI({ apiKey });
  const systemPrompt = buildPrompt(productHints, typeof defaultCountry === 'string' ? defaultCountry : null);

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Order text:\n\n${text}` },
      ],
      temperature: 0,
    });

    const raw = response?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonSafe(raw);

    if (!parsed) {
      res.status(502).json({ error: 'Failed to parse model output', raw });
      return;
    }

    const result = finalizeResult(parsed, productHints, typeof defaultCountry === 'string' ? defaultCountry : null);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
