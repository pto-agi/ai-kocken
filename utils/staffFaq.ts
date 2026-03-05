export type StaffFaqEntry = {
  id: string;
  question: string;
  answer: string;
  howTo?: string | null;
  category: string;
  tags: string[];
  links?: Array<{ label: string; href: string; external?: boolean }>;
  showOnIntranet?: boolean;
};

export type StaffFaqInsertPayload = {
  question: string;
  answer: string;
  how_to: string | null;
  tags: string[];
  category: string;
  link_label: string | null;
  link_href: string | null;
  show_on_intranet: boolean;
};

type StaffFaqDbRow = {
  id: string;
  question: string;
  answer: string;
  how_to?: string | null;
  category?: string | null;
  tags?: unknown;
  link_label?: string | null;
  link_href?: string | null;
  show_on_intranet?: boolean | null;
};

export const STAFF_FAQ_ENTRIES: StaffFaqEntry[] = [
  {
    id: 'payment-swish',
    question: 'Vilket Swish-nummer använder vi?',
    answer: 'Swish-nummer för betalning är 123 003 73 17.',
    category: 'Betalning',
    tags: ['swish', 'betalning', 'nummer']
  },
  {
    id: 'payment-methods',
    question: 'Vilka betalningssätt gäller för medlemskap och förlängning?',
    answer: 'Kort, Swish, faktura, delbetalning och Apple Pay hanteras via Stripe/Klarna.',
    category: 'Betalning',
    tags: ['betalning', 'kort', 'faktura', 'klarna', 'apple pay', 'stripe']
  },
  {
    id: 'quicklinks-intranet',
    question: 'Var hittar jag intranätets huvudsidor?',
    answer: 'Använd snabblänkarna nedan för daglig drift.',
    category: 'Snabblänkar',
    tags: ['intranät', 'snabblänk', 'manager', 'todoist', 'sales'],
    links: [
      { label: 'Intranät', href: '/intranet' },
      { label: 'Manager', href: '/intranet/manager' },
      { label: 'Todoist', href: '/intranet/todoist' },
      { label: 'Sälj & Kapital', href: '/sales-capital' }
    ]
  },
  {
    id: 'quicklinks-changelog',
    question: 'Var ser jag senaste ändringar i systemet?',
    answer: 'Öppna changelog för att se senaste releaser och vad som ändrats.',
    category: 'Snabblänkar',
    tags: ['changelog', 'release', 'ändringar'],
    links: [{ label: 'Changelog', href: '/changelog' }]
  },
  {
    id: 'contact-support',
    question: 'Vart skickar vi interna supportfrågor?',
    answer: 'Skicka tekniska frågor i intern chat/managerflöde och inkludera tydliga steg, datum och skärmdump.',
    category: 'Kontakt',
    tags: ['support', 'bugg', 'teknik', 'kontakt']
  }
];

const normalize = (value: string) => value.toLowerCase().trim();
export const STAFF_FAQ_CATEGORIES = [
  'Medlemskap & villkor',
  'App & träning',
  'Kost & recept',
  'Förlängning',
  'Betalning & friskvård',
  'Shop & leverans',
  'Intern process',
  'Villkor & juridik',
  'Snabblänkar',
  'Kontakt',
  'Policy'
] as const;

const toCategory = (value: string): string => (value || 'Policy').trim() || 'Policy';

export const parseStaffFaqTagsInput = (input: string) => (
  Array.from(
    new Set(
      input
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  )
);

export const buildStaffFaqInsertPayload = (input: {
  question: string;
  answer: string;
  howTo?: string;
  tagsInput?: string;
  category?: string;
  linkLabel?: string;
  linkHref?: string;
  showOnIntranet?: boolean;
}): StaffFaqInsertPayload => ({
  question: input.question.trim(),
  answer: input.answer.trim(),
  how_to: input.howTo?.trim() ? input.howTo.trim() : null,
  tags: parseStaffFaqTagsInput(input.tagsInput || ''),
  category: toCategory((input.category || 'Policy').trim()),
  link_label: input.linkLabel?.trim() ? input.linkLabel.trim() : null,
  link_href: input.linkHref?.trim() ? input.linkHref.trim() : null,
  show_on_intranet: input.showOnIntranet === true
});

export const toStaffFaqEntries = (rows: StaffFaqDbRow[]): StaffFaqEntry[] => (
  rows.map((row) => {
    const tags = Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [];
    const linkLabel = row.link_label?.trim();
    const linkHref = row.link_href?.trim();
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      howTo: row.how_to ?? null,
      category: toCategory((row.category || 'Policy').trim()),
      tags,
      links: linkLabel && linkHref ? [{ label: linkLabel, href: linkHref, external: /^https?:\/\//i.test(linkHref) }] : undefined,
      showOnIntranet: row.show_on_intranet === true
    };
  })
);

const scoreEntry = (entry: StaffFaqEntry, query: string) => {
  const q = normalize(query);
  if (!q) return 1;
  const title = normalize(entry.question);
  const answer = normalize(entry.answer);
  const howTo = normalize(entry.howTo || '');
  const category = normalize(entry.category);
  const tags = entry.tags.map(normalize);

  if (title === q) return 120;
  if (tags.some((tag) => tag === q)) return 110;
  if (title.startsWith(q)) return 100;
  if (tags.some((tag) => tag.includes(q))) return 80;
  if (title.includes(q)) return 70;
  if (howTo.includes(q)) return 60;
  if (answer.includes(q)) return 50;
  if (category.includes(q)) return 40;
  return 0;
};

export const searchStaffFaqEntries = (query: string, entries: StaffFaqEntry[] = STAFF_FAQ_ENTRIES) => {
  const normalized = normalize(query);
  if (!normalized) return entries;

  return [...entries]
    .map((entry) => ({ entry, score: scoreEntry(entry, normalized) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.question.localeCompare(b.entry.question, 'sv-SE'))
    .map((item) => item.entry);
};
