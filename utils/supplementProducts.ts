export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  memberPrice: number;
  tag?: string;
};

export const PRODUCTS: Product[] = [
  {
    id: 'klientpaket',
    title: 'Klientpaket',
    description: 'Samtliga kosttillskott som ingår i vårt klientpaket.',
    price: 1375,
    memberPrice: 995,
    tag: 'Mest valt',
  },
  {
    id: 'hydro-pulse',
    title: 'Hydro Pulse',
    description: 'Protein av högsta kvalitet för återhämtning och resultat.',
    price: 399,
    memberPrice: 349,
  },
  {
    id: 'bcaa',
    title: 'BCAA',
    description: 'Aminosyror som stödjer återhämtning och muskler.',
    price: 379,
    memberPrice: 349,
  },
  {
    id: 'omega-3',
    title: 'Omega 3',
    description: 'Högkvalitativt omega-3 för hjärta och fokus.',
    price: 199,
    memberPrice: 179,
  },
  {
    id: 'magnesium',
    title: 'Magnesium',
    description: 'Stödjer återhämtning, sömn och nervsystem.',
    price: 199,
    memberPrice: 179,
  },
  {
    id: 'multivitamin',
    title: 'Multivitamin',
    description: 'Dagligt basstöd för viktiga mikronutrienter.',
    price: 199,
    memberPrice: 179,
  },
];

/** Top picks shown in compact upsell contexts (e.g. uppföljning form). */
export const UPSELL_PRODUCT_IDS = ['klientpaket', 'hydro-pulse', 'bcaa'] as const;

export const UPSELL_PRODUCTS = PRODUCTS.filter((p) =>
  (UPSELL_PRODUCT_IDS as readonly string[]).includes(p.id),
);

export const REFILL_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/uc4akmc/';
